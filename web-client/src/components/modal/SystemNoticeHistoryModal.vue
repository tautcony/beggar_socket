<template>
  <BaseModal
    v-model="localVisible"
    :width="860"
    max-height="85vh"
    :esc-closable="true"
    :mask-closable="true"
    @close="onClose"
  >
    <template #header>
      <div class="header">
        <h3 class="header-title">
          {{ $t('ui.systemNoticeHistory.title') }}
        </h3>
        <p class="header-subtitle">
          {{ $t('ui.systemNoticeHistory.subtitle') }}
        </p>
      </div>
    </template>

    <div class="history-body">
      <div class="notice-list">
        <div
          v-if="loading"
          class="notice-list-placeholder"
        >
          {{ $t('ui.systemNoticeHistory.loading') }}
        </div>
        <div
          v-else-if="notices.length === 0"
          class="notice-list-placeholder"
        >
          {{ $t('ui.systemNoticeHistory.empty') }}
        </div>
        <button
          v-for="notice in notices"
          :key="notice.id"
          class="notice-list-item"
          :class="{ active: notice.id === selectedId }"
          type="button"
          @click="onSelectNotice(notice.id)"
        >
          <div class="item-title">
            {{ notice.title }}
          </div>
          <div class="item-meta">
            <span class="item-meta-entry">
              <IonIcon :icon="calendarOutline" />
              {{ $t('ui.systemNoticeHistory.publishedAt') }}: {{ formatDate(notice.publishedAt) }}
            </span>
            <span class="item-meta-entry">
              <IonIcon :icon="timeOutline" />
              {{ $t('ui.systemNoticeHistory.viewedAt') }}:
              <template v-if="notice.record?.lastViewedAt">
                {{ formatDate(notice.record.lastViewedAt) }}
              </template>
              <template v-else>
                {{ $t('ui.systemNoticeHistory.unread') }}
              </template>
            </span>
          </div>
        </button>
      </div>

      <div class="notice-detail">
        <template v-if="selectedNotice">
          <div class="detail-header">
            <div class="detail-title-row">
              <h4 class="detail-title">
                {{ selectedNotice.title }}
              </h4>
              <BaseButton
                v-if="showTranslateButton"
                size="sm"
                variant="secondary"
                :disabled="!canTranslateSelected || selectedNotice.translation.loading"
                @click="translateSelectedNotice"
              >
                {{ translateButtonLabel }}
              </BaseButton>
            </div>
            <p class="detail-meta">
              <span>{{ $t('ui.systemNoticeHistory.publishedAt') }}: {{ formatDate(selectedNotice.publishedAt) }}</span>
              <span v-if="selectedNotice.record?.lastViewedAt">
                {{ $t('ui.systemNoticeHistory.viewedAt') }}: {{ formatDate(selectedNotice.record.lastViewedAt) }}
              </span>
            </p>
          </div>
          <div
            v-if="selectedNotice.loading"
            class="notice-placeholder"
          >
            {{ $t('ui.systemNoticeHistory.loadingContent') }}
          </div>
          <div
            v-else-if="showTranslateButton && selectedNotice.translation.loading"
            class="notice-placeholder"
          >
            {{ $t('ui.systemNoticeHistory.translating') }}
          </div>
          <!-- eslint-disable vue/no-v-html -->
          <div
            v-else-if="detailContentHtml"
            class="notice-content markdown-body"
            v-html="detailContentHtml"
          />
          <!-- eslint-enable vue/no-v-html -->
          <div
            v-else
            class="notice-placeholder"
          >
            {{ $t('ui.systemNoticeHistory.noContent') }}
          </div>
          <p
            v-if="showTranslateButton && selectedNotice.translation.error"
            class="notice-feedback error"
          >
            {{ selectedNotice.translation.error }}
          </p>
        </template>
        <template v-else>
          <div class="notice-placeholder">
            {{ $t('ui.systemNoticeHistory.selectHint') }}
          </div>
        </template>
      </div>
    </div>

    <template #footer>
      <BaseButton
        variant="secondary"
        @click="close"
      >
        {{ $t('ui.common.close') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { calendarOutline, timeOutline } from 'ionicons/icons';
import { DateTime } from 'luxon';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseButton from '@/components/common/BaseButton.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import {
  fetchSystemNoticeConfig,
  fetchSystemNoticeMarkdown,
  markNoticeAcknowledged,
  readNoticeRecord,
  type SystemNoticeMeta,
  type SystemNoticeRecord,
  updateNoticeLastViewed,
} from '@/services/system-notice-service';
import { renderMarkdown } from '@/utils/markdown';
import { translateText } from '@/utils/translation';

interface NoticeListItem extends SystemNoticeMeta {
  record: SystemNoticeRecord | null;
  contentHtml: string | null;
  contentMarkdown: string;
  loading: boolean;
  translation: {
    html: string;
    loading: boolean;
    error: string;
    showing: boolean;
  };
}

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const { locale, t } = useI18n();
const showTranslateButton = computed(() => locale.value !== 'zh-Hans');

const localVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    emit('update:modelValue', value);
  },
});

