<template>
  <div class="language-switcher">
    <div class="select-container">
      <select
        v-model="currentLocale"
        class="language-select"
        @change="changeLanguage"
      >
        <option value="zh-CN">
          中文
        </option>
        <option value="en-US">
          English
        </option>
        <option value="ja-JP">
          日本語
        </option>
      </select>
      <IonIcon
        :icon="globeOutline"
        class="lang-icon"
      />
      <IonIcon
        :icon="chevronDown"
        class="dropdown-icon"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { chevronDown, globeOutline } from 'ionicons/icons';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();
const currentLocale = ref(locale.value);

onMounted(() => {
  currentLocale.value = locale.value;
});

function changeLanguage() {
  locale.value = currentLocale.value;
  localStorage.setItem('locale', currentLocale.value);
}
</script>

<style scoped>
.language-switcher {
  position: fixed;
  top: var(--space-5);
  right: var(--space-5);
  z-index: 1000;
}

.select-container {
  position: relative;
  display: flex;
  align-items: center;
}

.lang-icon {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.2em;
  color: var(--color-primary);
  transition: color 0.2s ease;
  pointer-events: none;
  z-index: 1;
}

.select-container:hover .lang-icon {
  color: var(--color-primary-hover);
}

.dropdown-icon {
  position: absolute;
  right: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  font-size: 1em;
  color: var(--color-text-secondary);
  transition: color 0.2s ease;
  pointer-events: none;
  z-index: 1;
}

.select-container:hover .dropdown-icon {
  color: var(--color-text);
}

.language-select {
  padding: var(--space-2) var(--space-8) var(--space-2) var(--space-10);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  appearance: none;
  transition: all 0.2s ease;
  min-width: 120px;
}

.language-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.language-select:hover {
  border-color: var(--color-border-dark);
  transform: translateY(-1px);
}

.language-select option {
  background-color: var(--color-bg);
  color: var(--color-text);
}
</style>
