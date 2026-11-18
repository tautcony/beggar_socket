<template>
  <Icon
    :icon="icon"
    class="retro-icon"
    shape-rendering="crispEdges"
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
  shape-rendering: crispEdges;
}

.retro-icon :deep(path),
.retro-icon :deep(rect),
.retro-icon :deep(polygon),
.retro-icon :deep(polyline),
.retro-icon :deep(line) {
  shape-rendering: crispEdges;
}
</style>
