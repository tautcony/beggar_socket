import { DateTime } from 'luxon';
import { computed, onScopeDispose, ref } from 'vue';

import { BurnerSession, runBurnerFlow } from '@/features/burner/application';
import type { BurnerLogEntry, BurnerLogLevel } from '@/types/burner-log';
import type { ProgressInfo } from '@/types/progress-info';
import { type BurnerLogInput, formatBurnerLogMessage } from '@/utils/burner-log';

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
  const logs = ref<BurnerLogEntry[]>([]);
  const progressInfo = ref<ProgressInfo>({ ...DEFAULT_PROGRESS });
  const keepProgressModalOpen = ref(false);

  // Abort any in-progress operation when the component scope is destroyed
  onScopeDispose(() => {
    burnerSession.abortOperation();
  });

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

  function syncProgressState() {
    const snapshot = burnerSession.snapshot;
    busy.value = snapshot.busy;
    progressInfo.value = { ...DEFAULT_PROGRESS, ...snapshot.progress };
  }

  function syncLogsState() {
    logs.value = [...burnerSession.snapshot.logs];
  }

  function updateProgress(info: ProgressInfo) {
    if (info.showProgress === true) {
      if (keepProgressModalOpen.value && progressInfo.value.state === 'paused' && info.state === 'running') {
        return;
      }
      burnerSession.updateProgress(info);
      syncProgressState();
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

  function log(msg: BurnerLogInput, level: BurnerLogLevel = 'info') {
    const time = DateTime.now().toLocaleString(DateTime.TIME_24_WITH_SECONDS);
    const entry = typeof msg === 'string' ? { message: msg } : msg;
    const consolePrefix = `[CartBurner][${level}][${time}]`;
    const consolePayload = {
      message: entry.message,
      error: entry.error,
      details: entry.details,
    };
    if (entry.error || entry.details) {
      console.log(`${consolePrefix} ${formatBurnerLogMessage(entry)}`, consolePayload);
    } else {
      console.log(`${consolePrefix} ${formatBurnerLogMessage(entry)}`);
    }
    if (entry.details) {
      console.debug(`${consolePrefix}[details]`, consolePayload);
    }
    burnerSession.addLog(time, msg, level);
    syncLogsState();
  }

  function clearLog() {
    burnerSession.clearLogs();
    syncSessionState();
  }

  async function executeOperation<TResult>(options: ExecuteOperationOptions<TResult>) {
    keepProgressModalOpen.value = false;
    burnerSession.resetProgress();
    syncProgressState();
    return runBurnerFlow({
      session: burnerSession,
      cancellable: options.cancellable,
      resetProgressOnFinish: options.resetProgressOnFinish,
      updateProgress: options.updateProgress,
      syncState: () => {
        syncSessionState();
        // 操作因错误结束时（不论是抛出异常还是返回失败结果），保持弹窗打开
        if (progressInfo.value.state === 'error') {
          keepProgressModalOpen.value = true;
        }
      },
      log,
      cancelLogMessage: translate('messages.operation.cancelled'),
      execute: ({ signal }) => options.operation(signal),
      onError: async (error) => {
        // 抛出异常路径：适配器来不及将进度置为 error，在此补充设置
        burnerSession.updateProgress({ state: 'error', allowCancel: false, showProgress: true } as ProgressInfo);
        await options.onError(error);
      },
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
