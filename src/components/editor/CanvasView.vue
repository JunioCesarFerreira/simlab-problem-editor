<template>
  <div class="canvas-wrapper" ref="wrapperRef" tabindex="0" @keydown.capture="handleKey">
    <canvas
      ref="canvasRef"
      :width="canvasW"
      :height="canvasH"
      :style="{ cursor: canvasCursor }"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @dblclick="handleDblClick"
      @contextmenu.prevent="handleRightClick"
      @mouseleave="handleMouseLeave"
    />
    <div class="coords" v-if="hover">
      {{ fmtC(hover[0]) }}, {{ fmtC(hover[1]) }}
    </div>
    <div class="tool-hint" :class="{ warn: isToolWarn }">{{ toolHint }}</div>

    <!-- Scale calibration input overlay -->
    <div
      v-if="scaleCalibrateState?.locked"
      class="scale-input-overlay"
      :style="scaleOverlayPos"
    >
      <div class="scale-label">Comprimento real do segmento:</div>
      <div class="scale-dist-hint">Distância atual: {{ scaleCalibrateWorldDist.toFixed(2) }} u</div>
      <input
        ref="scaleInputRef"
        v-model="scaleRealLength"
        type="number"
        min="0.001"
        step="any"
        placeholder="ex: 50.0"
        @keydown.enter="applyScaleCalibration"
        @keydown.escape.stop="cancelScaleCalibration"
      />
      <div class="scale-btns">
        <button class="apply" @click="applyScaleCalibration">Aplicar</button>
        <button class="cancel" @click="cancelScaleCalibration">Cancelar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useProblemStore } from '../../stores/problemStore'
import { useEditorStore } from '../../stores/editorStore'
import { sampleCustomSegment } from '../../services/expressionEvaluator'
import type { Region } from '../../models/problem'

const problemStore = useProblemStore()
const editorStore = useEditorStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const canvasW = ref(800)
const canvasH = ref(600)
const hover = ref<[number, number] | null>(null)

// ─── Interaction state ────────────────────────────────────────────────────────

/** Points of the polyline being drawn (world coords) */
const polylinePoints = ref<[number, number][]>([])

/** Ellipse drag: center fixed, current tracks mouse */
const ellipseDrag = ref<{ center: [number, number]; current: [number, number] } | null>(null)

/** Drag-move state for select tool */
const dragState = ref<{
  type: 'sink' | 'candidate'
  id?: string
  downCanvas: [number, number]
  originalPos: [number, number]
  moved: boolean
} | null>(null)

/** Suppress the click that fires after dblclick */
let suppressNextClick = false

// ─── Scale calibration ────────────────────────────────────────────────────────

const scaleCalibrateState = ref<{
  anchor: [number, number]
  current: [number, number]
  locked: boolean
} | null>(null)

const scaleRealLength = ref<string>('')
const scaleInputRef = ref<HTMLInputElement | null>(null)

const scaleCalibrateWorldDist = computed(() => {
  const ms = scaleCalibrateState.value
  if (!ms) return 0
  return Math.hypot(ms.current[0] - ms.anchor[0], ms.current[1] - ms.anchor[1])
})

const scaleOverlayPos = computed(() => {
  const ms = scaleCalibrateState.value
  if (!ms?.locked) return {}
  const [ax, ay] = worldToCanvas(ms.anchor[0], ms.anchor[1])
  const [bx, by] = worldToCanvas(ms.current[0], ms.current[1])
  const mx = (ax + bx) / 2
  const my = Math.min(ay, by) - 8  // place above the segment
  return {
    left: `${Math.min(Math.max((mx / canvasW.value) * 100, 5), 75)}%`,
    top:  `${Math.max((my / canvasH.value) * 100, 2)}%`,
  }
})

watch(() => scaleCalibrateState.value?.locked, (locked) => {
  if (locked) nextTick(() => scaleInputRef.value?.focus())
})

function applyScaleCalibration() {
  const ms = scaleCalibrateState.value
  if (!ms?.locked) return
  const realLen = parseFloat(scaleRealLength.value)
  if (!isFinite(realLen) || realLen <= 0) return
  const worldDist = scaleCalibrateWorldDist.value
  if (worldDist < 0.001) return
  problemStore.rescaleAll(realLen / worldDist)
  scaleCalibrateState.value = null
  scaleRealLength.value = ''
}

function cancelScaleCalibration() {
  scaleCalibrateState.value = null
  scaleRealLength.value = ''
}

// ─── Tape measure ─────────────────────────────────────────────────────────────

/**
 * anchor: fixed first point (world coords)
 * current: live or locked second point (world coords)
 * locked: true once user releases the mouse button
 */
const measureState = ref<{
  anchor: [number, number]
  current: [number, number]
  locked: boolean
} | null>(null)

// ─── Region resize ────────────────────────────────────────────────────────────

type RegionHandle = 'tl' | 't' | 'tr' | 'r' | 'br' | 'b' | 'bl' | 'l'

const HANDLE_CURSORS: Record<RegionHandle, string> = {
  tl: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', br: 'nwse-resize',
  t: 'ns-resize',   b: 'ns-resize',
  l: 'ew-resize',   r: 'ew-resize',
}

const regionDrag = ref<{ handle: RegionHandle } | null>(null)
const hoveredHandle = ref<RegionHandle | null>(null)

