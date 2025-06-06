<template>
  <FloatingLink
    :text="$t('ui.debug.panel')"
    :title="$t('ui.debug.panel')"
    :color="'#e67e22'"
    :bottom="140"
    :right="20"
    @click="togglePanel"
  >
    <template #icon>
      <IonIcon
        :icon="bugOutline"
        size="large"
      />
    </template>
  </FloatingLink>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { bugOutline } from 'ionicons/icons';

import FloatingLink from '@/components/common/FloatingLink.vue';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(['update:modelValue']);

function togglePanel() {
  emit('update:modelValue', !props.modelValue);
}
</script>
