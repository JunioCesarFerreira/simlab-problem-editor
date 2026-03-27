<template>
  <div class="problem-form">
    <h3>Problem</h3>
    <label>
      Name
      <input v-model="name" placeholder="problem1" />
    </label>
    <label>
      Radius of Reach
      <input v-model.number="radiusOfReach" type="number" min="1" />
    </label>
    <label>
      Radius of Inter
      <input v-model.number="radiusOfInter" type="number" min="1" />
    </label>
    <fieldset>
      <legend>Region [xmin, ymin, xmax, ymax]</legend>
      <div class="region-row">
        <input v-model.number="region[0]" type="number" placeholder="xmin" />
        <input v-model.number="region[1]" type="number" placeholder="ymin" />
        <input v-model.number="region[2]" type="number" placeholder="xmax" />
        <input v-model.number="region[3]" type="number" placeholder="ymax" />
      </div>
    </fieldset>
    <button class="danger" @click="problemStore.reset()">Reset Problem</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useProblemStore } from '../../stores/problemStore'
import type { Region } from '../../models/problem'

const problemStore = useProblemStore()

const name = computed({
  get: () => problemStore.draft.name,
  set: v => problemStore.updateMeta({ name: v }),
})
const radiusOfReach = computed({
  get: () => problemStore.draft.radiusOfReach,
  set: v => problemStore.updateMeta({ radiusOfReach: v }),
})
const radiusOfInter = computed({
  get: () => problemStore.draft.radiusOfInter,
  set: v => problemStore.updateMeta({ radiusOfInter: v }),
})
const region = computed({
  get: () => problemStore.draft.region,
  set: v => problemStore.updateMeta({ region: v as Region }),
})
</script>

<style scoped>
.problem-form { display: flex; flex-direction: column; gap: 6px; }
label { display: flex; flex-direction: column; font-size: 12px; gap: 2px; }
input { padding: 4px 6px; border: 1px solid #444; background: #1e1e2e; color: #cdd6f4; border-radius: 4px; font-size: 12px; }
fieldset { border: 1px solid #444; border-radius: 4px; padding: 6px; }
legend { font-size: 11px; color: #a6adc8; }
.region-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px; }
.danger { background: #f38ba8; color: #1e1e2e; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 4px; }
</style>