/** Canvas positions of all 8 region handles */
function getRegionHandlePositions(): Record<RegionHandle, [number, number]> {
  const [xmin, ymin, xmax, ymax] = problemStore.draft.region
  const xmid = (xmin + xmax) / 2
  const ymid = (ymin + ymax) / 2
  return {
    tl: worldToCanvas(xmin, ymax), t: worldToCanvas(xmid, ymax), tr: worldToCanvas(xmax, ymax),
    l:  worldToCanvas(xmin, ymid),                                 r:  worldToCanvas(xmax, ymid),
    bl: worldToCanvas(xmin, ymin), b: worldToCanvas(xmid, ymin),  br: worldToCanvas(xmax, ymin),
  }
}

function hitTestRegionHandle(cx: number, cy: number): RegionHandle | null {
  const pos = getRegionHandlePositions()
  for (const [h, [px, py]] of Object.entries(pos) as [RegionHandle, [number, number]][]) {
    if (Math.hypot(cx - px, cy - py) <= 8) return h
  }
  return null
}

function applyRegionDrag(handle: RegionHandle, wx: number, wy: number) {
  const r = [...problemStore.draft.region] as [number, number, number, number]
  const MIN = 10 // minimum region size
  if (handle === 'l' || handle === 'tl' || handle === 'bl') r[0] = Math.min(wx, r[2] - MIN)
  if (handle === 'r' || handle === 'tr' || handle === 'br') r[2] = Math.max(wx, r[0] + MIN)
  if (handle === 'b' || handle === 'bl' || handle === 'br') r[1] = Math.min(wy, r[3] - MIN)
  if (handle === 't' || handle === 'tl' || handle === 'tr') r[3] = Math.max(wy, r[1] + MIN)
  problemStore.updateMeta({ region: r })
}

// ─── Cached background image ──────────────────────────────────────────────────
let bgImage: HTMLImageElement | null = null
watch(() => editorStore.backgroundImage, (src) => {
  if (!src) { bgImage = null; draw(); return }
  const img = new Image()
  img.onload = () => { bgImage = img; draw() }
  img.src = src
}, { immediate: true })

// ─── Resize observer ──────────────────────────────────────────────────────────
let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver(entries => {
    for (const e of entries) {
      canvasW.value = Math.floor(e.contentRect.width)
      canvasH.value = Math.floor(e.contentRect.height)
    }
  })
  if (wrapperRef.value) ro.observe(wrapperRef.value)
})
onUnmounted(() => ro?.disconnect())

// ─── Coordinate transform — uniform scale, preserves world aspect ratio ───────
const region = computed<Region>(() => problemStore.draft.region)
const MARGIN = 48

/**
 * Returns the viewport parameters derived from the current canvas size and region.
 * Uses the SAME scale for both axes so the world coordinate system is not deformed.
 */
const viewport = computed(() => {
  const [xmin, ymin, xmax, ymax] = region.value
  const worldW = xmax - xmin
  const worldH = ymax - ymin
  const availW = canvasW.value - MARGIN * 2
  const availH = canvasH.value - MARGIN * 2
  const scale = Math.min(availW / worldW, availH / worldH)
  // Center the region viewport in the available area
  const vw = worldW * scale
  const vh = worldH * scale
  const offX = MARGIN + (availW - vw) / 2
  const offY = MARGIN + (availH - vh) / 2
  return { xmin, ymin, xmax, ymax, scale, offX, offY, vw, vh }
})

function worldToCanvas(wx: number, wy: number): [number, number] {
  const { xmin, ymax, scale, offX, offY } = viewport.value
  return [
    offX + (wx - xmin) * scale,
    offY + (ymax - wy) * scale,
  ]
}

function canvasToWorld(cx: number, cy: number): [number, number] {
  const { xmin, ymax, scale, offX, offY } = viewport.value
  return [
    xmin + (cx - offX) / scale,
    ymax - (cy - offY) / scale,
  ]
}

function fmtC(v: number) { return v.toFixed(1) }
function snap(v: number) { return Math.round(v) }

// ─── Hit testing ──────────────────────────────────────────────────────────────
const HIT_PX = 10

function hitSink(cx: number, cy: number): boolean {
  const sink = problemStore.draft.sink
  if (!sink) return false
  const [px, py] = worldToCanvas(sink.x, sink.y)
  return Math.hypot(cx - px, cy - py) <= HIT_PX
}

function hitCandidate(cx: number, cy: number): string | null {
  for (const c of problemStore.draft.candidates) {
    const [px, py] = worldToCanvas(c.x, c.y)
    if (Math.hypot(cx - px, cy - py) <= HIT_PX) return c.id
  }
  return null
}

// ─── Tool UI helpers ──────────────────────────────────────────────────────────

const canvasCursor = computed(() => {
  if (regionDrag.value) return HANDLE_CURSORS[regionDrag.value.handle]
  if (hoveredHandle.value) return HANDLE_CURSORS[hoveredHandle.value]
  const t = editorStore.activeTool
  if (t === 'select') return dragState.value?.moved ? 'grabbing' : 'default'
  if (t === 'measure') return 'crosshair'
  return 'crosshair'
})

const isToolWarn = computed(() =>
  ['draw-line', 'draw-ellipse'].includes(editorStore.activeTool) && !editorStore.activeNodeId
)

