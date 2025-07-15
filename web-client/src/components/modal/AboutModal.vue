<template>
  <BaseModal
    :visible="isVisible"
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
import { ref } from 'vue';

import BaseModal from '@/components/common/BaseModal.vue';

const props = defineProps<{
  isVisible: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const appVersion = ref(import.meta.env.VITE_APP_VERSION ?? '1.0.0');

function closeModal() {
  emit('close');
}
</script>

<style scoped>
.about-section {
  margin-bottom: 32px;
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
  margin-bottom: 16px;
}

.app-name {
  margin: 0 0 8px 0;
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-version {
  margin: 0 0 12px 0;
  color: #6c757d;
  font-size: 1rem;
  font-weight: 500;
}

.app-description {
  margin: 0;
  color: #495057;
  font-size: 1rem;
  line-height: 1.6;
}

.about-section h4 {
  margin: 0 0 16px 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 2px solid #e9ecef;
  padding-bottom: 8px;
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.tech-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  transition: all 0.2s ease;
}

.tech-item:hover {
  background: #e9ecef;
  transform: translateY(-2px);
}

.tech-item span {
  font-weight: 500;
  color: #495057;
}

.project-links {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  text-decoration: none;
  color: #495057;
  transition: all 0.2s ease;
}

.project-link:hover {
  background: #e9ecef;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.external-icon {
  margin-left: auto;
  font-size: 1rem !important;
  color: #6c757d !important;
}

.project-link span {
  font-weight: 500;
  flex: 1;
}

.license-text,
.acknowledgments-text {
  margin: 0;
  color: #495057;
  line-height: 1.6;
  font-size: 0.95rem;
  padding-bottom: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .app-name {
    font-size: 1.8rem;
  }

  .tech-grid {
    grid-template-columns: 1fr;
  }

  .project-links {
    gap: 8px;
  }

  .project-link {
    padding: 10px 12px;
  }
}
</style>
