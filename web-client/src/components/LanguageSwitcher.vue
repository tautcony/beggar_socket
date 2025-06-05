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
        name="globe-outline"
        class="lang-icon"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { IonIcon } from '@ionic/vue';

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

.language-select {
  padding: 8px 12px 8px 40px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  color: #333;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 1em;
  padding-right: 30px;
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
