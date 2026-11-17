<template>
  <Icon
    :icon="icon"
    class="retro-icon"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import '@/utils/retro-icons';

import { Icon } from '@iconify/vue';

defineProps<{
  icon: string;
}>();
</script>

<style scoped>
.retro-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex-shrink: 0;
  vertical-align: middle;
}
</style>