const toolHint = computed(() => {
  const t = editorStore.activeTool
  if (t === 'draw-line') {
    if (!editorStore.activeNodeId) return '⚠ Selecione um nó móvel na aba Nodes antes de desenhar'
    const n = polylinePoints.value.length
    return n === 0
      ? 'Clique para iniciar polilinha  ·  Esc cancela'
      : `${n} ponto(s)  ·  clique para continuar  ·  duplo-clique ou clique direito para finalizar`
  }
  if (t === 'draw-ellipse') {
    if (!editorStore.activeNodeId) return '⚠ Selecione um nó móvel na aba Nodes antes de desenhar'
    return ellipseDrag.value
      ? 'Solte para confirmar a elipse'
      : 'Arraste para definir centro e raios da elipse'
  }
  if (t === 'measure') {
    if (!measureState.value) return 'Arraste para medir distância  [M]  ·  Esc cancela'
    if (!measureState.value.locked) return 'Solte para fixar a medição  ·  Esc cancela'
    const d = measureDistance()
    return `Distância: ${d.toFixed(1)} u  ·  clique ou Esc para limpar`
  }
  if (t === 'scale-calibrate') {
    if (!scaleCalibrateState.value) return 'Arraste um segmento de comprimento conhecido  [R]  ·  Esc cancela'
    if (!scaleCalibrateState.value.locked) return 'Solte para fixar o segmento  ·  Esc cancela'
    return 'Digite o comprimento real e pressione Enter para recalibrar a escala'
  }
  const hints: Record<string, string> = {
    'select': 'Clique para selecionar · arraste para mover · Del para remover · clique direito para remover',
    'place-sink': 'Clique para posicionar o sink  [K]',
    'place-candidate': 'Clique para adicionar candidato  [C]  ·  clique direito para remover',
  }
  return hints[t] ?? ''
})

function measureDistance(): number {
  if (!measureState.value) return 0
  const [ax, ay] = measureState.value.anchor
  const [bx, by] = measureState.value.current
  return Math.hypot(bx - ax, by - ay)
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  const { vw, vh, offX, offY } = viewport.value

  ctx.clearRect(0, 0, canvasW.value, canvasH.value)

  // ── Background image ───────────────────────────────────────────────────────
  if (bgImage) {
    const calBounds = editorStore.imageWorldBounds
    let imgX: number, imgY: number, imgW: number, imgH: number

    if (calBounds) {
      // Calibrated: image covers these world bounds
      const [ix1, iy1] = worldToCanvas(calBounds[0], calBounds[3]) // top-left
      const [ix2, iy2] = worldToCanvas(calBounds[2], calBounds[1]) // bottom-right
      imgX = ix1; imgY = iy1; imgW = ix2 - ix1; imgH = iy2 - iy1
    } else {
      // No calibration: fit image inside viewport preserving its aspect ratio
      const imgAspect = bgImage.naturalWidth / bgImage.naturalHeight
      const vpAspect = vw / vh
      if (imgAspect > vpAspect) {
        // Image is wider → fit width, letterbox top/bottom
        imgW = vw
        imgH = vw / imgAspect
        imgX = offX
        imgY = offY + (vh - imgH) / 2
      } else {
        // Image is taller → fit height, pillarbox sides
        imgH = vh
        imgW = vh * imgAspect
        imgX = offX + (vw - imgW) / 2
        imgY = offY
      }
    }

    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.drawImage(bgImage, imgX, imgY, imgW, imgH)
    ctx.restore()
  }

  drawGrid(ctx)
  drawRegionBorder(ctx)
  drawMobileRoutes(ctx)
  drawCandidates(ctx)
  drawSink(ctx)
  drawPolylinePreview(ctx)
  drawEllipsePreview(ctx)
  drawMeasure(ctx)
  drawScaleCalibrate(ctx)
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  const { xmin, ymin, xmax, ymax, scale } = viewport.value

  // Choose grid step so we get ~5–10 lines
  const span = xmax - xmin
  const rawStep = span / 8
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const step = [1, 2, 5, 10].map(f => f * mag).find(s => span / s <= 10) ?? mag * 10

  ctx.strokeStyle = '#2a2a3e'
  ctx.lineWidth = 0.5
  ctx.fillStyle = '#6c7086'
  ctx.font = `${Math.max(9, Math.min(11, scale * 8))}px monospace`
  ctx.textAlign = 'center'

  for (let x = Math.ceil(xmin / step) * step; x <= xmax + 1e-9; x += step) {
    const [px] = worldToCanvas(x, 0)
    const [, py1] = worldToCanvas(0, ymin)
    const [, py2] = worldToCanvas(0, ymax)
    ctx.beginPath(); ctx.moveTo(px, py1); ctx.lineTo(px, py2); ctx.stroke()
    // x-axis label
    const [, labelY] = worldToCanvas(0, ymin)
    ctx.fillText(String(Math.round(x)), px, labelY + 13)
  }

  ctx.textAlign = 'right'
  for (let y = Math.ceil(ymin / step) * step; y <= ymax + 1e-9; y += step) {
    const [, py] = worldToCanvas(0, y)
    const [px1] = worldToCanvas(xmin, 0)
    const [px2] = worldToCanvas(xmax, 0)
    ctx.beginPath(); ctx.moveTo(px1, py); ctx.lineTo(px2, py); ctx.stroke()
    // y-axis label
    const [labelX] = worldToCanvas(xmin, 0)
    ctx.fillText(String(Math.round(y)), labelX - 4, py + 3)
  }

  // Axes
  ctx.strokeStyle = '#45475a'
  ctx.lineWidth = 1
  if (xmin <= 0 && 0 <= xmax) {
    const [px] = worldToCanvas(0, 0)
    const [, py1] = worldToCanvas(0, ymin)
    const [, py2] = worldToCanvas(0, ymax)
    ctx.beginPath(); ctx.moveTo(px, py1); ctx.lineTo(px, py2); ctx.stroke()
  }
  if (ymin <= 0 && 0 <= ymax) {
    const [, py] = worldToCanvas(0, 0)
    const [px1] = worldToCanvas(xmin, 0)
    const [px2] = worldToCanvas(xmax, 0)
    ctx.beginPath(); ctx.moveTo(px1, py); ctx.lineTo(px2, py); ctx.stroke()
  }
}

