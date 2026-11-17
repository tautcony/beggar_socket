import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import RomToolsView from '@/views/RomToolsView.vue';

vi.mock('@/views/rom-tools/RomSplitMergePanel.vue', () => ({
  default: { name: 'RomSplitMergePanel', template: '<div data-testid="panel-split-merge">split-merge</div>' },
}));
vi.mock('@/views/rom-tools/GbaMultiMenuPanel.vue', () => ({
  default: { name: 'GbaMultiMenuPanel', template: '<div data-testid="panel-multi-menu">multi-menu</div>' },
}));

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/rom-tools/:tab(split-merge|multi-menu)?', name: 'rom-tools', component: RomToolsView },
      { path: '/rom-assembly', redirect: to => ({ name: 'rom-tools', params: { tab: 'split-merge' }, query: to.query }) },
      { path: '/gba-multi-menu', redirect: to => ({ name: 'rom-tools', params: { tab: 'multi-menu' }, query: to.query }) },
    ],
  });
}

describe('RomToolsView', () => {
  it('switches tabs between split-merge and multi-menu and updates route', async () => {
    setActivePinia(createPinia());
    const router = createTestRouter();
    await router.push('/rom-tools/split-merge');
    await router.isReady();

    const wrapper = mount(RomToolsView, {
      global: {
        plugins: [router],
        mocks: {
          $t: (key: string) => key,
        },
      },
    });

    expect(wrapper.find('[data-testid="panel-split-merge"]').exists()).toBe(true);

    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs).toHaveLength(2);

    await tabs[1].trigger('click');
    await flushPromises();
    await nextTick();
    expect(router.currentRoute.value.params.tab).toBe('multi-menu');
    expect(wrapper.find('[data-testid="panel-multi-menu"]').exists()).toBe(true);
  });

  it('redirects legacy /rom-assembly and /gba-multi-menu routes to unified tabs', async () => {
    const router = createTestRouter();

    await router.push('/rom-assembly?romType=MBC5');
    expect(router.currentRoute.value.name).toBe('rom-tools');
    expect(router.currentRoute.value.params.tab).toBe('split-merge');
    expect(router.currentRoute.value.query.romType).toBe('MBC5');

    await router.push('/gba-multi-menu');
    expect(router.currentRoute.value.name).toBe('rom-tools');
    expect(router.currentRoute.value.params.tab).toBe('multi-menu');
  });
});
