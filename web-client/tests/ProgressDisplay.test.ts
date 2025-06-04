import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ProgressDisplay from '../src/components/ProgressDisplay.vue';
import * as formatterUtils from '../src/utils/formatter-utils';

// Mock formatter utils
vi.mock('../src/utils/formatter-utils', () => ({
  formatBytes: vi.fn((bytes: number) => `${bytes} B`),
  formatSpeed: vi.fn((speed: number) => `${speed} KB/s`),
  formatTime: vi.fn((time: number) => `${time}s`),
}));

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

// Mock BaseModal component
vi.mock('../src/components/common/BaseModal.vue', () => ({
  default: {
    name: 'BaseModal',
    props: ['visible', 'title', 'closeDisabled', 'width'],
    emits: ['close'],
    template: `
      <div class="base-modal" v-if="visible">
        <header><slot name="header"></slot></header>
        <main><slot></slot></main>
        <footer><slot name="footer"></slot></footer>
      </div>
    `,
  },
}));

// Mock IonIcon
vi.mock('@ionic/vue', () => ({
  IonIcon: {
    name: 'IonIcon',
    props: ['name'],
    template: '<div class="ion-icon" :data-name="name"></div>',
  },
}));

describe('ProgressDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps = {
    progress: 50,
    totalBytes: 1000,
    transferredBytes: 500,
    startTime: Date.now() - 10000,
    currentSpeed: 100,
    allowCancel: true,
    detail: '正在传输...',
  };

  it('应该正确渲染组件', () => {
    const wrapper = mount(ProgressDisplay, {
      props: defaultProps,
    });

    expect(wrapper.findComponent({ name: 'BaseModal' }).exists()).toBe(true);
    expect(wrapper.find('.progress-section').exists()).toBe(true);
    expect(wrapper.find('.stats-grid').exists()).toBe(true);
  });

  it('应该显示正确的进度百分比', () => {
    const wrapper = mount(ProgressDisplay, {
      props: { progress: 75 },
    });

    expect(wrapper.find('.progress-percentage').text()).toBe('75.0%');
  });

  it('应该显示进度条填充', () => {
    const wrapper = mount(ProgressDisplay, {
      props: { progress: 60 },
    });

    const progressFill = wrapper.find('.progress-bar-fill');
    expect(progressFill.attributes('style')).toContain('width: 60%');
  });

  it('应该计算传输统计信息', () => {
    const wrapper = mount(ProgressDisplay, {
      props: {
        progress: 50,
        totalBytes: 2000,
        currentSpeed: 200,
      },
    });

    const statValues = wrapper.findAll('.stat-value');
    expect(statValues.length).toBeGreaterThan(0);
    // 验证格式化函数被调用
    expect(vi.mocked(formatterUtils.formatBytes)).toHaveBeenCalled();
    expect(vi.mocked(formatterUtils.formatSpeed)).toHaveBeenCalled();
  });

  it('应该显示操作详情', () => {
    const wrapper = mount(ProgressDisplay, {
      props: {
        progress: 30,
        detail: '正在读取数据...',
      },
    });

    expect(wrapper.find('.operation-detail').text()).toBe('正在读取数据...');
  });

  it('应该在进度为100%时标记为完成', async () => {
    const wrapper = mount(ProgressDisplay, {
      props: { progress: 50 },
    });

    await wrapper.setProps({ progress: 100 });

    // 检查完成状态的标记
    expect(wrapper.find('.completion-badge').exists()).toBe(true);
  });

  it('应该根据allowCancel控制停止按钮状态', () => {
    const wrapper = mount(ProgressDisplay, {
      props: {
        progress: 50,
        allowCancel: false,
      },
    });

    const stopButton = wrapper.find('.stop-button');
    expect(stopButton.attributes('disabled')).toBeDefined();
  });

  it('应该在点击停止按钮时触发stop事件', async () => {
    const wrapper = mount(ProgressDisplay, {
      props: {
        progress: 50,
        allowCancel: true,
      },
    });

    const stopButton = wrapper.find('.stop-button');
    await stopButton.trigger('click');

    expect(wrapper.emitted('stop')).toBeTruthy();
    expect(wrapper.emitted('stop')).toHaveLength(1);
  });

  it('应该在关闭时触发close事件', async () => {
    const wrapper = mount(ProgressDisplay, {
      props: { progress: 50 },
    });

    const modal = wrapper.findComponent({ name: 'BaseModal' });
    await modal.vm.$emit('close');

    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('应该根据完成状态控制关闭按钮', () => {
    const wrapper = mount(ProgressDisplay, {
      props: {
        progress: 50,
        allowCancel: false,
      },
    });

    const modal = wrapper.findComponent({ name: 'BaseModal' });
    expect(modal.props('closeDisabled')).toBe(true);
  });

  it('应该在进度变化时显示弹窗', async () => {
    const wrapper = mount(ProgressDisplay, {
      props: { progress: null },
    });

    expect(wrapper.findComponent({ name: 'BaseModal' }).props('visible')).toBe(false);

    await wrapper.setProps({ progress: 25 });
    expect(wrapper.findComponent({ name: 'BaseModal' }).props('visible')).toBe(true);
  });

  it('应该正确显示翻译的文本', () => {
    const wrapper = mount(ProgressDisplay, {
      props: defaultProps,
    });

    expect(wrapper.find('.modal-title').text()).toContain('ui.progress.title');
    expect(wrapper.find('.stop-button').text()).toBe('ui.progress.stop');
  });
});
