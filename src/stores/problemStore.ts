import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { nanoid } from 'nanoid'
import type { ProblemDraft, SinkPoint, MobileRouteDraft, DraftSegment } from '../models/problem'
import { saveDraft, loadDraft } from '../services/persistence'

function createDefaultDraft(): ProblemDraft {
  return {
    name: '',
    radiusOfReach: 100,
    radiusOfInter: 200,
    region: [-150, -150, 150, 150],
    sink: null,
    candidates: [],
    mobileNodes: [],
  }
}

export const useProblemStore = defineStore('problem', () => {
  const saved = loadDraft()
  const draft = ref<ProblemDraft>(saved ?? createDefaultDraft())

  // Auto-save on every change (debounced to 500ms)
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(draft, (val) => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveDraft(val), 500)
  }, { deep: true })

  function reset() {
    draft.value = createDefaultDraft()
  }

  function updateMeta(fields: Partial<Pick<ProblemDraft, 'name' | 'radiusOfReach' | 'radiusOfInter' | 'region'>>) {
    Object.assign(draft.value, fields)
  }

  function setSink(sink: SinkPoint | null) {
    draft.value.sink = sink
  }

  function addCandidate(x: number, y: number) {
    draft.value.candidates.push({ id: nanoid(), x, y })
  }

  function removeCandidate(id: string) {
    draft.value.candidates = draft.value.candidates.filter(c => c.id !== id)
  }

  function moveCandidate(id: string, x: number, y: number) {
    const c = draft.value.candidates.find(c => c.id === id)
    if (c) { c.x = x; c.y = y }
  }

  function addMobileNode(): string {
    const node: MobileRouteDraft = {
      id: nanoid(),
      name: `node${draft.value.mobileNodes.length + 1}`,
      sourceCode: 'node.c',
      speed: 5,
      timeStep: 1,
      isClosed: false,
      isRoundTrip: false,
      segments: [],
    }
    draft.value.mobileNodes.push(node)
    return node.id
  }

  function removeMobileNode(id: string) {
    draft.value.mobileNodes = draft.value.mobileNodes.filter(n => n.id !== id)
  }

  function updateMobileNode(id: string, fields: Partial<Omit<MobileRouteDraft, 'id' | 'segments'>>) {
    const node = draft.value.mobileNodes.find(n => n.id === id)
    if (node) Object.assign(node, fields)
  }

  function addSegmentToNode(nodeId: string, seg: DraftSegment) {
    const node = draft.value.mobileNodes.find(n => n.id === nodeId)
    if (node) node.segments.push(seg)
  }

  function removeSegmentFromNode(nodeId: string, index: number) {
    const node = draft.value.mobileNodes.find(n => n.id === nodeId)
    if (node) node.segments.splice(index, 1)
  }

  function removeLastSegmentFromNode(nodeId: string) {
    const node = draft.value.mobileNodes.find(n => n.id === nodeId)
    if (node && node.segments.length > 0) node.segments.pop()
  }

  return {
    draft,
    reset,
    updateMeta,
    setSink,
    addCandidate,
    removeCandidate,
    moveCandidate,
    addMobileNode,
    removeMobileNode,
    updateMobileNode,
    addSegmentToNode,
    removeSegmentFromNode,
    removeLastSegmentFromNode,
  }
})
