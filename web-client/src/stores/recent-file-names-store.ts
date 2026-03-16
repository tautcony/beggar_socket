import { defineStore } from 'pinia';

const STORAGE_KEY = 'recentFileNames';
const MAX_COUNT = 10;

export interface RecentFileNamesState {
  fileNames: string[];
  maxCount: number;
}

function loadFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]).filter(n => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

function saveToStorage(fileNames: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fileNames));
  } catch {
    // localStorage might be unavailable (e.g. private mode). Ignore silently.
  }
}

export const useRecentFileNamesStore = defineStore('recentFileNames', {
  state: (): RecentFileNamesState => ({
    fileNames: loadFromStorage(),
    maxCount: MAX_COUNT,
  }),

  getters: {
    hasFileNames: (state: RecentFileNamesState): boolean =>
      state.fileNames.length > 0,
  },

  actions: {
    // 添加新的文件名到列表开头，如果已存在则移到开头
    addFileName(fileName: string) {
      if (!fileName || fileName.trim() === '') return;

      // 移除已存在的文件名
      this.fileNames = this.fileNames.filter(name => name !== fileName);

      // 添加到开头
      this.fileNames.unshift(fileName);

      // 保持最大数量
      if (this.fileNames.length > this.maxCount) {
        this.fileNames = this.fileNames.slice(0, this.maxCount);
      }

      saveToStorage(this.fileNames);
    },

    // 清除所有文件名
    clearFileNames() {
      this.fileNames = [];
      saveToStorage(this.fileNames);
    },

    // 获取文件名列表（返回副本）
    getFileNames(): string[] {
      return [...this.fileNames];
    },
  },
});
