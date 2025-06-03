// useToast.ts - Composable方式
export function useToast() {
  const showToast = (
    message: string,
    type: 'success' | 'error' | 'idle' = 'success',
    duration = 3000,
  ) => {
    const event = new CustomEvent('show-toast', {
      detail: { message, type, duration },
    });
    window.dispatchEvent(event);
  };

  return {
    showToast,
  };
}

// 在组件中使用
// import { useToast } from '@/composables/useToast';
// const { showToast } = useToast();
// showToast('消息', 'success');
