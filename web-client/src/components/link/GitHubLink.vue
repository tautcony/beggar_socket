<template>
  <FloatingLink
    :text="'GitHub'"
    :title="$t('ui.github.tooltip')"
    :color="'#24292e'"
    href="https://github.com/tautcony/beggar_socket"
    :bottom="20"
    :right="20"
  >
    <template #icon>
      <RetroIcon icon="pixelarticons:github" />
    </template>
  </FloatingLink>
</template>

<script setup lang="ts">
import FloatingLink from '@/components/common/FloatingLink.vue';
import { RetroIcon } from '@/components/retro';
</script>

<style scoped>
</style>