function drawRegionBorder(ctx: CanvasRenderingContext2D) {
  const { xmin, ymin, xmax, ymax } = viewport.value
  const [px1, py1] = worldToCanvas(xmin, ymax)
  const [px2, py2] = worldToCanvas(xmax, ymin)
  const active = !!regionDrag.value || !!hoveredHandle.value
  ctx.strokeStyle = active ? '#cdd6f4' : '#89b4fa'
  ctx.lineWidth = active ? 2 : 1.5
  ctx.setLineDash([5, 4])
  ctx.strokeRect(px1, py1, px2 - px1, py2 - py1)
  ctx.setLineDash([])

  // Draw handles
  const pos = getRegionHandlePositions()
  for (const [h, [hx, hy]] of Object.entries(pos) as [RegionHandle, [number, number]][]) {
    const isActive = regionDrag.value?.handle === h || hoveredHandle.value === h
    ctx.beginPath()
    ctx.rect(hx - 4, hy - 4, 8, 8)
    ctx.fillStyle = isActive ? '#cdd6f4' : '#89b4fa'
    ctx.fill()
    ctx.strokeStyle = '#181825'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function drawCandidates(ctx: CanvasRenderingContext2D) {
  const sel = editorStore.selected
  for (const c of problemStore.draft.candidates) {
    const [px, py] = worldToCanvas(c.x, c.y)
    const selected = sel?.type === 'candidate' && sel.id === c.id
    ctx.beginPath()
    ctx.arc(px, py, selected ? 7 : 5, 0, Math.PI * 2)
    ctx.fillStyle = '#a6e3a1'
    ctx.fill()
    ctx.strokeStyle = selected ? '#f9e2af' : '#1e1e2e'
    ctx.lineWidth = selected ? 2.5 : 1
    ctx.stroke()
  }
}

function drawSink(ctx: CanvasRenderingContext2D) {
  const sink = problemStore.draft.sink
  if (!sink) return
  const [px, py] = worldToCanvas(sink.x, sink.y)
  const selected = editorStore.selected?.type === 'sink'
  const r = selected ? 11 : 9
  ctx.strokeStyle = selected ? '#f9e2af' : '#f38ba8'
  ctx.lineWidth = selected ? 3 : 2.5
  ctx.beginPath(); ctx.moveTo(px - r, py); ctx.lineTo(px + r, py); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px, py - r); ctx.lineTo(px, py + r); ctx.stroke()
  ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.stroke()
}

// Vivid, high-contrast colors for route trajectories
const ROUTE_COLORS = ['#ff4dc4', '#00e5ff', '#ff6b35', '#39ff14', '#ffe600', '#bf5fff']

// Dash patterns per node index so overlapping routes stay distinguishable
const ROUTE_DASHES = [
  [10, 5],
  [6, 4],
  [14, 4, 3, 4],
  [4, 4],
  [12, 3, 3, 3],
  [8, 6],
]

/** Place directional arrows every ~ARROW_SPACING canvas pixels along a path */
const ARROW_SPACING = 60

function drawMobileRoutes(ctx: CanvasRenderingContext2D) {
  problemStore.draft.mobileNodes.forEach((node, ni) => {
    const color = ROUTE_COLORS[ni % ROUTE_COLORS.length]
    const dash  = ROUTE_DASHES[ni % ROUTE_DASHES.length]
    const isActive = editorStore.activeNodeId === node.id
    const lw = isActive ? 3 : 2

    ctx.strokeStyle = color
    ctx.lineWidth = lw
    ctx.setLineDash(dash)

    for (const seg of node.segments) {
      if (seg.type === 'line') {
        const [px1, py1] = worldToCanvas(seg.start[0], seg.start[1])
        const [px2, py2] = worldToCanvas(seg.end[0], seg.end[1])
        ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke()
        ctx.setLineDash([])
        drawArrowsAlongLine(ctx, px1, py1, px2, py2, color, lw)
        ctx.setLineDash(dash)
        ctx.strokeStyle = color
      } else if (seg.type === 'ellipse') {
        const [cpx, cpy] = worldToCanvas(seg.center[0], seg.center[1])
        const [ex] = worldToCanvas(seg.center[0] + seg.radiusX, seg.center[1])
        const [, ey] = worldToCanvas(seg.center[0], seg.center[1] + seg.radiusY)
        const rx = Math.abs(ex - cpx)
        const ry = Math.abs(ey - cpy)
        ctx.beginPath()
        ctx.ellipse(cpx, cpy, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
        drawArrowsAlongEllipse(ctx, cpx, cpy, rx, ry, color, lw)
        ctx.setLineDash(dash)
        ctx.strokeStyle = color
        // center dot
        ctx.beginPath(); ctx.arc(cpx, cpy, 3, 0, Math.PI * 2)
        ctx.fillStyle = color; ctx.fill()
      } else if (seg.type === 'custom') {
        const pts = sampleCustomSegment(seg.exprX, seg.exprY, 80)
        if (pts && pts.length > 1) {
          const canvasPts = pts.map(([wx, wy]) => worldToCanvas(wx, wy))
          ctx.beginPath()
          ctx.moveTo(canvasPts[0][0], canvasPts[0][1])
          for (let i = 1; i < canvasPts.length; i++) ctx.lineTo(canvasPts[i][0], canvasPts[i][1])
          ctx.stroke()
          ctx.setLineDash([])
          drawArrowsAlongPath(ctx, canvasPts, color, lw)
          ctx.setLineDash(dash)
          ctx.strokeStyle = color
        } else {
          ctx.setLineDash([])
          ctx.fillStyle = '#f38ba8'
          ctx.font = '11px monospace'
          ctx.textAlign = 'left'
          ctx.fillText('⚠ expr', viewport.value.offX + 4, viewport.value.offY + 14)
          ctx.setLineDash(dash)
        }
      }
    }

    ctx.setLineDash([])

    // Node label
    if (node.segments.length > 0) {
      const s = node.segments[0]
      const lx = s.type === 'line' ? s.start[0] : s.type === 'ellipse' ? s.center[0] : 0
      const ly = s.type === 'line' ? s.start[1] : s.type === 'ellipse' ? s.center[1] : 0
      const [lpx, lpy] = worldToCanvas(lx, ly)
      ctx.fillStyle = color
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(node.name, lpx + 8, lpy - 8)
    }
  })
}

/** Draw a single filled arrowhead at position (ax, ay) pointing in direction `angle` */
function drawArrowHead(ctx: CanvasRenderingContext2D, ax: number, ay: number, angle: number, color: string, size: number) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(ax + Math.cos(angle) * size,              ay + Math.sin(angle) * size)
  ctx.lineTo(ax + Math.cos(angle + 2.4) * size * 0.55, ay + Math.sin(angle + 2.4) * size * 0.55)
  ctx.lineTo(ax + Math.cos(angle - 2.4) * size * 0.55, ay + Math.sin(angle - 2.4) * size * 0.55)
  ctx.closePath()
  ctx.fill()
}

/** Place arrows every ARROW_SPACING px along a straight segment */
function drawArrowsAlongLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, lw: number) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len < ARROW_SPACING) return
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const count = Math.floor(len / ARROW_SPACING)
  const step = len / (count + 1)
  for (let i = 1; i <= count; i++) {
    const t = (i * step) / len
    drawArrowHead(ctx, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, angle, color, 7 + lw)
  }
}

