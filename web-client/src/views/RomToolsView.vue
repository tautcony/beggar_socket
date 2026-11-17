<template>
  <div class="rom-tools-view">
    <header class="page-header">
      <div class="header-inner">
        <div class="header-left">
          <RetroButton
            variant="ghost"
            size="sm"
            icon="pixelarticons:arrow-left"
            :text="$t('ui.romTools.back')"
            @click="goBack"
          />
          <div class="header-divider" />
          <div class="title-group">
            <h2 class="page-title">
              {{ $t('ui.romTools.title') }}
            </h2>
            <span class="platform-tag">CHISFLASH // ROM WORKBENCH</span>
          </div>
        </div>

        <div
          class="tools-tabs"
          role="tablist"
        >
          <button
            v-for="tab in tabs"
            :key="tab.id"
            role="tab"
            :aria-selected="activeTab === tab.id"
            class="tab-button"
            :class="{ active: activeTab === tab.id }"
            @click="switchTab(tab.id)"
          >
            <span>{{ $t(tab.labelKey) }}</span>
            <span
              v-if="tab.badge"
              class="alpha-badge"
            >
              {{ tab.badge }}
            </span>
          </button>
        </div>
      </div>
    </header>

    <main class="rom-tools-content">
      <KeepAlive>
        <component :is="activePanel" />
      </KeepAlive>
    </main>
  </div>
</template>

<script setup lang="ts">
import { type Component, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { RetroButton } from '@/components/retro';

import GbaMultiMenuPanel from './rom-tools/GbaMultiMenuPanel.vue';
import RomSplitMergePanel from './rom-tools/RomSplitMergePanel.vue';

type RomToolTab = 'split-merge' | 'multi-menu';

const tabs: readonly { id: RomToolTab; labelKey: string; badge?: string }[] = [
  { id: 'split-merge', labelKey: 'ui.romTools.tabs.splitMerge' },
  { id: 'multi-menu', labelKey: 'ui.romTools.tabs.multiMenu', badge: 'ALPHA' },
];

const PANEL_MAP: Record<RomToolTab, Component> = {
  'split-merge': RomSplitMergePanel,
  'multi-menu': GbaMultiMenuPanel,
};

const route = useRoute();
const router = useRouter();

const activeTab = computed<RomToolTab>(() => {
  const param = route.params.tab;
  if (param === 'multi-menu') {
    return param;
  }
  return 'split-merge';
});

const activePanel = computed(() => PANEL_MAP[activeTab.value]);

function switchTab(tab: RomToolTab) {
  if (tab === activeTab.value) {
    return;
  }
  void router.replace({
    name: 'rom-tools',
    params: { tab },
    query: route.query,
  });
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    void router.push('/');
  }
}
</script>

<style scoped>
.rom-tools-view {
  box-sizing: border-box;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--retro-bg-canvas);
  color: var(--retro-ink);
  position: fixed;
  inset: 0;
  width: 100vw;
  overflow: hidden;
}

.rom-tools-view :deep(*) {
  box-sizing: border-box;
}

.page-header {
  flex-shrink: 0;
  background: var(--retro-bg-surface);
  border-bottom: 1.5px solid var(--retro-border-subtle);
  z-index: 100;
}

.header-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.header-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border-light);
}

.title-group {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.page-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--retro-ink);
  letter-spacing: -0.01em;
}

.platform-tag {
  font-family: var(--retro-font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--retro-ink-muted);
}

.tools-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  background: var(--retro-bg-elevated);
  border: 1.5px solid var(--retro-border-subtle);
  border-radius: var(--radius-base);
}

.tab-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--retro-ink-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.tab-button:hover {
  color: var(--retro-ink);
}

.tab-button.active {
  background: var(--retro-primary-bg);
  color: var(--retro-primary-fg);
}

.alpha-badge {
  font-family: var(--retro-font-mono);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.18);
  letter-spacing: 0.04em;
}

.tab-button:not(.active) .alpha-badge {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.rom-tools-content {
  flex: 1;
  min-height: 0;
  width: 100%;
  padding: var(--space-5) var(--space-6);
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 960px) {
  .rom-tools-view {
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .rom-tools-content {
    flex: none;
    height: auto;
    overflow: visible;
  }
}

@media (max-width: 768px) {
  .header-inner {
    padding: var(--space-3) var(--space-4);
  }

  .platform-tag {
    display: none;
  }

  .rom-tools-content {
    padding: var(--space-4);
  }
}
</style>
