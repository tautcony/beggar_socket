<template>
  <div class="github-link">
    <a 
      href="https://github.com/tautcony/beggar_socket" 
      target="_blank" 
      rel="noopener noreferrer"
      class="github-button"
      :title="$t('ui.github.tooltip')"
    >
      <svg 
        class="github-icon" 
        viewBox="0 0 24 24" 
        fill="currentColor"
      >
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
      <span class="github-text">GitHub</span>
    </a>
  </div>
</template>

<script setup lang="ts">
// No additional script needed for this component
</script>

<style scoped>
.github-link {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
}

.github-button {
  display: flex;
  align-items: center;
  background: #24292e;
  color: white;
  padding: 8px 12px;
  border-radius: 25px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  transform: translateX(calc(100% - 40px));
  overflow: hidden;
  white-space: nowrap;
}

.github-button:hover {
  background: #2f363d;
  transform: translateX(0);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.github-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.github-text {
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.3s ease 0.1s;
}

.github-button:hover .github-text {
  opacity: 1;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .github-link {
    bottom: 10px;
    right: 10px;
  }
  
  .github-button {
    padding: 6px 10px;
    font-size: 12px;
  }
  
  .github-icon {
    width: 18px;
    height: 18px;
  }
}
</style>
