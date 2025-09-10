import { isElectron } from '@/utils/electron';

/**
 * 环境配置组合
 */
export class Environment {
  /**
   * 检查是否为 Electron 环境
   */
  static get isElectron(): boolean {
    return isElectron();
  }

  /**
   * 检查是否为 Web 环境
   */
  static get isWeb(): boolean {
    return !isElectron();
  }

  /**
   * 检查是否为开发环境
   */
  static get isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * 检查是否为生产环境
   */
  static get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * 获取当前环境描述
   */
  static get description(): string {
    const platform = this.isElectron ? 'Electron' : 'Web';
    const env = this.isDevelopment ? 'Development' : 'Production';
    return `${platform} (${env})`;
  }
}
