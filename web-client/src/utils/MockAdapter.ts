import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from './CartridgeAdapter'
import { CommandResult } from '@/types/CommandResult'
import { CommandOptions } from '@/types/CommandOptions'
import { DebugConfig } from './DebugConfig'

/**
 * 模拟适配器类
 * 用于调试模式下模拟设备操作
 */
export class MockAdapter extends CartridgeAdapter {
  private mockRomData: Uint8Array | null = null
  private mockRamData: Uint8Array | null = null

  constructor(
    logCallback: LogCallback | null = null,
    progressCallback: ProgressCallback | null = null,
    translateFunc: TranslateFunction | null = null
  ) {
    // 创建模拟设备
    const mockDevice = DebugConfig.createMockDevice()
    super({
      device: mockDevice,
      endpointIn: 1,
      endpointOut: 1,
    }, logCallback, progressCallback, translateFunc)
    
    this.log('🎭 调试模式已启用 - 使用模拟设备', 'warning')
  }

  /**
   * 模拟读取芯片ID
   */
  async readID(): Promise<CommandResult & { idStr?: string }> {
    this.log('🔍 模拟读取芯片ID...', 'info')
    
    await DebugConfig.delay()
    
    if (DebugConfig.shouldSimulateError()) {
      return {
        success: false,
        message: this.t('messages.operation.readIdFailed') + ' (模拟错误)'
      }
    }

    const mockId = '模拟芯片 MX25L6445E'
    this.idStr = mockId
    
    return {
      success: true,
      message: this.t('messages.operation.readIdSuccess', { id: mockId }),
      idStr: mockId
    }
  }

  /**
   * 模拟擦除芯片
   */
  async eraseChip(): Promise<CommandResult> {
    this.log('🗑️ 模拟擦除芯片...', 'info')
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || '模拟擦除中...'),
      2000
    )
    this.updateProgress(100, '')
    this.log('✅ 模拟擦除完成', 'success')
    
    if (DebugConfig.shouldSimulateError()) {
      return {
        success: false,
        message: this.t('messages.operation.eraseFailed') + ' (模拟错误)'
      }
    }

    // 清空模拟数据
    this.mockRomData = null
    this.mockRamData = null
    
    return {
      success: true,
      message: this.t('messages.operation.eraseSuccess')
    }
  }

  /**
   * 模拟写入ROM
   */
  async writeROM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    this.log(`📝 模拟写入ROM，大小: ${data.length} 字节`, 'info')
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || `模拟写入ROM... ${Math.floor(progress)}%`),
      3000
    )
    
    if (DebugConfig.shouldSimulateError()) {
      return {
        success: false,
        message: this.t('messages.rom.writeFailed') + ' (模拟错误)'
      }
    }

    // 保存模拟数据
    this.mockRomData = new Uint8Array(data)
    
    return {
      success: true,
      message: this.t('messages.rom.writeSuccess')
    }
  }

  /**
   * 模拟读取ROM
   */
  async readROM(size: number): Promise<CommandResult & { data?: Uint8Array }> {
    this.log(`📖 模拟读取ROM，大小: ${size} 字节`, 'info')
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || `模拟读取ROM... ${Math.floor(progress)}%`),
      2500
    )
    
    if (DebugConfig.shouldSimulateError()) {
      return {
        success: false,
        message: this.t('messages.rom.readFailed') + ' (模拟错误)'
      }
    }

    // 返回之前写入的数据或生成随机数据
    const data = this.mockRomData?.slice(0, size) || DebugConfig.generateRandomData(size)
    
    return {
      success: true,
      message: this.t('messages.rom.readSuccess', { size }),
      data
    }
  }

  /**
   * 模拟校验ROM
   */
  async verifyROM(data: Uint8Array): Promise<CommandResult> {
    this.log(`✅ 模拟校验ROM，大小: ${data.length} 字节`, 'info')
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || `模拟校验ROM... ${Math.floor(progress)}%`),
      2000
    )
    
    if (DebugConfig.shouldSimulateError()) {
      return {
        success: false,
        message: this.t('messages.rom.verifyFailed') + ' (模拟错误)'
      }
    }

    // 模拟校验结果
    const isMatch = this.mockRomData && this.compareData(data, this.mockRomData)
    
    return {
      success: isMatch !== false,
      message: isMatch !== false 
        ? this.t('messages.rom.verifySuccess')
        : this.t('messages.rom.verifyFailed') + ' (数据不匹配)'
    }
  }

  /**
   * 模拟写入RAM
   */
  async writeRAM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    this.log(`📝 模拟写入RAM，大小: ${data.length} 字节`, 'info')
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || `模拟写入RAM... ${Math.floor(progress)}%`),
      1500
    )
    
    if (DebugConfig.shouldSimulateError()) {
      return {
        success: false,
        message: this.t('messages.ram.writeFailed') + ' (模拟错误)'
      }
    }

    // 保存模拟数据
    this.mockRamData = new Uint8Array(data)
    
    return {
      success: true,
      message: this.t('messages.ram.writeSuccess')
    }
  }

  /**
   * 模拟读取RAM
   */
  async readRAM(size: number): Promise<CommandResult & { data?: Uint8Array }> {
    this.log(`📖 模拟读取RAM，大小: ${size} 字节`, 'info')
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || `模拟读取RAM... ${Math.floor(progress)}%`),
      1000
    )
    
    if (DebugConfig.shouldSimulateError()) {
      return {
        success: false,
        message: this.t('messages.ram.readFailed') + ' (模拟错误)'
      }
    }

    // 返回之前写入的数据或生成随机数据
    const data = this.mockRamData?.slice(0, size) || DebugConfig.generateRandomData(size)
    
    return {
      success: true,
      message: this.t('messages.ram.readSuccess', { size }),
      data
    }
  }

  /**
   * 模拟校验RAM
   */
  async verifyRAM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    this.log(`✅ 模拟校验RAM，大小: ${data.length} 字节`, 'info')
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || `模拟校验RAM... ${Math.floor(progress)}%`),
      1500
    )
    
    if (DebugConfig.shouldSimulateError()) {
      return {
        success: false,
        message: this.t('messages.ram.verifyFailed') + ' (模拟错误)'
      }
    }

    // 模拟校验结果
    const isMatch = this.mockRamData && this.compareData(data, this.mockRamData)
    
    return {
      success: isMatch !== false,
      message: isMatch !== false 
        ? this.t('messages.ram.verifySuccess')
        : this.t('messages.ram.verifyFailed') + ' (数据不匹配)'
    }
  }

  /**
   * 比较两个数据数组
   */
  private compareData(data1: Uint8Array, data2: Uint8Array): boolean {
    if (data1.length !== data2.length) return false
    
    const compareLength = Math.min(data1.length, data2.length)
    for (let i = 0; i < compareLength; i++) {
      if (data1[i] !== data2[i]) return false
    }
    
    return true
  }
}
