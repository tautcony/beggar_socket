<template>
  <BaseModal
    v-if="activeNotice"
    v-model="visible"
    :width="520"
    max-height="80vh"
    :mask-closable="false"
    :esc-closable="false"
    @close="onAcknowledge"
  >
    <template #header>
      <div class="modal-title-wrapper">
        <div class="modal-title-text">
          <span class="title-label">{{ $t('ui.systemNotice.title') }}</span>
          <h3 class="title-content">
            {{ activeNotice.title }}
          </h3>
        </div>
        <div class="publish-info">
          <span class="publish-label">{{ $t('ui.systemNotice.publishedAt') }}</span>
          <time class="publish-time">
            {{ publishedAtLabel }}
          </time>
        </div>
      </div>
    </template>

    <!-- eslint-disable vue/no-v-html -->
    <div
      class="notice-content markdown-body"
      v-html="displayContentHtml"
    />
    <!-- eslint-enable vue/no-v-html -->
    <template v-if="showTranslateButton">
      <p
        v-if="translationError"
        class="notice-translation-status error"
      >
        {{ translationError }}
      </p>
      <p
        v-else-if="translationLoading"
        class="notice-translation-status"
      >
        {{ $t('ui.systemNotice.translating') }}
      </p>
    </template>

    <template #footer>
      <BaseButton
        v-if="showTranslateButton"
        variant="secondary"
        :disabled="translationLoading || !activeNotice"
        @click="onTranslate"
      >
        {{ translateButtonLabel }}
      </BaseButton>
      <BaseButton
        variant="primary"
        @click="onAcknowledge"
      >
        {{ $t('ui.systemNotice.acknowledge') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseButton from '@/components/common/BaseButton.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import {
  fetchSystemNoticeConfig,
  fetchSystemNoticeMarkdown,
  hasNoticeBeenAcknowledged,
  markNoticeAcknowledged,
  type SystemNoticeMeta,
} from '@/services/system-notice-service';
import { renderMarkdown } from '@/utils/markdown';
import { translateText } from '@/utils/translation';

interface SystemNotice extends SystemNoticeMeta {
  contentHtml: string;
  contentMarkdown: string;
}

const visible = ref(false);
const activeNotice = ref<SystemNotice | null>(null);
const { locale, t } = useI18n();
const showTranslateButton = computed(() => locale.value !== 'zh-Hans');

const showTranslation = ref(false);
const translationHtml = ref('');
const translationError = ref('');
const translationLoading = ref(false);

const displayContentHtml = computed(() => {
  if (showTranslateButton.value && showTranslation.value && translationHtml.value) {
    return translationHtml.value;
  }

  return activeNotice.value?.contentHtml ?? '';
});

const translateButtonLabel = computed(() => {
  if (!showTranslateButton.value) {
    return '';
  }

  if (translationLoading.value) {
    return t('ui.systemNotice.translating');
  }
  if (showTranslation.value && translationHtml.value) {
    return t('ui.systemNotice.viewOriginal');
  }
  if (translationHtml.value) {
    return t('ui.systemNotice.viewTranslation');
  }
  return t('ui.systemNotice.translate');
});

function resetTranslation() {
  showTranslation.value = false;
  translationHtml.value = '';
  translationError.value = '';
  translationLoading.value = false;
}

watch(locale, () => {
  if (!showTranslateButton.value) {
    resetTranslation();
  }
});

async function loadSystemNotice() {
  try {
    const notifications = await fetchSystemNoticeConfig();

    for (const notice of notifications) {
      if (!notice.id || !notice.contentPath) {
        continue;
      }

      if (hasNoticeBeenAcknowledged(notice.id)) {
        continue;
      }

      const markdown = await fetchSystemNoticeMarkdown(notice.contentPath);
      if (!markdown) {
        continue;
      }

      resetTranslation();
      activeNotice.value = {
        ...notice,
        contentHtml: renderMarkdown(markdown),
        contentMarkdown: markdown,
      };
      visible.value = true;
      break;
    }
  } catch (error) {
    console.warn('[SystemNotice] Failed to load notifications', error);
  }
}

onMounted(() => {
  void loadSystemNotice();
});

const publishedAtLabel = computed(() => {
  if (!activeNotice.value) {
    return '';
  }

  const date = DateTime.fromISO(activeNotice.value.publishedAt);
  if (!date.isValid) {
    return activeNotice.value.publishedAt;
  }

  return date.setLocale(locale.value).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
});

function onAcknowledge() {
  if (activeNotice.value) {
    markNoticeAcknowledged(activeNotice.value.id);
  }
  visible.value = false;
  activeNotice.value = null;
  resetTranslation();
}

async function onTranslate() {
  if (!activeNotice.value || translationLoading.value) {
    return;
  }

  if (showTranslation.value) {
    showTranslation.value = false;
    return;
  }

  if (translationHtml.value) {
    translationError.value = '';
    showTranslation.value = true;
    return;
  }

  translationLoading.value = true;
  translationError.value = '';
  try {
    const translated = await translateText(activeNotice.value.contentMarkdown, locale.value);
    if (translated) {
      translationHtml.value = renderMarkdown(translated);
      showTranslation.value = true;
    } else {
      translationError.value = t('ui.systemNotice.translationFailed');
    }
  } catch (error) {
    console.warn('[SystemNotice] Translation failed', error);
    translationError.value = t('ui.systemNotice.translationFailed');
  } finally {
    translationLoading.value = false;
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;

.modal-title-wrapper {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-2;
}

.modal-title-text {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-1;
}

.title-label {
  font-size: typography-vars.$font-size-xs;
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-text-secondary;
  text-transform: uppercase;
}

.title-content {
  margin: 0;
  font-size: typography-vars.$font-size-xl;
  font-weight: typography-vars.$font-weight-bold;
  color: color-vars.$color-text;
  line-height: 1.3;
}

.publish-info {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: spacing-vars.$space-2;
  font-size: typography-vars.$font-size-sm;
  color: color-vars.$color-text-secondary;
}

.publish-label {
  font-weight: typography-vars.$font-weight-medium;
}

.publish-time {
  font-family: typography-vars.$font-family-mono;
}

.notice-content {
  max-height: 60vh;
  overflow-y: auto;
  color: color-vars.$color-text;
}

.notice-translation-status {
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
