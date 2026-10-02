import { DateTime } from 'luxon';
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';

import { BurnerSession, runBurnerFlow } from '@/features/burner/application';
import { getDeviceOperationOwner } from '@/services/device-operation-owner';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { BurnerLogEntry, BurnerLogLevel } from '@/types/burner-log';
import type { DeviceInfo } from '@/types/device-info';
import { DEFAULT_PROGRESS, type ProgressInfo } from '@/types/progress-info';
import { type BurnerLogInput, formatBurnerLogMessage } from '@/utils/burner-log';

interface ExecuteOperationOptions<TResult> {
  cancellable?: boolean;
  resetProgressOnFinish?: boolean;
  updateProgress?: Partial<ProgressInfo>;
  operation: (signal?: AbortSignal, isAttached?: () => boolean) => Promise<TResult>;
  onSuccess?: (result: TResult, isCurrent: () => boolean) => void | Promise<void>;
  onError: (error: unknown) => void | Promise<void>;
}

export function useCartBurnerSessionState(translate: (key: string) => string, getDevice?: () => DeviceInfo | null) {
  let scopeActive = true;
  let burnerSession = new BurnerSession();
  const localBusy = ref(false);
  const ownerRevision = ref(0);
  let unsubscribe: (() => void) | undefined;
  const currentOwner = () => getDevice ? getDeviceOperationOwner(getDevice()) : undefined;
  const busy = computed(() => {
    void ownerRevision.value;
    return currentOwner()?.busy ?? localBusy.value;
  });
  // Log updates replace the array; preserve diagnostic and cause object identities.
  const logs = shallowRef<BurnerLogEntry[]>([]);
  const progressInfo = ref<ProgressInfo>({ ...DEFAULT_PROGRESS });
  const keepProgressModalOpen = ref(false);

  if (getDevice) watch(currentOwner, (owner) => {
    unsubscribe?.();
    burnerSession.abortOperation();
    burnerSession = new BurnerSession();
    localBusy.value = false;
    unsubscribe = owner?.subscribe(() => { ownerRevision.value++; });
    progressInfo.value = { ...DEFAULT_PROGRESS };
    logs.value = [];
    keepProgressModalOpen.value = false;
  }, { immediate: true });

  // Abort any in-progress operation when the component scope is destroyed
  onScopeDispose(() => {
    scopeActive = false;
    unsubscribe?.();
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
    localBusy.value = snapshot.busy;
    progressInfo.value = { ...DEFAULT_PROGRESS, ...snapshot.progress };
    logs.value = [...snapshot.logs];
  }

  function syncProgressState() {
    const snapshot = burnerSession.snapshot;
    localBusy.value = snapshot.busy;
    progressInfo.value = { ...DEFAULT_PROGRESS, ...snapshot.progress };
  }

  function syncLogsState() {
    logs.value = [...burnerSession.snapshot.logs];
  }

  function updateProgress(info: ProgressInfo) {
    if (!scopeActive) return;
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
    if (!scopeActive) return;
    const time = DateTime.now().toLocaleString(DateTime.TIME_24_WITH_SECONDS);
    const entry = typeof msg === 'string' ? { message: msg } : msg;
    const consolePrefix = `[CartBurner][${level}][${time}]`;
    const consolePayload = {
      message: entry.message,
      error: entry.error,
      details: entry.details,
      diagnostic: entry.diagnostic,
    };
    if (entry.error || entry.details || entry.diagnostic) {
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
    if (burnerSession.snapshot.busy) {
      throw new Error('Burner operation already running');
    }
    const budgetMs = AdvancedSettings.operationBudgetEnabled ? AdvancedSettings.operationTimeout : undefined;
    const owner = currentOwner();
    const device = getDevice?.();
    if (getDevice && !owner) throw new Error('Device transport is not initialized');
    const session = burnerSession;
    const isAttached = () => scopeActive && currentOwner() === owner && getDevice?.() === device && burnerSession === session;
    const isCurrent = () => isAttached() && session.snapshot.phase !== 'cancelling' && !session.snapshot.abortController?.signal.aborted;
    const run = () => {
      keepProgressModalOpen.value = false;
      burnerSession.resetProgress();
      syncProgressState();
      return runBurnerFlow({
        session,
        cancellable: options.cancellable,
        budgetMs,
        resetProgressOnFinish: options.resetProgressOnFinish,
        updateProgress: options.updateProgress,
        syncState: () => {
          if (!isAttached()) return;
          syncSessionState();
          // 操作因错误结束时（不论是抛出异常还是返回失败结果），保持弹窗打开
          if (progressInfo.value.state === 'error') {
            keepProgressModalOpen.value = true;
          }
        },
        log: (message, level) => { if (isAttached()) log(message, level); },
        cancelLogMessage: translate('messages.operation.cancelled'),
        execute: ({ signal }) => options.operation(signal, isAttached),
        onSuccess: (result) => {
          if (isCurrent()) return options.onSuccess?.(result, isCurrent);
        },
        onError: async (error) => {
          // 抛出异常路径：适配器来不及将进度置为 error，在此补充设置
          if (!isAttached()) return;
          burnerSession.updateProgress({ state: 'error', allowCancel: false, showProgress: true });
          await options.onError(error);
        },
      });
    };
    return owner ? owner.run(run, () => { session.abortOperation(); }) : run();
  }

  return {
    get burnerSession() { return burnerSession; },
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
