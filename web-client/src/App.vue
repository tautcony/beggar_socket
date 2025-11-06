<template>
  <div>
    <router-view />
    <GlobalToast />
    <SystemNoticeModal />
  </div>
</template>

<script setup lang="ts">
import GlobalToast from '@/components/common/GlobalToast.vue';
import SystemNoticeModal from '@/components/modal/SystemNoticeModal.vue';
</script>