/** Place arrows every ARROW_SPACING px along an ellipse */
function drawArrowsAlongEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, lw: number) {
  // Approximate perimeter via Ramanujan
  const a = Math.max(rx, ry), b = Math.min(rx, ry)
  const h = ((a - b) / (a + b)) ** 2
  const perim = Math.PI * (a + b) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h)))
  if (perim < ARROW_SPACING) return
  const count = Math.max(1, Math.floor(perim / ARROW_SPACING))
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const angle = 2 * Math.PI * t
    const px = cx + rx * Math.cos(angle)
    const py = cy + ry * Math.sin(angle)
    // Tangent direction at t: derivative of (cx+rx*cos, cy+ry*sin) → (-rx*sin, ry*cos)
    const tangent = Math.atan2(ry * Math.cos(angle), -rx * Math.sin(angle))
    drawArrowHead(ctx, px, py, tangent, color, 7 + lw)
  }
}

/** Place arrows every ARROW_SPACING px along an arbitrary polyline (canvas coords) */
function drawArrowsAlongPath(ctx: CanvasRenderingContext2D, pts: [number, number][], color: string, lw: number) {
  // Compute cumulative arc lengths
  const cumLen: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    cumLen.push(cumLen[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  }
  const total = cumLen[cumLen.length - 1]
  if (total < ARROW_SPACING) return
  const count = Math.floor(total / ARROW_SPACING)
  for (let k = 1; k <= count; k++) {
    const target = (k / (count + 1)) * total
    // Find segment containing target
    let i = 1
    while (i < cumLen.length - 1 && cumLen[i] < target) i++
    const segLen = cumLen[i] - cumLen[i - 1]
    const t = segLen > 0 ? (target - cumLen[i - 1]) / segLen : 0
    const px = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t
    const py = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t
    const angle = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])
    drawArrowHead(ctx, px, py, angle, color, 7 + lw)
  }
}

function drawPolylinePreview(ctx: CanvasRenderingContext2D) {
  const pts = polylinePoints.value
  if (pts.length === 0) return

  ctx.strokeStyle = '#89b4fa'
  ctx.lineWidth = 1.5

  // Committed segments so far
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = worldToCanvas(pts[i][0], pts[i][1])
    const [x2, y2] = worldToCanvas(pts[i + 1][0], pts[i + 1][1])
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  }

  // Ghost to mouse
  if (hover.value) {
    const [x1, y1] = worldToCanvas(pts[pts.length - 1][0], pts[pts.length - 1][1])
    const [x2, y2] = worldToCanvas(hover.value[0], hover.value[1])
    ctx.setLineDash([5, 4])
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    ctx.setLineDash([])
  }

  // Dots on each committed point
  for (const pt of pts) {
    const [px, py] = worldToCanvas(pt[0], pt[1])
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#89b4fa'; ctx.fill()
  }
}

function drawEllipsePreview(ctx: CanvasRenderingContext2D) {
  const drag = ellipseDrag.value
  if (!drag) return
  const [cpx, cpy] = worldToCanvas(drag.center[0], drag.center[1])
  const [ex] = worldToCanvas(drag.current[0], drag.center[1])
  const [, ey] = worldToCanvas(drag.center[0], drag.current[1])
  const rx = Math.abs(ex - cpx)
  const ry = Math.abs(ey - cpy)
  ctx.strokeStyle = '#89b4fa'
  ctx.lineWidth = 1.5
  if (rx > 1 && ry > 1) {
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.ellipse(cpx, cpy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    // radii lines
    ctx.strokeStyle = '#45475a'
    ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(cpx, cpy); ctx.lineTo(ex, cpy); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cpx, cpy); ctx.lineTo(cpx, ey); ctx.stroke()
    // labels
    const wx = Math.abs(drag.current[0] - drag.center[0])
    const wy = Math.abs(drag.current[1] - drag.center[1])
    ctx.fillStyle = '#a6adc8'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`rx=${Math.round(wx)}`, (cpx + ex) / 2, cpy - 5)
    ctx.textAlign = 'left'
    ctx.fillText(`ry=${Math.round(wy)}`, cpx + 4, (cpy + ey) / 2)
  }
  ctx.beginPath(); ctx.arc(cpx, cpy, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#89b4fa'; ctx.fill()
}

