import { defineStore } from 'pinia'
import { ref } from 'vue'

export type EditorTool = 'select' | 'place-sink' | 'place-candidate' | 'draw-line' | 'draw-ellipse'

export const useEditorStore = defineStore('editor', () => {
  const activeTool = ref<EditorTool>('select')
  const backgroundImage = ref<string | null>(null)
  const activeNodeId = ref<string | null>(null)
  const showJsonPreview = ref(false)

  function setTool(tool: EditorTool) { activeTool.value = tool }
  function setBackground(dataUrl: string | null) { backgroundImage.value = dataUrl }
  function setActiveNode(id: string | null) { activeNodeId.value = id }
  function toggleJsonPreview() { showJsonPreview.value = !showJsonPreview.value }

  return { activeTool, backgroundImage, activeNodeId, showJsonPreview, setTool, setBackground, setActiveNode, toggleJsonPreview }
})
