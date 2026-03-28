<template>
  <div class="canvas-wrapper" ref="wrapperRef" tabindex="0" @keydown="handleKey">
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
      {{ fmt(hover[0]) }}, {{ fmt(hover[1]) }}
    </div>
    <div class="tool-hint">{{ toolHint }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useProblemStore } from '../../stores/problemStore'
import { useEditorStore } from '../../stores/editorStore'
import type { Region } from '../../models/problem'

const problemStore = useProblemStore()
const editorStore = useEditorStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const canvasW = ref(800)
const canvasH = ref(600)
const hover = ref<[number, number] | null>(null)

// ─── Drawing interaction state ────────────────────────────────────────────────

// Polyline: list of committed points. Each consecutive pair is a segment.
// When tool changes away or user finishes, segments are committed.
const polylinePoints = ref<[number, number][]>([])

// Ellipse drag state
const ellipseDrag = ref<{ center: [number, number]; current: [number, number] } | null>(null)

// Select/drag state
const dragState = ref<{
  type: 'sink' | 'candidate'
  id?: string
  startWorld: [number, number]
  originalPos: [number, number]
  dragging: boolean
} | null>(null)

// ─── Cached background image ──────────────────────────────────────────────────
let bgImage: HTMLImageElement | null = null
watch(() => editorStore.backgroundImage, (src) => {
  if (!src) { bgImage = null; return }
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
  wrapperRef.value?.focus()
})
onUnmounted(() => ro?.disconnect())

// ─── Coordinate transforms ────────────────────────────────────────────────────
const region = computed<Region>(() => problemStore.draft.region)
const MARGIN = 40

function worldToCanvas(wx: number, wy: number): [number, number] {
  const [xmin, ymin, xmax, ymax] = region.value
  const pw = canvasW.value - MARGIN * 2
  const ph = canvasH.value - MARGIN * 2
  return [
    MARGIN + ((wx - xmin) / (xmax - xmin)) * pw,
    MARGIN + ((ymax - wy) / (ymax - ymin)) * ph,
  ]
}

function canvasToWorld(cx: number, cy: number): [number, number] {
  const [xmin, ymin, xmax, ymax] = region.value
  const pw = canvasW.value - MARGIN * 2
  const ph = canvasH.value - MARGIN * 2
  return [
    xmin + ((cx - MARGIN) / pw) * (xmax - xmin),
    ymax - ((cy - MARGIN) / ph) * (ymax - ymin),
  ]
}

function fmt(v: number) { return v.toFixed(1) }
function snap(v: number) { return Math.round(v) }

// ─── Hit testing ──────────────────────────────────────────────────────────────

const HIT_RADIUS = 10 // pixels

function hitTestSink(cx: number, cy: number): boolean {
  const sink = problemStore.draft.sink
  if (!sink) return false
  const [px, py] = worldToCanvas(sink.x, sink.y)
  return Math.hypot(cx - px, cy - py) <= HIT_RADIUS
}

function hitTestCandidate(cx: number, cy: number): string | null {
  for (const c of problemStore.draft.candidates) {
    const [px, py] = worldToCanvas(c.x, c.y)
    if (Math.hypot(cx - px, cy - py) <= HIT_RADIUS) return c.id
  }
  return null
}

// ─── Tool state ───────────────────────────────────────────────────────────────

const canvasCursor = computed(() => {
  const tool = editorStore.activeTool
  if (tool === 'select') return dragState.value?.dragging ? 'grabbing' : 'default'
  return 'crosshair'
})

const toolHint = computed(() => {
  const tool = editorStore.activeTool
  if (tool === 'draw-line') {
    if (!editorStore.activeNodeId) return 'Select a mobile node first'
    if (polylinePoints.value.length === 0) return 'Click to start polyline — right-click or Esc to finish'
    return `${polylinePoints.value.length} point(s) — click to continue, right-click or double-click to finish`
  }
  if (tool === 'draw-ellipse') {
    if (!editorStore.activeNodeId) return 'Select a mobile node first'
    return ellipseDrag.value ? 'Release to commit ellipse' : 'Drag to define ellipse'
  }
  const hints: Record<string, string> = {
    'select': 'Click to select, drag to move elements',
    'place-sink': 'Click to place the sink',
    'place-candidate': 'Click to add a candidate — right-click to remove',
  }
  return hints[tool] ?? ''
})