function drawMeasure(ctx: CanvasRenderingContext2D) {
  const ms = measureState.value
  // Draw live ghost from anchor to mouse when not locked yet
  const current = ms?.locked ? ms.current : (hover.value ?? ms?.current ?? null)
  const liveAnchor = ms?.anchor ?? null

  if (!liveAnchor || !current) {
    // No measurement yet — draw crosshair snap dot on hover in measure mode
    if (editorStore.activeTool === 'measure' && hover.value) {
      const [hx, hy] = worldToCanvas(hover.value[0], hover.value[1])
      ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 1.5; ctx.stroke()
    }
    return
  }

  const [ax, ay] = worldToCanvas(liveAnchor[0], liveAnchor[1])
  const [bx, by] = worldToCanvas(current[0], current[1])
  const dist = Math.hypot(current[0] - liveAnchor[0], current[1] - liveAnchor[1])
  const locked = ms?.locked ?? false

  // Main line
  ctx.strokeStyle = '#ffe600'
  ctx.lineWidth = locked ? 2 : 1.5
  ctx.setLineDash(locked ? [] : [6, 4])
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
  ctx.setLineDash([])

  // End ticks (perpendicular to line)
  const len = Math.hypot(bx - ax, by - ay)
  if (len > 4) {
    const nx = -(by - ay) / len * 8
    const ny =  (bx - ax) / len * 8
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(ax + nx, ay + ny); ctx.lineTo(ax - nx, ay - ny); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(bx + nx, by + ny); ctx.lineTo(bx - nx, by - ny); ctx.stroke()
  }

  // Anchor dot
  ctx.beginPath(); ctx.arc(ax, ay, 4, 0, Math.PI * 2)
  ctx.fillStyle = '#ffe600'; ctx.fill()

  // Current dot
  ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2)
  ctx.fillStyle = locked ? '#ffe600' : '#fff'
  ctx.fill()

  // Distance label
  const midX = (ax + bx) / 2
  const midY = (ay + by) / 2
  const label = `${dist.toFixed(1)} u`
  ctx.font = 'bold 13px monospace'
  const tw = ctx.measureText(label).width
  ctx.fillStyle = 'rgba(24,24,37,0.8)'
  ctx.fillRect(midX - tw / 2 - 5, midY - 11, tw + 10, 17)
  ctx.fillStyle = '#ffe600'
  ctx.textAlign = 'center'
  ctx.fillText(label, midX, midY + 4)

  // dx / dy annotation when locked
  if (locked && len > 20) {
    const dx = Math.abs(current[0] - liveAnchor[0])
    const dy = Math.abs(current[1] - liveAnchor[1])
    ctx.font = '10px monospace'
    ctx.fillStyle = '#a6adc8'
    ctx.textAlign = 'left'
    ctx.fillText(`Δx=${dx.toFixed(1)}  Δy=${dy.toFixed(1)}`, midX + 8, midY + 20)
  }
}

function drawScaleCalibrate(ctx: CanvasRenderingContext2D) {
  const ms = scaleCalibrateState.value
  const liveAnchor = ms?.anchor ?? null
  const current = ms
    ? (ms.locked ? ms.current : (hover.value ?? ms.current))
    : null

  if (!liveAnchor || !current) {
    // Cursor dot when hovering with no segment yet
    if (editorStore.activeTool === 'scale-calibrate' && hover.value) {
      const [hx, hy] = worldToCanvas(hover.value[0], hover.value[1])
      ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2)
      ctx.strokeStyle = '#00bfff'; ctx.lineWidth = 1.5; ctx.stroke()
    }
    return
  }

  const [ax, ay] = worldToCanvas(liveAnchor[0], liveAnchor[1])
  const [bx, by] = worldToCanvas(current[0], current[1])
  const dist = Math.hypot(current[0] - liveAnchor[0], current[1] - liveAnchor[1])
  const locked = ms?.locked ?? false
  const len = Math.hypot(bx - ax, by - ay)

  // Main line
  ctx.strokeStyle = '#00bfff'
  ctx.lineWidth = locked ? 2.5 : 1.5
  ctx.setLineDash(locked ? [] : [6, 4])
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
  ctx.setLineDash([])

  // End ticks
  if (len > 4) {
    const nx = -(by - ay) / len * 10
    const ny =  (bx - ax) / len * 10
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(ax + nx, ay + ny); ctx.lineTo(ax - nx, ay - ny); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(bx + nx, by + ny); ctx.lineTo(bx - nx, by - ny); ctx.stroke()
  }

  // Anchor dot
  ctx.beginPath(); ctx.arc(ax, ay, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#00bfff'; ctx.fill()

  // End dot
  ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2)
  ctx.fillStyle = locked ? '#00bfff' : '#ffffff'
  ctx.fill()

  // Distance label (world units)
  if (!locked) {
    const midX = (ax + bx) / 2
    const midY = (ay + by) / 2
    const label = `${dist.toFixed(1)} u`
    ctx.font = 'bold 13px monospace'
    const tw = ctx.measureText(label).width
    ctx.fillStyle = 'rgba(24,24,37,0.85)'
    ctx.fillRect(midX - tw / 2 - 5, midY - 11, tw + 10, 17)
    ctx.fillStyle = '#00bfff'
    ctx.textAlign = 'center'
    ctx.fillText(label, midX, midY + 4)
  }

  // When locked, draw dashed outline around the segment to invite the user to the overlay
  if (locked && len > 4) {
    ctx.strokeStyle = '#00bfff'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.globalAlpha = 0.4
    ctx.beginPath()
    const pad = 12
    const nx = -(by - ay) / len * pad
    const ny =  (bx - ax) / len * pad
    ctx.ellipse((ax + bx) / 2, (ay + by) / 2, len / 2 + pad, pad, Math.atan2(by - ay, bx - ax), 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.setLineDash([])
    void nx; void ny
  }
}

