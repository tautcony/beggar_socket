import { onScopeDispose, ref } from 'vue';

import { DeviceConnectionManager } from '@/services/device-connection-manager';

export function useConnectionOperationBusy() {
  const manager = DeviceConnectionManager.getInstance();
  const connectionBusy = ref(manager.isOperationBusy);

  const unsubscribe = manager.subscribeOperationBusy?.((busy) => {
    connectionBusy.value = busy;
  }) ?? (() => {});

  onScopeDispose(() => {
    unsubscribe();
  });

  return {
    connectionBusy,
  };
}
