<template>
  <FloatingLink
    :text="$t('ui.debug.panel')"
    :title="$t('ui.debug.panel')"
    :color="'var(--retro-warning-bg)'"
    :bottom="80"
    :right="20"
    @click="togglePanel"
  >
    <template #icon>
      <RetroIcon icon="pixelarticons:bug" />
    </template>
  </FloatingLink>
</template>

<script setup lang="ts">
import FloatingLink from '@/components/common/FloatingLink.vue';
import { RetroIcon } from '@/components/retro';

const showDebugPanelModal = defineModel<boolean>('display', { default: false });

function togglePanel() {
  showDebugPanelModal.value = !showDebugPanelModal.value;
}
</script>