// Watch and redraw
watch(
  [() => problemStore.draft, canvasW, canvasH, hover, polylinePoints, ellipseDrag,
    () => editorStore.selected, () => editorStore.imageWorldBounds, hoveredHandle, regionDrag,
    measureState, scaleCalibrateState],
  () => draw(),
  { deep: true }
)

// ─── Event handlers ───────────────────────────────────────────────────────────

function getCanvasPos(e: MouseEvent): [number, number] {
  const rect = canvasRef.value!.getBoundingClientRect()
  return [
    (e.clientX - rect.left) * (canvasW.value / rect.width),
    (e.clientY - rect.top) * (canvasH.value / rect.height),
  ]
}

function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  wrapperRef.value?.focus()
  const [cx, cy] = getCanvasPos(e)
  const [wx, wy] = canvasToWorld(cx, cy)
  const tool = editorStore.activeTool

  // Region resize — always available, regardless of active tool
  const rh = hitTestRegionHandle(cx, cy)
  if (rh) {
    regionDrag.value = { handle: rh }
    return
  }

  if (tool === 'select') {
    if (hitSink(cx, cy)) {
      editorStore.setSelected({ type: 'sink' })
      dragState.value = { type: 'sink', downCanvas: [cx, cy], originalPos: [problemStore.draft.sink!.x, problemStore.draft.sink!.y], moved: false }
      return
    }
    const cid = hitCandidate(cx, cy)
    if (cid) {
      const c = problemStore.draft.candidates.find(c => c.id === cid)!
      editorStore.setSelected({ type: 'candidate', id: cid })
      dragState.value = { type: 'candidate', id: cid, downCanvas: [cx, cy], originalPos: [c.x, c.y], moved: false }
      return
    }
    editorStore.setSelected(null)
    dragState.value = null
  }

  if (tool === 'draw-ellipse' && editorStore.activeNodeId) {
    ellipseDrag.value = { center: [snap(wx), snap(wy)], current: [wx, wy] }
  }

  if (tool === 'measure') {
    // If already locked, a new mousedown starts fresh
    measureState.value = { anchor: [wx, wy], current: [wx, wy], locked: false }
  }

  if (tool === 'scale-calibrate' && !scaleCalibrateState.value?.locked) {
    scaleCalibrateState.value = { anchor: [wx, wy], current: [wx, wy], locked: false }
  }
}

function handleMouseMove(e: MouseEvent) {
  const [cx, cy] = getCanvasPos(e)
  const [wx, wy] = canvasToWorld(cx, cy)
  hover.value = [wx, wy]

  // Region drag
  if (regionDrag.value) {
    applyRegionDrag(regionDrag.value.handle, wx, wy)
    return
  }

  // Update hovered handle for cursor + visual feedback
  hoveredHandle.value = hitTestRegionHandle(cx, cy)

  if (dragState.value) {
    const ds = dragState.value
    const { scale } = viewport.value
    const dx = (cx - ds.downCanvas[0]) / scale
    const dy = -(cy - ds.downCanvas[1]) / scale  // flip Y
    if (!ds.moved && Math.hypot(dx, dy) > 2) ds.moved = true
    if (ds.moved) {
      const nx = snap(ds.originalPos[0] + dx)
      const ny = snap(ds.originalPos[1] + dy)
      if (ds.type === 'sink') problemStore.setSink({ x: nx, y: ny })
      else if (ds.type === 'candidate' && ds.id) problemStore.moveCandidate(ds.id, nx, ny)
    }
  }

  if (ellipseDrag.value) {
    ellipseDrag.value = { ...ellipseDrag.value, current: [wx, wy] }
  }

  if (measureState.value && !measureState.value.locked) {
    measureState.value = { ...measureState.value, current: [wx, wy] }
  }

  if (scaleCalibrateState.value && !scaleCalibrateState.value.locked) {
    scaleCalibrateState.value = { ...scaleCalibrateState.value, current: [wx, wy] }
  }
}

