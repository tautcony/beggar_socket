<template>
  <RetroModal
    v-model="localVisible"
    :title="$t('ui.multiCartResult.title')"
    :badge="summaryBadge"
    width="700px"
    max-height="85vh"
    @close="closeModal"
  >
    <!-- 空状态 -->
    <div
      v-if="results.length === 0"
      class="empty-state"
    >
      <RetroIcon
        icon="pixelarticons:search"
        class="empty-icon"
      />
      <p>{{ $t('ui.operation.noValidGameFound') }}</p>
    </div>

    <!-- ROM 布局表格 -->
    <div
      v-else
      class="result-content"
    >
      <div class="layout-table-wrapper">
        <table class="layout-table">
          <thead>
            <tr>
              <th class="col-addr">
                {{ $t('ui.multiCartResult.startAddress') }}
              </th>
              <th class="col-desc">
                {{ $t('ui.multiCartResult.bankDesc') }}
              </th>
              <th class="col-type">
                {{ $t('ui.multiCartResult.romType') }}
              </th>
              <th class="col-title">
                {{ $t('ui.multiCartResult.gameTitle') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(game, index) in results"
              :key="index"
              class="game-row"
              :class="{ 'row-even': index % 2 === 0 }"
            >
              <td class="col-addr">
                <code class="addr-code">{{ formatHex(game.startAddress, 4) }}</code>
              </td>
              <td class="col-desc">
                <span class="desc-text">{{ game.desc }}</span>
              </td>
              <td class="col-type">
                <span
                  class="type-badge"
                  :class="`type-${game.romInfo.type.toLowerCase()}`"
                >{{ game.romInfo.type }}</span>
              </td>
              <td class="col-title">
                <span class="title-text">{{ game.romInfo.title }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </RetroModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { RetroIcon, RetroModal } from '@/components/retro';
import type { GameDetectionResult } from '@/features/burner/application';
import { formatHex } from '@/utils/formatter-utils';

const props = defineProps<{
  results: GameDetectionResult[];
}>();

const { t } = useI18n();

const summaryBadge = computed(() => {
  if (props.results.length === 0) return '';
  if (props.results.length === 1 && props.results[0].startAddress === 0) {
    return t('ui.operation.singleGameDetected');
  }
  return t('ui.multiCartResult.totalGames', { count: props.results.length });
});

const modelValue = defineModel<boolean>({ default: false });
const localVisible = ref(modelValue.value);

watch(modelValue, (v) => { localVisible.value = v; });
watch(localVisible, (v) => { modelValue.value = v; });

function closeModal() {
  localVisible.value = false;
}
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-6);
  color: var(--color-text-muted);
  gap: var(--space-3);
}

.empty-icon {
  font-size: 48px;
  opacity: 0.4;
}

.result-content {
  display: flex;
  flex-direction: column;
}

/* 表格 */
.layout-table-wrapper {
  overflow-x: auto;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border, #e0e0e0);
}

.layout-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.layout-table thead tr {
  background: var(--color-bg-secondary, #f5f5f5);
}

.layout-table th {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  white-space: nowrap;
}

.layout-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
  vertical-align: middle;
}

.game-row:last-child td {
  border-bottom: none;
}

.row-even {
  background: var(--color-bg, #fff);
}

.game-row:not(.row-even) {
  background: var(--color-bg-secondary, #fafafa);
}

.game-row:hover {
  background: var(--color-primary-light, #e3f2fd);
  transition: background 0.15s;
}

/* 列宽 */
.col-addr { min-width: 90px; }
.col-desc { min-width: 90px; }
.col-type { min-width: 60px; }
.col-title { min-width: 160px; }

.addr-code {
  font-family: var(--retro-font-mono);
  font-size: var(--font-size-xs);
  background: var(--color-code-bg, #f0f0f0);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  color: var(--color-primary);
}

.desc-text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.type-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--radius-sm);
  font-family: var(--retro-font-micro);
  font-size: var(--font-size-micro);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-wide);
}

.type-gba { background: #e8f5e9; color: #2e7d32; }
.type-gbc { background: #e3f2fd; color: #1565c0; }
.type-gb  { background: #fce4ec; color: #880e4f; }
.type-unknown { background: #f5f5f5; color: #757575; }

.title-text {
  font-weight: var(--font-weight-medium, 500);
}
</style>