// ─── Draw ─────────────────────────────────────────────────────────────────────

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvasW.value, canvasH.value)

  if (bgImage) {
    const [px1, py1] = worldToCanvas(region.value[0], region.value[3])
    const [px2, py2] = worldToCanvas(region.value[2], region.value[1])
    ctx.globalAlpha = 0.6
    ctx.drawImage(bgImage, px1, py1, px2 - px1, py2 - py1)
    ctx.globalAlpha = 1
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
  const [xmin, ymin, xmax, ymax] = region.value
  const span = xmax - xmin
  const step = Math.pow(10, Math.floor(Math.log10(span / 5)))
  ctx.strokeStyle = '#2a2a3e'
  ctx.lineWidth = 0.5
  for (let x = Math.ceil(xmin / step) * step; x <= xmax + 1e-9; x += step) {
    const [px] = worldToCanvas(x, 0)
    const [, py1] = worldToCanvas(0, ymin); const [, py2] = worldToCanvas(0, ymax)
    ctx.beginPath(); ctx.moveTo(px, py1); ctx.lineTo(px, py2); ctx.stroke()
  }
  for (let y = Math.ceil(ymin / step) * step; y <= ymax + 1e-9; y += step) {
    const [, py] = worldToCanvas(0, y)
    const [px1] = worldToCanvas(xmin, 0); const [px2] = worldToCanvas(xmax, 0)
    ctx.beginPath(); ctx.moveTo(px1, py); ctx.lineTo(px2, py); ctx.stroke()
  }
  ctx.strokeStyle = '#45475a'
  ctx.lineWidth = 1
  if (0 >= xmin && 0 <= xmax) {
    const [px] = worldToCanvas(0, 0)
    const [, py1] = worldToCanvas(0, ymin); const [, py2] = worldToCanvas(0, ymax)
    ctx.beginPath(); ctx.moveTo(px, py1); ctx.lineTo(px, py2); ctx.stroke()
  }
  if (0 >= ymin && 0 <= ymax) {
    const [, py] = worldToCanvas(0, 0)
    const [px1] = worldToCanvas(xmin, 0); const [px2] = worldToCanvas(xmax, 0)
    ctx.beginPath(); ctx.moveTo(px1, py); ctx.lineTo(px2, py); ctx.stroke()
  }
}

function drawRegionBorder(ctx: CanvasRenderingContext2D) {
  const [xmin, ymin, xmax, ymax] = region.value
  const [px1, py1] = worldToCanvas(xmin, ymax)
  const [px2, py2] = worldToCanvas(xmax, ymin)
  ctx.strokeStyle = '#89b4fa'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.strokeRect(px1, py1, px2 - px1, py2 - py1)
  ctx.setLineDash([])
}

function drawCandidates(ctx: CanvasRenderingContext2D) {
  const sel = editorStore.selected
  for (const c of problemStore.draft.candidates) {
    const [px, py] = worldToCanvas(c.x, c.y)
    const isSelected = sel?.type === 'candidate' && sel.id === c.id
    ctx.beginPath()
    ctx.arc(px, py, isSelected ? 7 : 5, 0, Math.PI * 2)
    ctx.fillStyle = '#a6e3a1'
    ctx.fill()
    ctx.strokeStyle = isSelected ? '#f9e2af' : '#1e1e2e'
    ctx.lineWidth = isSelected ? 2 : 1
    ctx.stroke()
  }
}

function drawSink(ctx: CanvasRenderingContext2D) {
  const sink = problemStore.draft.sink
  if (!sink) return
  const [px, py] = worldToCanvas(sink.x, sink.y)
  const isSelected = editorStore.selected?.type === 'sink'
  ctx.strokeStyle = isSelected ? '#f9e2af' : '#f38ba8'
  ctx.lineWidth = isSelected ? 3 : 2.5
  const r = isSelected ? 11 : 9
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
        // center dot
        ctx.beginPath(); ctx.arc(cpx, cpy, 3, 0, Math.PI * 2)
        ctx.fillStyle = color; ctx.fill()
      }
    }

    if (node.segments.length > 0) {
      const s = node.segments[0]
      const lx = s.type === 'line' ? s.start[0] : s.type === 'ellipse' ? s.center[0] : 0
      const ly = s.type === 'line' ? s.start[1] : s.type === 'ellipse' ? s.center[1] : 0
      const [lpx, lpy] = worldToCanvas(lx, ly)
      ctx.fillStyle = color
      ctx.font = 'bold 11px monospace'
      ctx.fillText(node.name, lpx + 8, lpy - 8)
    }
  })
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 20) return
  const angle = Math.atan2(dy, dx)
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const s = 7
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(mx + Math.cos(angle) * s, my + Math.sin(angle) * s)
  ctx.lineTo(mx + Math.cos(angle + 2.5) * s * 0.5, my + Math.sin(angle + 2.5) * s * 0.5)
  ctx.lineTo(mx + Math.cos(angle - 2.5) * s * 0.5, my + Math.sin(angle - 2.5) * s * 0.5)
  ctx.closePath()
  ctx.fill()
}

