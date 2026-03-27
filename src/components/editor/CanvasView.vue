<template>
  <div class="canvas-wrapper" ref="wrapperRef">
    <canvas
      ref="canvasRef"
      :width="canvasW"
      :height="canvasH"
      @click="handleClick"
      @mousemove="handleMouseMove"
      @mouseleave="hover = null"
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

// Line drawing state
const lineStart = ref<[number, number] | null>(null)

const toolHints: Record<string, string> = {
  'select': 'Click to select elements',
  'place-sink': 'Click to place the sink',
  'place-candidate': 'Click to add a candidate node',
  'draw-line': lineStart.value ? 'Click to set end point' : 'Click to set start point',
  'draw-ellipse': 'Click to place ellipse center',
}

const toolHint = computed(() => {
  if (editorStore.activeTool === 'draw-line') {
    return lineStart.value ? 'Click to set end point' : 'Click to set start point'
  }
  return toolHints[editorStore.activeTool] ?? ''
})

// Resize observer
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

// World <-> canvas coordinate transforms
const region = computed<Region>(() => problemStore.draft.region)
const MARGIN = 40

function worldToCanvas(wx: number, wy: number): [number, number] {
  const [xmin, ymin, xmax, ymax] = region.value
  const pw = canvasW.value - MARGIN * 2
  const ph = canvasH.value - MARGIN * 2
  const px = MARGIN + ((wx - xmin) / (xmax - xmin)) * pw
  const py = MARGIN + ((ymax - wy) / (ymax - ymin)) * ph
  return [px, py]
}

function canvasToWorld(cx: number, cy: number): [number, number] {
  const [xmin, ymin, xmax, ymax] = region.value
  const pw = canvasW.value - MARGIN * 2
  const ph = canvasH.value - MARGIN * 2
  const wx = xmin + ((cx - MARGIN) / pw) * (xmax - xmin)
  const wy = ymax - ((cy - MARGIN) / ph) * (ymax - ymin)
  return [wx, wy]
}

function fmt(v: number) { return (Math.round(v * 10) / 10).toFixed(1) }

// ─── Drawing ─────────────────────────────────────────────────────────────────

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvasW.value, canvasH.value)
  drawBackground(ctx)
  drawGrid(ctx)
  drawRegionBorder(ctx)
  drawCandidates(ctx)
  drawSink(ctx)
  drawMobileRoutes(ctx)
  drawLinePreview(ctx)
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  if (!editorStore.backgroundImage) return
  const img = new Image()
  img.src = editorStore.backgroundImage
  const [px1, py1] = worldToCanvas(region.value[0], region.value[3])
  const [px2, py2] = worldToCanvas(region.value[2], region.value[1])
  const draw = () => ctx.drawImage(img, px1, py1, px2 - px1, py2 - py1)
  if (img.complete) draw()
  else img.onload = () => { draw(); drawOverlays(ctx) }
}

