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
        name="logo-github"
        style="font-size: 20px;"
      />
    </template>
  </FloatingLink>
</template>

<script setup lang="ts">
import FloatingLink from '../common/FloatingLink.vue';
</script>

<style scoped>
@media (max-width: 768px) {
  :deep(.floating-link) {
    bottom: 10px !important;
    right: 10px !important;
  }
}
</style>