const loading = ref(false);
const notices = ref<NoticeListItem[]>([]);
const selectedId = ref<string | null>(null);

const selectedNotice = computed(() => {
  if (!selectedId.value) {
    return null;
  }
  return notices.value.find((notice) => notice.id === selectedId.value) ?? null;
});

const canTranslateSelected = computed(() => showTranslateButton.value && Boolean(selectedNotice.value?.contentMarkdown));

const detailContentHtml = computed(() => {
  const notice = selectedNotice.value;
  if (!notice) {
    return '';
  }
  if (showTranslateButton.value && notice.translation.showing && notice.translation.html) {
    return notice.translation.html;
  }
  return notice.contentHtml ?? '';
});

const translateButtonLabel = computed(() => {
  if (!showTranslateButton.value) {
    return '';
  }
  const notice = selectedNotice.value;
  if (!notice) {
    return t('ui.systemNoticeHistory.translate');
  }
  if (notice.translation.loading) {
    return t('ui.systemNoticeHistory.translating');
  }
  if (notice.translation.showing) {
    return t('ui.systemNoticeHistory.viewOriginal');
  }
  if (notice.translation.html) {
    return t('ui.systemNoticeHistory.viewTranslation');
  }
  return t('ui.systemNoticeHistory.translate');
});

function formatDate(value: string | undefined): string {
  if (!value) {
    return '';
  }
  const dt = DateTime.fromISO(value);
  if (!dt.isValid) {
    return value;
  }
  return dt.setLocale(locale.value).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
}

async function loadNotices() {
  loading.value = true;
  const items = await fetchSystemNoticeConfig();
  notices.value = items.map<NoticeListItem>((item) => ({
    ...item,
    record: readNoticeRecord(item.id),
    contentHtml: null,
    contentMarkdown: '',
    loading: false,
    translation: {
      html: '',
      loading: false,
      error: '',
      showing: false,
    },
  }));
  loading.value = false;
  if (notices.value.length > 0) {
    void onSelectNotice(notices.value[0].id);
  } else {
    selectedId.value = null;
  }
}

async function ensureContent(id: string) {
  const notice = notices.value.find((item) => item.id === id);
  if (!notice) {
    return;
  }

  if (notice.contentHtml || notice.loading) {
    return;
  }

  notice.loading = true;
  const markdown = await fetchSystemNoticeMarkdown(notice.contentPath);
  if (markdown) {
    notice.contentMarkdown = markdown;
    notice.contentHtml = renderMarkdown(markdown);
    notice.translation.html = '';
    notice.translation.error = '';
    notice.translation.showing = false;
  } else {
    notice.contentMarkdown = '';
    notice.contentHtml = null;
    notice.translation.html = '';
    notice.translation.error = '';
    notice.translation.showing = false;
  }
  notice.loading = false;
}

async function onSelectNotice(id: string) {
  selectedId.value = id;
  await ensureContent(id);

  const notice = notices.value.find((item) => item.id === id);
  if (!notice) {
    return;
  }

  const now = new Date().toISOString();
  if (notice.record) {
    const updated = updateNoticeLastViewed(id, now);
    if (updated) {
      notice.record = updated;
    }
  } else {
    notice.record = markNoticeAcknowledged(id, now);
  }

  notice.translation.showing = false;
}

async function translateSelectedNotice() {
  const notice = selectedNotice.value;
  if (!showTranslateButton.value || !notice?.contentMarkdown) {
    return;
  }

  if (notice.translation.loading) {
    return;
  }

  if (notice.translation.showing) {
    notice.translation.showing = false;
    return;
  }

  if (notice.translation.html) {
    notice.translation.error = '';
    notice.translation.showing = true;
    return;
  }

  notice.translation.loading = true;
  notice.translation.error = '';
  try {
    const translated = await translateText(notice.contentMarkdown, locale.value);
    if (translated) {
      notice.translation.html = renderMarkdown(translated);
      notice.translation.showing = true;
    } else {
      notice.translation.error = t('ui.systemNoticeHistory.translationFailed');
    }
  } catch (error) {
    console.warn('[SystemNoticeHistory] Translation failed', error);
    notice.translation.error = t('ui.systemNoticeHistory.translationFailed');
  } finally {
    notice.translation.loading = false;
  }
}

function close() {
  emit('update:modelValue', false);
}

function onClose() {
  emit('close');
}

