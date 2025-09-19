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
      <IonIcon
        :icon="logoGithub"
        size="large"
      />
    </template>
  </FloatingLink>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { logoGithub } from 'ionicons/icons';

import FloatingLink from '@/components/common/FloatingLink.vue';
</script>

<style scoped>
</style>