function drawOverlays(ctx: CanvasRenderingContext2D) {
  drawGrid(ctx)
  drawRegionBorder(ctx)
  drawCandidates(ctx)
  drawSink(ctx)
  drawMobileRoutes(ctx)
  drawLinePreview(ctx)
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  const [xmin, ymin, xmax, ymax] = region.value
  const span = xmax - xmin
  const step = Math.pow(10, Math.floor(Math.log10(span / 5)))
  ctx.strokeStyle = '#2a2a3e'
  ctx.lineWidth = 0.5
  for (let x = Math.ceil(xmin / step) * step; x <= xmax; x += step) {
    const [px] = worldToCanvas(x, 0)
    const [, py1] = worldToCanvas(x, ymin)
    const [, py2] = worldToCanvas(x, ymax)
    ctx.beginPath(); ctx.moveTo(px, py1); ctx.lineTo(px, py2); ctx.stroke()
  }
  for (let y = Math.ceil(ymin / step) * step; y <= ymax; y += step) {
    const [, py] = worldToCanvas(0, y)
    const [px1] = worldToCanvas(xmin, y)
    const [px2] = worldToCanvas(xmax, y)
    ctx.beginPath(); ctx.moveTo(px1, py); ctx.lineTo(px2, py); ctx.stroke()
  }
  // Axes
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
  for (const c of problemStore.draft.candidates) {
    const [px, py] = worldToCanvas(c.x, c.y)
    ctx.beginPath()
    ctx.arc(px, py, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#a6e3a1'
    ctx.fill()
    ctx.strokeStyle = '#1e1e2e'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function drawSink(ctx: CanvasRenderingContext2D) {
  const sink = problemStore.draft.sink
  if (!sink) return
  const [px, py] = worldToCanvas(sink.x, sink.y)
  ctx.strokeStyle = '#f38ba8'
  ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.moveTo(px - 9, py); ctx.lineTo(px + 9, py); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(px, py - 9); ctx.lineTo(px, py + 9); ctx.stroke()
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
      }
    }

    // Node label
    if (node.segments.length > 0) {
      const s = node.segments[0]
      const lx = s.type === 'line' ? s.start[0] : s.type === 'ellipse' ? s.center[0] : 0
      const ly = s.type === 'line' ? s.start[1] : s.type === 'ellipse' ? s.center[1] : 0
      const [lpx, lpy] = worldToCanvas(lx, ly)
      ctx.fillStyle = color
      ctx.font = '11px monospace'
      ctx.fillText(node.name, lpx + 6, lpy - 6)
    }
  })
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const s = 7
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(mx + Math.cos(angle) * s, my + Math.sin(angle) * s)
  ctx.lineTo(mx + Math.cos(angle + 2.5) * s * 0.5, my + Math.sin(angle + 2.5) * s * 0.5)
  ctx.lineTo(mx + Math.cos(angle - 2.5) * s * 0.5, my + Math.sin(angle - 2.5) * s * 0.5)
  ctx.closePath()
  ctx.fill()
}

function drawLinePreview(ctx: CanvasRenderingContext2D) {
  if (editorStore.activeTool !== 'draw-line' || !lineStart.value || !hover.value) return
  const [px1, py1] = worldToCanvas(lineStart.value[0], lineStart.value[1])
  const [px2, py2] = worldToCanvas(hover.value[0], hover.value[1])
  ctx.strokeStyle = '#89b4fa'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke()
  ctx.setLineDash([])
  // start dot
  ctx.beginPath(); ctx.arc(px1, py1, 4, 0, Math.PI * 2)
  ctx.fillStyle = '#89b4fa'; ctx.fill()
}

// Watch for state changes and redraw
watch(
  [() => problemStore.draft, () => editorStore.backgroundImage, canvasW, canvasH, hover, lineStart],
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

function snap(v: number): number {
  return Math.round(v)
}

function handleClick(e: MouseEvent) {
  const [cx, cy] = getCanvasPos(e)
  const [wx, wy] = canvasToWorld(cx, cy)
  const sx = snap(wx), sy = snap(wy)
  const tool = editorStore.activeTool

  if (tool === 'place-sink') {
    problemStore.setSink({ x: sx, y: sy })
  } else if (tool === 'place-candidate') {
    problemStore.addCandidate(sx, sy)
  } else if (tool === 'draw-line') {
    if (!lineStart.value) {
      lineStart.value = [sx, sy]
    } else {
      const activeId = editorStore.activeNodeId
      if (activeId) {
        problemStore.addSegmentToNode(activeId, {
          type: 'line',
          start: lineStart.value,
          end: [sx, sy],
        })
      }
      lineStart.value = null
    }
  } else if (tool === 'draw-ellipse') {
    const activeId = editorStore.activeNodeId
    if (activeId) {
      problemStore.addSegmentToNode(activeId, {
        type: 'ellipse',
        center: [sx, sy],
        radiusX: 50,
        radiusY: 50,
      })
    }
  }
}

function handleMouseMove(e: MouseEvent) {
  const [cx, cy] = getCanvasPos(e)
  const [wx, wy] = canvasToWorld(cx, cy)
  hover.value = [wx, wy]
}
</script>

<style scoped>
.canvas-wrapper { position: relative; flex: 1; background: #181825; overflow: hidden; }
canvas { display: block; width: 100%; height: 100%; cursor: crosshair; }
.coords { position: absolute; bottom: 8px; right: 12px; font-size: 11px; color: #a6adc8; background: #1e1e2e99; padding: 2px 8px; border-radius: 4px; pointer-events: none; font-family: monospace; }
.tool-hint { position: absolute; bottom: 8px; left: 12px; font-size: 11px; color: #6c7086; background: #1e1e2e99; padding: 2px 8px; border-radius: 4px; pointer-events: none; }
</style>