watch(localVisible, (visible) => {
  if (visible) {
    void loadNotices();
  }
});

onMounted(() => {
  if (localVisible.value) {
    void loadNotices();
  }
});

watch(showTranslateButton, (enabled) => {
  if (!enabled) {
    for (const notice of notices.value) {
      notice.translation.html = '';
      notice.translation.loading = false;
      notice.translation.error = '';
      notice.translation.showing = false;
    }
  }
});
</script>

<style scoped lang="scss">
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;

.header {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-1;
}

.header-title {
  margin: 0;
  font-size: typography-vars.$font-size-xl;
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-text;
}

.header-subtitle {
  margin: 0;
  font-size: typography-vars.$font-size-sm;
  color: color-vars.$color-text-secondary;
}

.history-body {
  display: flex;
  flex-direction: row;
  gap: spacing-vars.$space-4;
  min-height: 360px;
}

.notice-list {
  width: 36%;
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-3;
  max-height: 60vh;
  overflow-y: auto;
  padding-top: spacing-vars.$space-2;
  padding-right: spacing-vars.$space-2;
  border-right: 1px solid color-vars.$color-border-light;
}

.notice-list-placeholder {
  padding: spacing-vars.$space-4;
  color: color-vars.$color-text-secondary;
  text-align: center;
  font-size: typography-vars.$font-size-sm;
}

.notice-list-item {
  text-align: left;
  border: 1px solid color-vars.$color-border-light;
  border-radius: radius-vars.$radius-lg;
  padding: spacing-vars.$space-3;
  background-color: color-vars.$color-bg-secondary;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-2;

  &:hover {
    border-color: color-vars.$color-primary;
    box-shadow: color-vars.$shadow-sm;
    transform: translateY(-1px);
  }

  &.active {
    border-color: color-vars.$color-primary;
    box-shadow: color-vars.$shadow-md;
    background: rgba(color-vars.$color-primary, 0.08);
  }
}

.item-title {
  font-size: typography-vars.$font-size-base;
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-text;
  margin: 0;
}

.item-meta {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-1;
  font-size: typography-vars.$font-size-sm;
  color: color-vars.$color-text-secondary;
}

.item-meta-entry {
  display: inline-flex;
  align-items: center;
  gap: spacing-vars.$space-1;
}

.notice-detail {
  flex: 1;
  max-height: 60vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-3;
}

.detail-header {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-1;
}

.detail-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: spacing-vars.$space-3;
  flex-wrap: wrap;
}

.detail-title {
  margin: 0;
  font-size: typography-vars.$font-size-lg;
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-text;
}

.detail-meta {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-1;
  font-size: typography-vars.$font-size-sm;
  color: color-vars.$color-text-secondary;
  margin: 0;
}

.notice-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: color-vars.$color-text-secondary;
  padding: spacing-vars.$space-4;
  border: 1px dashed color-vars.$color-border-light;
  border-radius: radius-vars.$radius-lg;
}

.notice-content {
  flex: 1;
  overflow-y: auto;
  padding-right: spacing-vars.$space-2;
  color: color-vars.$color-text;
}

.notice-feedback {
  margin-top: spacing-vars.$space-2;
  font-size: typography-vars.$font-size-sm;
  color: color-vars.$color-text-secondary;

  &.error {
    color: color-vars.$color-error;
  }
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: spacing-vars.$space-4 0 spacing-vars.$space-2;
  font-weight: typography-vars.$font-weight-semibold;
}

.markdown-body :deep(p) {
  margin: 0 0 spacing-vars.$space-3 0;
  line-height: 1.6;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 spacing-vars.$space-3 1.5rem;
  padding: 0;
}

.markdown-body :deep(li) {
  margin-bottom: spacing-vars.$space-2;
  line-height: 1.6;
}

.markdown-body :deep(a) {
  color: color-vars.$color-primary;
  text-decoration: underline;
  word-break: break-all;
}

.markdown-body :deep(code) {
  background-color: color-vars.$color-bg-secondary;
  padding: 0 0.25rem;
  border-radius: radius-vars.$radius-sm;
  font-family: typography-vars.$font-family-mono;
  font-size: 0.95em;
}

.markdown-body :deep(pre) {
  background-color: color-vars.$color-bg-secondary;
  padding: spacing-vars.$space-3;
  border-radius: radius-vars.$radius-md;
  overflow-x: auto;
  font-family: typography-vars.$font-family-mono;
  font-size: 0.95em;
}

.markdown-body :deep(blockquote) {
  margin: 0 0 spacing-vars.$space-3;
  padding-left: spacing-vars.$space-3;
  border-left: 3px solid color-vars.$color-primary;
  color: color-vars.$color-text-secondary;
  font-style: italic;
}
</style>
