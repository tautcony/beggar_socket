import { DateTime } from 'luxon';
import { computed, ref } from 'vue';

import { BurnerSession, runBurnerFlow } from '@/features/burner/application';
import type { ProgressInfo } from '@/types/progress-info';

type LogLevelType = 'info' | 'success' | 'warn' | 'error';

const DEFAULT_PROGRESS: ProgressInfo = {
  type: 'other',
  progress: null,
  detail: '',
  totalBytes: undefined,
  transferredBytes: undefined,
  startTime: undefined,
  currentSpeed: undefined,
  allowCancel: true,
  state: 'idle',
};

interface ExecuteOperationOptions<TResult> {
  cancellable?: boolean;
  resetProgressOnFinish?: boolean;
  updateProgress?: Partial<ProgressInfo>;
  operation: (signal?: AbortSignal) => Promise<TResult>;
  onError: (error: unknown) => void | Promise<void>;
}

export function useCartBurnerSessionState(translate: (key: string) => string) {
  const burnerSession = new BurnerSession();
  const busy = ref(false);
  const logs = ref<{ time: string; message: string; level: LogLevelType }[]>([]);
  const progressInfo = ref<ProgressInfo>({ ...DEFAULT_PROGRESS });
  const keepProgressModalOpen = ref(false);

  const showProgressModal = computed(() => {
    if (keepProgressModalOpen.value) {
      return true;
    }
    return progressInfo.value.progress !== null && progressInfo.value.progress !== undefined;
  });

  function syncSessionState() {
    const snapshot = burnerSession.snapshot;
    busy.value = snapshot.busy;
    progressInfo.value = { ...DEFAULT_PROGRESS, ...snapshot.progress };
    logs.value = [...snapshot.logs];
  }

  function updateProgress(info: ProgressInfo) {
    if (info.showProgress === true) {
      if (keepProgressModalOpen.value && progressInfo.value.state === 'paused' && info.state === 'running') {
        return;
      }
      burnerSession.updateProgress(info);
      syncSessionState();
    }
  }

  function resetProgress() {
    burnerSession.resetProgress();
    syncSessionState();
  }

  function handleProgressClose() {
    keepProgressModalOpen.value = false;
    resetProgress();
  }

  function handleProgressStop() {
    keepProgressModalOpen.value = true;
    burnerSession.updateProgress({
      state: 'paused',
      allowCancel: false,
      detail: translate('messages.operation.cancelled'),
      showProgress: true,
    });
    burnerSession.abortOperation();
    syncSessionState();
  }

  function log(msg: string, level: LogLevelType = 'info') {
    const time = DateTime.now().toLocaleString(DateTime.TIME_24_WITH_SECONDS);
    burnerSession.addLog(time, msg, level);
    syncSessionState();
  }

  function clearLog() {
    burnerSession.clearLogs();
    syncSessionState();
  }

  async function executeOperation<TResult>(options: ExecuteOperationOptions<TResult>) {
    keepProgressModalOpen.value = false;
    return runBurnerFlow({
      session: burnerSession,
      cancellable: options.cancellable,
      resetProgressOnFinish: options.resetProgressOnFinish,
      updateProgress: options.updateProgress,
      syncState: () => {
        syncSessionState();
      },
      log,
      cancelLogMessage: translate('messages.operation.cancelled'),
      execute: ({ signal }) => options.operation(signal),
      onError: options.onError,
    });
  }

  return {
    burnerSession,
    busy,
    logs,
    progressInfo,
    showProgressModal,
    updateProgress,
    resetProgress,
    handleProgressClose,
    handleProgressStop,
    clearLog,
    log,
    syncSessionState,
    executeOperation,
  };
}
