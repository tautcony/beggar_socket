<template>
  <div
    v-if="progress !== null"
    class="progress-row"
  >
    <progress
      :value="progress"
      max="100"
    />
    <span class="progress-text">
      {{ (progress || 0).toFixed(2) }}%
    </span>
    <div
      v-if="detail"
      class="detail"
    >
      {{ detail }}
    </div>
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
  flex-wrap: wrap;
  min-width: 0;
}

.progress-row .detail {
  font-size: 0.8rem;
  color: #666;
  word-break: break-word;
  min-width: 0;
  flex: 1 1 100%;
}

progress {
  width: 80%;
  min-width: 100px;
  height: 16px;
  flex-shrink: 0;
}
.progress-text {
  width: 15%;
}
</style>
