<template>
  <div class="properties-panel">
    <div class="tabs">
      <button :class="{ active: tab === 'problem' }" @click="tab = 'problem'">Problem</button>
      <button :class="{ active: tab === 'nodes' }" @click="tab = 'nodes'">Nodes</button>
    </div>
    <div class="tab-content">
      <ProblemForm v-if="tab === 'problem'" />
      <template v-else>
        <MobileNodeList />
        <div class="divider" />
        <MobileNodeEditor />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ProblemForm from '../problem/ProblemForm.vue'
import MobileNodeList from '../problem/MobileNodeList.vue'
import MobileNodeEditor from '../problem/MobileNodeEditor.vue'

const tab = ref<'problem' | 'nodes'>('problem')
</script>

<style scoped>
.properties-panel { display: flex; flex-direction: column; height: 100%; background: #1e1e2e; overflow: hidden; }
.tabs { display: flex; border-bottom: 1px solid #313244; flex-shrink: 0; }
.tabs button { flex: 1; padding: 8px; font-size: 12px; background: none; border: none; color: #a6adc8; cursor: pointer; border-bottom: 2px solid transparent; }
.tabs button.active { color: #89b4fa; border-bottom-color: #89b4fa; }
.tab-content { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.divider { height: 1px; background: #313244; flex-shrink: 0; }
</style>
