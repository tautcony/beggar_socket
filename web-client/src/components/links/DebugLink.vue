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
        name="bug-outline"
        style="font-size: 20px;"
      />
    </template>
  </FloatingLink>
</template>

<script setup lang="ts">
import FloatingLink from '@/components/common/FloatingLink.vue';
import { IonIcon } from '@ionic/vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(['update:modelValue']);

function togglePanel() {
  emit('update:modelValue', !props.modelValue);
}
</script>
