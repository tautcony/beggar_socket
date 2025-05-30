<template>
  <div
    v-if="progress !== null"
    class="progress-row"
  >
    <progress
      :value="progress"
      max="100"
    />
    <span>{{ progress.toFixed(2) }}%</span>
    <span
      v-if="detail"  
      class="detail"
    >{{ detail }}</span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  progress: {
    type: Number,
    default: null
  },
  detail: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.progress-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
}

.progress-row .detail {
  font-size: 0.6em;
  color: var(--text-secondary);
}

progress {
  width: 180px;
  height: 16px;
}
</style>