function handleMouseUp(e: MouseEvent) {
  if (e.button !== 0) return

  // Finish region resize
  if (regionDrag.value) {
    regionDrag.value = null
    return
  }

  // Finish drag — do NOT add a segment
  if (dragState.value) {
    dragState.value = null
    return
  }

  // Finish ellipse drag
  if (ellipseDrag.value && editorStore.activeTool === 'draw-ellipse') {
    const { center, current } = ellipseDrag.value
    const rxW = Math.abs(snap(current[0]) - center[0])
    const ryW = Math.abs(snap(current[1]) - center[1])
    if (rxW > 1 && ryW > 1 && editorStore.activeNodeId) {
      problemStore.addSegmentToNode(editorStore.activeNodeId, {
        type: 'ellipse', center, radiusX: rxW, radiusY: ryW,
      })
    }
    ellipseDrag.value = null
    return
  }

  // Lock tape measure on mouse-up
  if (measureState.value && !measureState.value.locked) {
    const [cx2, cy2] = getCanvasPos(e)
    const [wx2, wy2] = canvasToWorld(cx2, cy2)
    measureState.value = { ...measureState.value, current: [wx2, wy2], locked: true }
    return
  }

  // Lock scale calibration on mouse-up
  if (scaleCalibrateState.value && !scaleCalibrateState.value.locked) {
    const [cx2, cy2] = getCanvasPos(e)
    const [wx2, wy2] = canvasToWorld(cx2, cy2)
    scaleCalibrateState.value = { ...scaleCalibrateState.value, current: [wx2, wy2], locked: true }
    return
  }

  // Single-click placement tools
  if (suppressNextClick) { suppressNextClick = false; return }
  const [cx, cy] = getCanvasPos(e)
  const [wx, wy] = canvasToWorld(cx, cy)
  const tool = editorStore.activeTool

  if (tool === 'place-sink') {
    problemStore.setSink({ x: snap(wx), y: snap(wy) })
  } else if (tool === 'place-candidate') {
    problemStore.addCandidate(snap(wx), snap(wy))
  } else if (tool === 'draw-line' && editorStore.activeNodeId) {
    const pt: [number, number] = [snap(wx), snap(wy)]
    const prev = polylinePoints.value
    if (prev.length > 0) {
      // Commit segment from last point to this one
      problemStore.addSegmentToNode(editorStore.activeNodeId, {
        type: 'line',
        start: prev[prev.length - 1],
        end: pt,
      })
    }
    polylinePoints.value = [...prev, pt]
  }
}

function handleDblClick(_e: MouseEvent) {
  if (editorStore.activeTool === 'draw-line' && polylinePoints.value.length > 0) {
    // Remove the extra segment added by the second click of the double-click
    if (editorStore.activeNodeId) {
      problemStore.removeLastSegmentFromNode(editorStore.activeNodeId)
    }
    polylinePoints.value = []
    suppressNextClick = true
  }
}

function handleRightClick(e: MouseEvent) {
  const [cx, cy] = getCanvasPos(e)
  const tool = editorStore.activeTool

  if (tool === 'draw-line' && polylinePoints.value.length > 0) {
    polylinePoints.value = []
    return
  }

  // Remove element under cursor
  const cid = hitCandidate(cx, cy)
  if (cid) {
    problemStore.removeCandidate(cid)
    editorStore.setSelected(null)
    return
  }
  if (hitSink(cx, cy)) {
    problemStore.setSink(null)
    editorStore.setSelected(null)
  }
}

function handleMouseLeave() {
  hover.value = null
}

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    polylinePoints.value = []
    ellipseDrag.value = null
    dragState.value = null
    regionDrag.value = null
    measureState.value = null
    cancelScaleCalibration()
    editorStore.setSelected(null)
    e.preventDefault()
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputTarget(e)) {
    const sel = editorStore.selected
    if (sel?.type === 'sink') { problemStore.setSink(null); editorStore.setSelected(null) }
    else if (sel?.type === 'candidate') { problemStore.removeCandidate(sel.id); editorStore.setSelected(null) }
    e.preventDefault()
  }

  if (!e.ctrlKey && !e.metaKey && !isInputTarget(e)) {
    const map: Record<string, typeof editorStore.activeTool> = {
      's': 'select', 'k': 'place-sink', 'c': 'place-candidate', 'l': 'draw-line', 'e': 'draw-ellipse', 'm': 'measure', 'r': 'scale-calibrate',
    }
    const t = map[e.key.toLowerCase()]
    if (t) {
      editorStore.setTool(t)
      polylinePoints.value = []
      ellipseDrag.value = null
      measureState.value = null
      cancelScaleCalibration()
    }
  }
}

function isInputTarget(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
</script>

<style scoped>
.canvas-wrapper {
  position: relative;
  flex: 1;
  background: #181825;
  overflow: hidden;
  outline: none;
}
canvas { display: block; width: 100%; height: 100%; }
.coords {
  position: absolute;
  bottom: 8px; right: 12px;
  font-size: 11px; color: #a6adc8;
  background: #1e1e2e99;
  padding: 2px 8px; border-radius: 4px;
  pointer-events: none; font-family: monospace;
}
.tool-hint {
  position: absolute;
  bottom: 8px; left: 12px;
  font-size: 11px; color: #6c7086;
  background: #1e1e2e99;
  padding: 2px 8px; border-radius: 4px;
  pointer-events: none;
  max-width: calc(100% - 160px);
}
.tool-hint.warn { color: #fab387; }

/* Scale calibration input overlay */
.scale-input-overlay {
  position: absolute;
  transform: translateX(-50%);
  background: #1e1e2e;
  border: 1.5px solid #00bfff;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 220px;
  box-shadow: 0 4px 20px rgba(0, 191, 255, 0.25);
  z-index: 10;
}
.scale-label { font-size: 11px; color: #a6adc8; }
.scale-dist-hint { font-size: 10px; color: #6c7086; font-family: monospace; }
.scale-input-overlay input {
  padding: 5px 7px;
  border: 1px solid #00bfff;
  background: #313244;
  color: #cdd6f4;
  border-radius: 4px;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
}
.scale-btns { display: flex; gap: 6px; }
.scale-btns button { flex: 1; padding: 5px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; }
.scale-btns .apply  { background: #00bfff; color: #1e1e2e; }
.scale-btns .cancel { background: #313244; color: #cdd6f4; border: 1px solid #45475a; }
</style>
