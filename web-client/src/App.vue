<template>
  <div>
    <router-view />
    <GlobalToast />
  </div>
</template>

<script setup lang="ts">
import GlobalToast from '@/components/common/GlobalToast.vue';
</script>
