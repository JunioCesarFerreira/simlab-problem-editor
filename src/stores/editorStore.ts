import { defineStore } from 'pinia'
import { ref } from 'vue'

export type EditorTool = 'select' | 'place-sink' | 'place-candidate' | 'draw-line' | 'draw-ellipse'

export type SelectedElement =
  | { type: 'sink' }
  | { type: 'candidate'; id: string }
  | { type: 'node-segment'; nodeId: string; index: number }

export const useEditorStore = defineStore('editor', () => {
  const activeTool = ref<EditorTool>('select')
  const backgroundImage = ref<string | null>(null)
  const activeNodeId = ref<string | null>(null)
  const showJsonPreview = ref(false)
  const selected = ref<SelectedElement | null>(null)

  function setTool(tool: EditorTool) {
    activeTool.value = tool
    selected.value = null
  }

  function setBackground(dataUrl: string | null) { backgroundImage.value = dataUrl }
  function setActiveNode(id: string | null) { activeNodeId.value = id }
  function toggleJsonPreview() { showJsonPreview.value = !showJsonPreview.value }
  function setSelected(el: SelectedElement | null) { selected.value = el }

  return {
    activeTool,
    backgroundImage,
    activeNodeId,
    showJsonPreview,
    selected,
    setTool,
    setBackground,
    setActiveNode,
    toggleJsonPreview,
    setSelected,
  }
})
