<template>
  <div class="language-switcher">
    <select
      v-model="currentLocale"
      class="language-select"
      @change="changeLanguage"
    >
      <option value="zh-CN">
        🇨🇳 中文
      </option>
      <option value="en-US">
        🇺🇸 English
      </option>
      <option value="ja-JP">
        🇯🇵 日本語
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()
const currentLocale = ref(locale.value)

onMounted(() => {
  currentLocale.value = locale.value
})

function changeLanguage() {
  locale.value = currentLocale.value
  localStorage.setItem('locale', currentLocale.value)
}
</script>

<style scoped>
.language-switcher {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.language-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  color: #333; /* 添加深色文本颜色，确保在浅色背景下可见 */
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
}

/* 添加夜间模式支持 */
@media (prefers-color-scheme: dark) {
  .language-select {
    background: #3a3a3a; /* 夜间模式下的背景色 */
    color: #fff; /* 夜间模式下的文本颜色 */
    border-color: #555;
  }
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

@media (prefers-color-scheme: dark) {
  .language-select option {
    background-color: #3a3a3a;
    color: #fff;
  }
}
</style>
