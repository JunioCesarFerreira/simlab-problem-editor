<template>
  <div class="problem-editor">
    <Toolbar />
    <div class="editor-body">
      <aside class="side-panel">
        <PropertiesPanel />
      </aside>
      <main class="canvas-area">
        <CanvasView />
      </main>
      <aside v-if="showJson" class="json-panel">
        <JsonPreviewPanel />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Toolbar from './Toolbar.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import CanvasView from './CanvasView.vue'
import JsonPreviewPanel from './JsonPreviewPanel.vue'
import { useEditorStore } from '../../stores/editorStore'

const editorStore = useEditorStore()
const showJson = computed(() => editorStore.showJsonPreview)
</script>

<style scoped>
.problem-editor { display: flex; flex-direction: column; height: 100vh; background: #181825; color: #cdd6f4; font-family: 'Segoe UI', system-ui, sans-serif; }
.editor-body { display: flex; flex: 1; overflow: hidden; }
.side-panel { width: 240px; min-width: 200px; border-right: 1px solid #313244; overflow: hidden; display: flex; flex-direction: column; flex-shrink: 0; }
.canvas-area { flex: 1; display: flex; overflow: hidden; min-width: 0; }
.json-panel { width: 340px; min-width: 260px; border-left: 1px solid #313244; overflow: hidden; display: flex; flex-direction: column; flex-shrink: 0; }
</style>
