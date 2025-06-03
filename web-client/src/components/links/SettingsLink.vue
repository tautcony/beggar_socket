<template>
  <FloatingLink
    :icon="'⚙️'"
    :text="$t('ui.settings.title')"
    :title="$t('ui.settings.tooltip')"
    :color="'#1976d2'"
    :bottom="80"
    :right="20"
    @click="$emit('click')"
  />
</template>

<script setup lang="ts">
import FloatingLink from '../common/FloatingLink.vue';
defineEmits<{ click: [] }>();
</script>

<style scoped>
@media (max-width: 768px) {
  :deep(.floating-link) {
    bottom: 70px !important;
    right: 10px !important;
  }
}
</style>
