<template>
  <BaseModal
    v-model="localVisible"
    :title="$t('ui.menu.about')"
    width="600px"
    max-height="90vh"
    @close="closeModal"
  >
    <!-- 应用信息 -->
    <div class="about-section">
      <div class="app-logo">
        <img
          src="/console.svg"
          alt="ChisFlash Logo"
          class="logo-icon"
        >
      </div>
      <div class="app-info">
        <h2 class="app-name">
          {{ $t('ui.app.title') }}
        </h2>
        <p class="app-version">
          {{ $t('ui.about.version') }}: {{ appVersion }}
        </p>
        <p class="app-description">
          {{ $t('ui.about.description') }}
        </p>
      </div>
    </div>

    <!-- 技术栈 -->
    <div class="about-section">
      <h4>{{ $t('ui.about.techStack') }}</h4>
      <div class="tech-grid">
        <div class="tech-item">
          <IonIcon :icon="logoVue" />
          <span>Vue 3</span>
        </div>
        <div class="tech-item">
          <IonIcon :icon="languageOutline" />
          <span>Vue I18n</span>
        </div>
        <div class="tech-item">
          <IonIcon :icon="flashOutline" />
          <span>Ionic Vue</span>
        </div>
        <div class="tech-item">
          <IonIcon :icon="codeSlashOutline" />
          <span>TypeScript</span>
        </div>
        <div class="tech-item">
          <IonIcon :icon="globeOutline" />
          <span>Vite</span>
        </div>
        <div class="tech-item">
          <IonIcon :icon="linkOutline" />
          <span>Web Serial</span>
        </div>
      </div>
    </div>

    <!-- 项目信息 -->
    <div class="about-section">
      <h4>{{ $t('ui.about.projectInfo') }}</h4>
      <div class="project-links">
        <a
          href="https://github.com/tautcony/beggar_socket"
          target="_blank"
          rel="noopener noreferrer"
          class="project-link"
        >
          <IonIcon :icon="logoGithub" />
          <span>{{ $t('ui.about.sourceCode') }}</span>
          <IonIcon
            :icon="openOutline"
            class="external-icon"
          />
        </a>
        <a
          href="https://github.com/tautcony/beggar_socket/issues"
          target="_blank"
          rel="noopener noreferrer"
          class="project-link"
        >
          <IonIcon :icon="bugOutline" />
          <span>{{ $t('ui.about.reportIssue') }}</span>
          <IonIcon
            :icon="openOutline"
            class="external-icon"
          />
        </a>
      </div>
    </div>

    <!-- 许可证 -->
    <div class="about-section">
      <h4>{{ $t('ui.about.license') }}</h4>
      <p class="license-text">
        {{ $t('ui.about.licenseText') }}
      </p>
      <a
        href="https://github.com/tautcony/beggar_socket/blob/main/web-client/LICENSE"
        target="_blank"
        rel="noopener noreferrer"
        class="project-link"
      >
        <IonIcon :icon="documentTextOutline" />
        <span>{{ $t('ui.about.viewLicense') }}</span>
        <IonIcon
          :icon="openOutline"
          class="external-icon"
        />
      </a>
    </div>

    <!-- 致谢 -->
    <div class="about-section">
      <h4>{{ $t('ui.about.acknowledgments') }}</h4>
      <p class="acknowledgments-text">
        {{ $t('ui.about.acknowledgmentsText') }}
      </p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  bugOutline,
  codeSlashOutline,
  documentTextOutline,
  flashOutline,
  globeOutline,
  languageOutline,
  linkOutline,
  logoGithub,
  logoVue,
  openOutline,
} from 'ionicons/icons';
import { computed, ref } from 'vue';

import BaseModal from '@/components/common/BaseModal.vue';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

// 创建一个计算属性来处理 v-model
const localVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    emit('update:modelValue', value);
  },
});

const appVersion = ref(import.meta.env.VITE_APP_VERSION ?? '1.0.0');

function closeModal() {
  emit('close');
}
</script>

<style scoped>
.about-section {
  margin-bottom: var(--space-8);
}

.about-section:last-child {
  margin-bottom: 0;
}

.app-logo {
  text-align: center;
}

.app-logo .logo-icon {
  width: 96px;
  height: 96px;
  object-fit: contain;
}

.app-info {
  text-align: center;
  margin-bottom: var(--space-4);
}

.app-name {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-version {
  margin: 0 0 var(--space-3) 0;
  color: var(--color-secondary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
}

.app-description {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
}

.about-section h4 {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  border-bottom: 2px solid var(--color-border-light);
  padding-bottom: var(--space-2);
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-4);
}

.tech-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  transition: all 0.2s ease;
}

.tech-item:hover {
  background: var(--color-bg-tertiary);
  transform: translateY(-2px);
}

.tech-item span {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.project-links {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.project-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  text-decoration: none;
  color: var(--color-text);
  transition: all 0.2s ease;
}

.project-link:hover {
  background: var(--color-bg-tertiary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.external-icon {
  margin-left: auto;
  font-size: var(--font-size-base) !important;
  color: var(--color-secondary) !important;
}

.project-link span {
  font-weight: var(--font-weight-medium);
  flex: 1;
}

.license-text,
.acknowledgments-text {
  margin: 0;
  color: var(--color-text);
  line-height: var(--line-height-relaxed);
  font-size: var(--font-size-sm);
  padding-bottom: var(--space-4);
}
</style>
