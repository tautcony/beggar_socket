<template>
  <div>
    <router-view />
    <RetroToast />
    <SystemNoticeModal />
  </div>
</template>

<script setup lang="ts">
import SystemNoticeModal from '@/components/modal/SystemNoticeModal.vue';
import { RetroToast } from '@/components/retro';
</script>
