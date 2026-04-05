<template>
  <div class="toolbar">
    <div class="tool-group">
      <button
        v-for="tool in tools"
        :key="tool.id"
        :class="{ active: activeTool === tool.id }"
        :disabled="tool.id === 'place-candidate' && !candidatesEnabled"
        :title="tool.id === 'place-candidate' && !candidatesEnabled ? 'Not available for problem1' : tool.label"
        @click="editorStore.setTool(tool.id)"
      >{{ tool.icon }}</button>
    </div>
    <div class="tool-group">
      <label class="icon-btn" title="Load background image">
        🖼
        <input type="file" accept="image/*" @change="loadImage" style="display:none" />
      </label>
    </div>
    <div class="spacer" />
    <button title="Import JSON" @click="$emit('import')">⬆</button>
    <button :class="{ active: showConnectivity }" title="Connectivity Graph  [G] — show/hide reach radius and edges" @click="editorStore.toggleConnectivity()">⬡</button>
    <button :class="{ active: showJson }" title="JSON Preview  [{ }]" @click="editorStore.toggleJsonPreview()">{ }</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore, type EditorTool } from '../../stores/editorStore'
import { useProblemStore } from '../../stores/problemStore'
import { hasCandidates } from '../../models/problem'

defineEmits<{ import: [] }>()

const editorStore = useEditorStore()
const problemStore = useProblemStore()
const activeTool = computed(() => editorStore.activeTool)
const showJson = computed(() => editorStore.showJsonPreview)
const showConnectivity = computed(() => editorStore.showConnectivity)
const candidatesEnabled = computed(() => hasCandidates(problemStore.draft.name))

const tools: { id: EditorTool; icon: string; label: string }[] = [
  { id: 'select',            icon: '↖',  label: 'Select / Move  [S]' },
  { id: 'place-sink',        icon: '⊕',  label: 'Place Sink  [K]' },
  { id: 'place-candidate',   icon: '●',  label: 'Place Candidate  [C]' },
  { id: 'draw-line',         icon: '╱',  label: 'Draw Polyline  [L] — right-click/Esc to finish' },
  { id: 'draw-ellipse',      icon: '○',  label: 'Draw Ellipse  [E] — drag to define radii' },
  { id: 'measure',           icon: '📏', label: 'Tape Measure  [M] — click-drag to measure distance' },
  { id: 'scale-calibrate',  icon: '⚖',  label: 'Scale Calibration  [R] — drag a known segment then enter its real length' },
]

function loadImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => editorStore.setBackground(e.target?.result as string)
  reader.readAsDataURL(file)
}
</script>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #1e1e2e; border-bottom: 1px solid #313244; height: 44px; }
.tool-group { display: flex; gap: 2px; }
button, .icon-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #313244; color: #cdd6f4; border: 1px solid #45475a; border-radius: 6px; cursor: pointer; font-size: 15px; }
button.active { background: #89b4fa; color: #1e1e2e; border-color: #89b4fa; }
button:disabled { opacity: 0.35; cursor: not-allowed; }
.icon-btn { cursor: pointer; }
.spacer { flex: 1; }
</style>
