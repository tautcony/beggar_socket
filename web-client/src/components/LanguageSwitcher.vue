<template>
  <div
    class="language-switcher"
    :class="{ 'is-inline': inline }"
  >
    <RetroSelect
      v-model="currentLocale"
      class="language-select"
      prefix-icon="pixelarticons:globe"
      @change="changeLanguage"
    >
      <option value="zh-Hans">
        简体中文
      </option>
      <option value="zh-Hant">
        繁體中文
      </option>
      <option value="en-US">
        English
      </option>
      <option value="ja-JP">
        日本語
      </option>
      <option value="ru-RU">
        Русский
      </option>
    </RetroSelect>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { RetroSelect } from '@/components/retro';
import { normalizeLocale } from '@/i18n';

withDefaults(defineProps<{
  inline?: boolean;
}>(), {
  inline: false,
});

const { locale } = useI18n();
const currentLocale = ref(normalizeLocale(locale.value) ?? 'zh-Hans');

watch(locale, (newLocale) => {
  const normalized = normalizeLocale(newLocale) ?? 'zh-Hans';
  currentLocale.value = normalized;
  if (locale.value !== normalized) {
    locale.value = normalized;
  }
}, { immediate: true });

function changeLanguage() {
  const normalized = normalizeLocale(currentLocale.value) ?? 'zh-Hans';
  currentLocale.value = normalized;
  locale.value = normalized;

  try {
    localStorage.setItem('locale', normalized);
  } catch {
    // ignore storage failures in restricted environments
  }
}
</script>

<style scoped>
.language-switcher {
  position: fixed;
  top: var(--space-5);
  right: var(--space-5);
  z-index: 1000;
}

.language-switcher.is-inline {
  position: static;
  top: auto;
  right: auto;
  z-index: auto;
}

.language-select {
  min-width: 112px;
}
</style>
