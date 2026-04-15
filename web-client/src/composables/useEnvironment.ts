import { isTauri } from '@/utils/tauri';

/**
 * 环境配置组合
 */
export class Environment {
  /**
   * 检查是否为 Tauri 环境
   */
  static get isTauri(): boolean {
    return isTauri();
  }

  /**
   * 检查是否为 Web 环境
   */
  static get isWeb(): boolean {
    return !isTauri();
  }

  /**
   * 检查是否为开发环境
   */
  static get isDevelopment(): boolean {
    return import.meta.env.DEV;
  }

  /**
   * 检查是否为生产环境
   */
  static get isProduction(): boolean {
    return import.meta.env.PROD;
  }

  /**
   * 获取当前环境描述
   */
  static get description(): string {
    const platform = this.isTauri ? 'Tauri' : 'Web';
    const env = this.isDevelopment ? 'Development' : 'Production';
    return `${platform} (${env})`;
  }
}
