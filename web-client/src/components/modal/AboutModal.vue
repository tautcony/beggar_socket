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

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.about-section {
  margin-bottom: spacing-vars.$space-8;

  &:last-child {
    margin-bottom: 0;
  }

  h4 {
    margin: 0 0 spacing-vars.$space-4 0;
    font-size: typography-vars.$font-size-xl;
    font-weight: typography-vars.$font-weight-semibold;
    color: color-vars.$color-text;
    border-bottom: 2px solid color-vars.$color-border-light;
    padding-bottom: spacing-vars.$space-2;
  }
}

.app-logo {
  text-align: center;

  .logo-icon {
    width: 96px;
    height: 96px;
    object-fit: contain;
  }
}

.app-info {
  text-align: center;
  margin-bottom: spacing-vars.$space-4;
}

.app-name {
  margin: 0 0 spacing-vars.$space-2 0;
  font-size: typography-vars.$font-size-4xl;
  font-weight: typography-vars.$font-weight-bold;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-version {
  margin: 0 0 spacing-vars.$space-3 0;
  color: color-vars.$color-secondary;
  font-size: typography-vars.$font-size-base;
  font-weight: typography-vars.$font-weight-medium;
}

.app-description {
  margin: 0;
  color: color-vars.$color-text;
  font-size: typography-vars.$font-size-base;
  line-height: typography-vars.$line-height-relaxed;
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: spacing-vars.$space-4;
}

.tech-item {
  @include mixins.flex-center;
  gap: spacing-vars.$space-2;
  padding: spacing-vars.$space-3 spacing-vars.$space-4;
  background: color-vars.$color-bg-secondary;
  border-radius: radius-vars.$radius-lg;
  border: 1px solid color-vars.$color-border-light;
  transition: all 0.2s ease;

  &:hover {
    background: color-vars.$color-bg-tertiary;
    transform: translateY(-2px);
  }

  span {
    font-weight: typography-vars.$font-weight-medium;
    color: color-vars.$color-text;
  }
}

.project-links {
  @include mixins.flex-column;
  gap: spacing-vars.$space-3;
}

.project-link {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-3;
  padding: spacing-vars.$space-2 spacing-vars.$space-3;
  background: color-vars.$color-bg-secondary;
  border-radius: radius-vars.$radius-lg;
  border: 1px solid color-vars.$color-border-light;
  text-decoration: none;
  color: color-vars.$color-text;
  transition: all 0.2s ease;

  &:hover {
    background: color-vars.$color-bg-tertiary;
    transform: translateY(-2px);
    box-shadow: color-vars.$shadow-md;
  }

  span {
    font-weight: typography-vars.$font-weight-medium;
    flex: 1;
  }
}

.external-icon {
  margin-left: auto;
  font-size: typography-vars.$font-size-base !important;
  color: color-vars.$color-secondary !important;
}

.license-text,
.acknowledgments-text {
  margin: 0;
  color: color-vars.$color-text;
  line-height: typography-vars.$line-height-relaxed;
  font-size: typography-vars.$font-size-sm;
  padding-bottom: spacing-vars.$space-4;
}
</style>