function drawPolylinePreview(ctx: CanvasRenderingContext2D) {
  const pts = polylinePoints.value
  if (pts.length === 0) return
  // Draw committed points and segments of current polyline
  ctx.strokeStyle = '#89b4fa'
  ctx.lineWidth = 1.5
  for (let i = 0; i < pts.length - 1; i++) {
    const [px1, py1] = worldToCanvas(pts[i][0], pts[i][1])
    const [px2, py2] = worldToCanvas(pts[i + 1][0], pts[i + 1][1])
    ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke()
  }
  // Ghost line from last point to hover
  if (hover.value) {
    const [px1, py1] = worldToCanvas(pts[pts.length - 1][0], pts[pts.length - 1][1])
    const [px2, py2] = worldToCanvas(hover.value[0], hover.value[1])
    ctx.setLineDash([5, 4])
    ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke()
    ctx.setLineDash([])
  }
  // Draw all points as dots
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
  const [cur] = worldToCanvas(drag.current[0], drag.current[1])
  const [, cury] = worldToCanvas(drag.center[0], drag.current[1])
  const rx = Math.abs(cur - cpx)
  const ry = Math.abs(cury - cpy)
  ctx.strokeStyle = '#89b4fa'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  if (rx > 0 && ry > 0) {
    ctx.beginPath()
    ctx.ellipse(cpx, cpy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.setLineDash([])
  // Center dot
  ctx.beginPath(); ctx.arc(cpx, cpy, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#89b4fa'; ctx.fill()
  // Bounding box
  ctx.strokeStyle = '#45475a'
  ctx.lineWidth = 0.5
  ctx.strokeRect(cpx - rx, cpy - ry, rx * 2, ry * 2)
}

// Watch state changes
watch(
  [() => problemStore.draft, canvasW, canvasH, hover, polylinePoints, ellipseDrag,
    () => editorStore.selected],
  () => draw(),
  { deep: true }
)

// ─── Interaction ──────────────────────────────────────────────────────────────

function getCanvasPos(e: MouseEvent): [number, number] {
  const rect = canvasRef.value!.getBoundingClientRect()
  const scaleX = canvasW.value / rect.width
  const scaleY = canvasH.value / rect.height
  return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY]
}

function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  const [cx, cy] = getCanvasPos(e)
  const [wx, wy] = canvasToWorld(cx, cy)
  const tool = editorStore.activeTool

  if (tool === 'select') {
    // Check sink
    if (hitTestSink(cx, cy)) {
      const sink = problemStore.draft.sink!
      editorStore.setSelected({ type: 'sink' })
      dragState.value = { type: 'sink', startWorld: [wx, wy], originalPos: [sink.x, sink.y], dragging: false }
      return
    }
    // Check candidate
    const cid = hitTestCandidate(cx, cy)
    if (cid) {
      const c = problemStore.draft.candidates.find(c => c.id === cid)!
      editorStore.setSelected({ type: 'candidate', id: cid })
      dragState.value = { type: 'candidate', id: cid, startWorld: [wx, wy], originalPos: [c.x, c.y], dragging: false }
      return
    }
    editorStore.setSelected(null)
  }

  if (tool === 'draw-ellipse' && editorStore.activeNodeId) {
    ellipseDrag.value = { center: [snap(wx), snap(wy)], current: [wx, wy] }
  }
}

function handleMouseMove(e: MouseEvent) {
  const [cx, cy] = getCanvasPos(e)
  const [wx, wy] = canvasToWorld(cx, cy)
  hover.value = [wx, wy]

  // Drag elements
  if (dragState.value) {
    const ds = dragState.value
    const dx = wx - ds.startWorld[0]
    const dy = wy - ds.startWorld[1]
    if (!ds.dragging && Math.abs(dx) + Math.abs(dy) > 2) ds.dragging = true
    if (ds.dragging) {
      const nx = snap(ds.originalPos[0] + dx)
      const ny = snap(ds.originalPos[1] + dy)
      if (ds.type === 'sink') {
        problemStore.setSink({ x: nx, y: ny })
      } else if (ds.type === 'candidate' && ds.id) {
        problemStore.moveCandidate(ds.id, nx, ny)
      }
    }
  }

  // Ellipse drag
  if (ellipseDrag.value) {
    ellipseDrag.value = { ...ellipseDrag.value, current: [wx, wy] }
  }
}

function handleMouseUp(e: MouseEvent) {
  if (e.button !== 0) return
  const [cx, cy] = getCanvasPos(e) // cx unused for non-select tools but kept for consistency
  const [wx, wy] = canvasToWorld(cx, cy)
  const tool = editorStore.activeTool

  // Finish drag
  if (dragState.value) {
    dragState.value = null
    return
  }

  // Commit ellipse
  if (tool === 'draw-ellipse' && ellipseDrag.value) {
    const { center, current } = ellipseDrag.value
    const rxWorld = Math.abs(current[0] - center[0])
    const ryWorld = Math.abs(current[1] - center[1])
    if (rxWorld > 1 && ryWorld > 1 && editorStore.activeNodeId) {
      problemStore.addSegmentToNode(editorStore.activeNodeId, {
        type: 'ellipse',
        center,
        radiusX: snap(rxWorld),
        radiusY: snap(ryWorld),
      })
    }
    ellipseDrag.value = null
    return
  }

  // Polyline: add point
  if (tool === 'draw-line' && editorStore.activeNodeId) {
    const pt: [number, number] = [snap(wx), snap(wy)]
    polylinePoints.value = [...polylinePoints.value, pt]
    // If we now have ≥2 points, commit each new segment
    const pts = polylinePoints.value
    if (pts.length >= 2) {
      problemStore.addSegmentToNode(editorStore.activeNodeId, {
        type: 'line',
        start: pts[pts.length - 2],
        end: pts[pts.length - 1],
      })
    }
    return
  }

  // Single-click tools
  if (tool === 'place-sink') {
    problemStore.setSink({ x: snap(wx), y: snap(wy) })
  } else if (tool === 'place-candidate') {
    problemStore.addCandidate(snap(wx), snap(wy))
  }
}

function handleDblClick(_e: MouseEvent) {
  // Finish polyline on double-click
  if (editorStore.activeTool === 'draw-line' && polylinePoints.value.length > 0) {
    finishPolyline()
  }
}

function handleRightClick(e: MouseEvent) {
  const [cx, cy] = getCanvasPos(e)
  const tool = editorStore.activeTool

  // Finish polyline
  if (tool === 'draw-line') {
    finishPolyline()
    return
  }

  // Remove candidate under cursor
  if (tool === 'place-candidate' || tool === 'select') {
    const cid = hitTestCandidate(cx, cy)
    if (cid) {
      problemStore.removeCandidate(cid)
      editorStore.setSelected(null)
      return
    }
    if (hitTestSink(cx, cy)) {
      problemStore.setSink(null)
      editorStore.setSelected(null)
    }
  }
}

function handleMouseLeave() {
  hover.value = null
}

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (polylinePoints.value.length > 0) {
      polylinePoints.value = []
    }
    ellipseDrag.value = null
    dragState.value = null
    editorStore.setSelected(null)
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    const sel = editorStore.selected
    if (!sel) return
    if (sel.type === 'sink') {
      problemStore.setSink(null)
      editorStore.setSelected(null)
    } else if (sel.type === 'candidate') {
      problemStore.removeCandidate(sel.id)
      editorStore.setSelected(null)
    }
    e.preventDefault()
  }

  // Shortcut keys
  const keyTools: Record<string, typeof editorStore.activeTool> = {
    's': 'select',
    'k': 'place-sink',
    'c': 'place-candidate',
    'l': 'draw-line',
    'e': 'draw-ellipse',
  }
  if (keyTools[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
    editorStore.setTool(keyTools[e.key.toLowerCase()])
    polylinePoints.value = []
    ellipseDrag.value = null
  }
}

function finishPolyline() {
  // Remove last duplicated point from dblclick
  if (polylinePoints.value.length > 1) {
    const pts = polylinePoints.value
    const last = pts[pts.length - 1]
    const prev = pts[pts.length - 2]
    if (last[0] === prev[0] && last[1] === prev[1]) {
      // Remove duplicate caused by rapid click
      problemStore.removeLastSegmentFromNode(editorStore.activeNodeId!)
    }
  }
  polylinePoints.value = []
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
  bottom: 8px;
  right: 12px;
  font-size: 11px;
  color: #a6adc8;
  background: #1e1e2e99;
  padding: 2px 8px;
  border-radius: 4px;
  pointer-events: none;
  font-family: monospace;
}
.tool-hint {
  position: absolute;
  bottom: 8px;
  left: 12px;
  font-size: 11px;
  color: #6c7086;
  background: #1e1e2e99;
  padding: 2px 8px;
  border-radius: 4px;
  pointer-events: none;
}
</style>
