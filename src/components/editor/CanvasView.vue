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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
  const t = editorStore.activeTool
  if (t === 'select') return dragState.value?.moved ? 'grabbing' : 'default'
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
  const hints: Record<string, string> = {
    'select': 'Clique para selecionar · arraste para mover · Del para remover · clique direito para remover',
    'place-sink': 'Clique para posicionar o sink  [K]',
    'place-candidate': 'Clique para adicionar candidato  [C]  ·  clique direito para remover',
  }
  return hints[t] ?? ''
})

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
  ctx.strokeStyle = '#89b4fa'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  ctx.strokeRect(px1, py1, px2 - px1, py2 - py1)
  ctx.setLineDash([])
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

const ROUTE_COLORS = ['#cba6f7', '#fab387', '#f9e2af', '#a6e3a1', '#89dceb', '#89b4fa']

function drawMobileRoutes(ctx: CanvasRenderingContext2D) {
  problemStore.draft.mobileNodes.forEach((node, ni) => {
    const color = ROUTE_COLORS[ni % ROUTE_COLORS.length]
    const isActive = editorStore.activeNodeId === node.id
    ctx.strokeStyle = color
    ctx.lineWidth = isActive ? 2.5 : 1.5

    for (const seg of node.segments) {
      if (seg.type === 'line') {
        const [px1, py1] = worldToCanvas(seg.start[0], seg.start[1])
        const [px2, py2] = worldToCanvas(seg.end[0], seg.end[1])
        ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke()
        drawArrow(ctx, px1, py1, px2, py2, color)
      } else if (seg.type === 'ellipse') {
        const [cpx, cpy] = worldToCanvas(seg.center[0], seg.center[1])
        const [ex] = worldToCanvas(seg.center[0] + seg.radiusX, seg.center[1])
        const [, ey] = worldToCanvas(seg.center[0], seg.center[1] + seg.radiusY)
        ctx.beginPath()
        ctx.ellipse(cpx, cpy, Math.abs(ex - cpx), Math.abs(ey - cpy), 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath(); ctx.arc(cpx, cpy, 3, 0, Math.PI * 2)
        ctx.fillStyle = color; ctx.fill()
      } else if (seg.type === 'custom') {
        const pts = sampleCustomSegment(seg.exprX, seg.exprY, 80)
        if (pts && pts.length > 1) {
          ctx.beginPath()
          const [px0, py0] = worldToCanvas(pts[0][0], pts[0][1])
          ctx.moveTo(px0, py0)
          for (let i = 1; i < pts.length; i++) {
            const [px, py] = worldToCanvas(pts[i][0], pts[i][1])
            ctx.lineTo(px, py)
          }
          ctx.stroke()
          drawArrow(ctx, px0, py0, ...worldToCanvas(pts[pts.length - 1][0], pts[pts.length - 1][1]), color)
        } else {
          // Expression error — draw a warning indicator
          ctx.fillStyle = '#f38ba8'
          ctx.font = '11px monospace'
          ctx.textAlign = 'left'
          ctx.fillText('⚠ expr', viewport.value.offX + 4, viewport.value.offY + 14)
        }
      }
    }

    // Node label at first segment start
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

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  if (Math.hypot(x2 - x1, y2 - y1) < 20) return
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const s = 7
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(mx + Math.cos(angle) * s, my + Math.sin(angle) * s)
  ctx.lineTo(mx + Math.cos(angle + 2.5) * s * 0.5, my + Math.sin(angle + 2.5) * s * 0.5)
  ctx.lineTo(mx + Math.cos(angle - 2.5) * s * 0.5, my + Math.sin(angle - 2.5) * s * 0.5)
  ctx.closePath(); ctx.fill()
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

// Watch and redraw
watch(
  [() => problemStore.draft, canvasW, canvasH, hover, polylinePoints, ellipseDrag,
    () => editorStore.selected, () => editorStore.imageWorldBounds],
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
}

function handleMouseMove(e: MouseEvent) {
  const [cx, cy] = getCanvasPos(e)
  const [wx, wy] = canvasToWorld(cx, cy)
  hover.value = [wx, wy]

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
}

function handleMouseUp(e: MouseEvent) {
  if (e.button !== 0) return

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
      's': 'select', 'k': 'place-sink', 'c': 'place-candidate', 'l': 'draw-line', 'e': 'draw-ellipse',
    }
    const t = map[e.key.toLowerCase()]
    if (t) {
      editorStore.setTool(t)
      polylinePoints.value = []
      ellipseDrag.value = null
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
</style>
