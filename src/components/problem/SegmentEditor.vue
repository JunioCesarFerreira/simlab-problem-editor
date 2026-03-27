<template>
  <div class="segment-editor">
    <div class="seg-title">Add Segment</div>
    <div class="tabs">
      <button :class="{ active: tab === 'line' }" @click="tab = 'line'">Line</button>
      <button :class="{ active: tab === 'ellipse' }" @click="tab = 'ellipse'">Ellipse</button>
      <button :class="{ active: tab === 'custom' }" @click="tab = 'custom'">Custom</button>
    </div>

    <div v-if="tab === 'line'" class="fields">
      <div class="row">
        <label>x0<input v-model.number="line.x0" type="number" /></label>
        <label>y0<input v-model.number="line.y0" type="number" /></label>
      </div>
      <div class="row">
        <label>x1<input v-model.number="line.x1" type="number" /></label>
        <label>y1<input v-model.number="line.y1" type="number" /></label>
      </div>
    </div>

    <div v-if="tab === 'ellipse'" class="fields">
      <div class="row">
        <label>cx<input v-model.number="ellipse.cx" type="number" /></label>
        <label>cy<input v-model.number="ellipse.cy" type="number" /></label>
      </div>
      <div class="row">
        <label>rx<input v-model.number="ellipse.rx" type="number" /></label>
        <label>ry<input v-model.number="ellipse.ry" type="number" /></label>
      </div>
    </div>

    <div v-if="tab === 'custom'" class="fields">
      <label>x(t)<input v-model="custom.exprX" placeholder="e.g. 70 + 30 * t" /></label>
      <label>y(t)<input v-model="custom.exprY" placeholder="e.g. -50 + 20 * t" /></label>
    </div>

    <button class="add-btn" @click="addSegment">+ Add Segment</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useProblemStore } from '../../stores/problemStore'
import type { DraftSegment } from '../../models/problem'

const props = defineProps<{ nodeId: string }>()
const problemStore = useProblemStore()

const tab = ref<'line' | 'ellipse' | 'custom'>('line')
const line = ref({ x0: 0, y0: 0, x1: 100, y1: 0 })
const ellipse = ref({ cx: 0, cy: 0, rx: 50, ry: 50 })
const custom = ref({ exprX: '', exprY: '' })

function addSegment() {
  let seg: DraftSegment
  if (tab.value === 'line') {
    seg = { type: 'line', start: [line.value.x0, line.value.y0], end: [line.value.x1, line.value.y1] }
  } else if (tab.value === 'ellipse') {
    seg = { type: 'ellipse', center: [ellipse.value.cx, ellipse.value.cy], radiusX: ellipse.value.rx, radiusY: ellipse.value.ry }
  } else {
    if (!custom.value.exprX.trim() || !custom.value.exprY.trim()) return
    seg = { type: 'custom', exprX: custom.value.exprX, exprY: custom.value.exprY }
  }
  problemStore.addSegmentToNode(props.nodeId, seg)
}
</script>

<style scoped>
.segment-editor { border-top: 1px solid #313244; padding-top: 8px; margin-top: 4px; }
.seg-title { font-size: 11px; color: #a6adc8; margin-bottom: 6px; }
.tabs { display: flex; gap: 3px; margin-bottom: 8px; }
.tabs button { flex: 1; font-size: 11px; padding: 3px; background: #313244; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px; cursor: pointer; }
.tabs button.active { background: #89b4fa; color: #1e1e2e; border-color: #89b4fa; }
.fields { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
label { display: flex; flex-direction: column; font-size: 11px; gap: 2px; }
input { padding: 3px 5px; border: 1px solid #444; background: #1e1e2e; color: #cdd6f4; border-radius: 4px; font-size: 11px; }
.add-btn { width: 100%; background: #89b4fa; color: #1e1e2e; border: none; border-radius: 4px; padding: 5px; cursor: pointer; font-size: 12px; font-weight: 600; }
</style>
