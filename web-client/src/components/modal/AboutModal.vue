<template>
  <div
    v-if="isVisible"
    class="modal-overlay"
    @click="handleOverlayClick"
  >
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-content">
          <h3>{{ $t('ui.menu.about') }}</h3>
        </div>
        <button
          class="close-button"
          @click="closeModal"
        >
          <IonIcon :icon="closeOutline" />
        </button>
      </div>

      <div class="modal-body">
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  bugOutline,
  closeOutline,
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
import { onMounted, onUnmounted, ref } from 'vue';

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

function handleOverlayClick(event: Event) {
  if (event.target === event.currentTarget) {
    closeModal();
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.isVisible) {
    closeModal();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape);
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px 16px;
  border-bottom: 1px solid #f1f3f4;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.header-content h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  color: white;
  transition: background 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.close-button ion-icon {
  font-size: 1.2rem;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
}

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

.app-logo ion-icon {
  font-size: 4rem;
  color: #667eea;
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

.tech-item ion-icon {
  font-size: 1.2rem;
  color: #667eea;
}

.tech-item span {
  font-weight: 500;
  color: #495057;
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.features-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  color: #495057;
  line-height: 1.5;
}

.features-list li ion-icon {
  color: #28a745;
  font-size: 1.1rem;
  flex-shrink: 0;
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

.project-link ion-icon {
  font-size: 1.2rem;
  color: #667eea;
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
  .modal-content {
    max-width: 95vw;
    margin: 10px;
  }

  .modal-header,
  .modal-body {
    padding: 20px;
  }

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
