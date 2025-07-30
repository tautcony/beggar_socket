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
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.select-container {
  position: relative;
  display: flex;
  align-items: center;
}

.lang-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.2em;
  color: #1976d2;
  transition: color 0.2s ease;
  pointer-events: none;
  z-index: 1;
}

.select-container:hover .lang-icon {
  color: #1565c0;
}

.dropdown-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1em;
  color: #666;
  transition: color 0.2s ease;
  pointer-events: none;
  z-index: 1;
}

.select-container:hover .dropdown-icon {
  color: #333;
}

.language-select {
  padding: 8px 30px 8px 40px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  color: #333;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  appearance: none;
  transition: all 0.2s ease;
  min-width: 120px;
}

.language-select:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.language-select:hover {
  border-color: #aaa;
  transform: translateY(-1px);
}

.language-select option {
  background-color: white;
  color: #333;
}
</style>
