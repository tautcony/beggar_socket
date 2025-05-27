<template>
  <div
    v-if="progress !== null"
    class="progress-row"
  >
    <progress
      :value="progress"
      max="100"
    />
    <span>{{ progress }}%</span>
    <span v-if="detail">{{ detail }}</span>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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

progress {
  width: 180px;
  height: 16px;
}
</style>
