import { defineStore } from 'pinia';

export interface RecentFileNamesState {
  fileNames: string[];
  maxCount: number;
}

export const useRecentFileNamesStore = defineStore('recentFileNames', {
  state: (): RecentFileNamesState => ({
    fileNames: [],
    maxCount: 10,
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
    },

    // 清除所有文件名
    clearFileNames() {
      this.fileNames = [];
    },

    // 获取文件名列表（返回副本）
    getFileNames(): string[] {
      return [...this.fileNames];
    },
  },
});
