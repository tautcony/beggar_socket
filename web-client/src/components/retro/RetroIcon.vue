<template>
  <Icon
    v-if="isIconifyName"
    :icon="icon"
    class="retro-icon"
    aria-hidden="true"
  />
  <IonIcon
    v-else
    :icon="icon"
    class="retro-icon"
  />
</template>

<script setup lang="ts">
import '@/utils/retro-icons';

import { Icon } from '@iconify/vue';
import { IonIcon } from '@ionic/vue';
import { computed } from 'vue';

const props = defineProps<{
  icon: string;
}>();

const isIconifyName = computed(
  () => props.icon.includes(':') && !props.icon.startsWith('data:') && !props.icon.startsWith('http'),
);
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
