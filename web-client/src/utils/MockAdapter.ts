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
    
    this.log(this.t('messages.debug.mockModeEnabled') || '调试模式已启用 - 使用模拟设备')
  }

  /**
   * 模拟读取芯片ID
   */
  async readID(): Promise<CommandResult & { idStr?: string }> {
    this.log(this.t('messages.operation.readId'))
    
    await DebugConfig.delay()
    
    if (DebugConfig.shouldSimulateError()) {
      this.log(`${this.t('messages.operation.readIdFailed')}: 模拟错误`)
      return {
        success: false,
        message: this.t('messages.operation.readIdFailed')
      }
    }

    const mockId = '0001'
    this.idStr = mockId
    this.log(`${this.t('messages.operation.readIdSuccess')}: ${this.idStr}`)
    
    return {
      success: true,
      message: this.t('messages.operation.readIdSuccess'),
      idStr: mockId
    }
  }

  /**
   * 模拟擦除芯片
   */
  async eraseChip(): Promise<CommandResult> {
    this.log(this.t('messages.operation.eraseChip'))
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || this.t('messages.operation.eraseChip')),
      2000
    )
    
    if (DebugConfig.shouldSimulateError()) {
      this.log(`${this.t('messages.operation.eraseFailed')}: 模拟错误`)
      return {
        success: false,
        message: this.t('messages.operation.eraseFailed')
      }
    }

    // 清空模拟数据
    this.mockRomData = null
    this.mockRamData = null
    
    this.log(this.t('messages.operation.eraseSuccess'))
    return {
      success: true,
      message: this.t('messages.operation.eraseSuccess')
    }
  }

  /**
   * 模拟写入ROM
   */
  async writeROM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    this.log(this.t('messages.rom.writing', { size: data.length }))
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || this.t('messages.progress.writing', { written: Math.floor(data.length * progress / 100), total: data.length })),
      3000
    )
    
    if (DebugConfig.shouldSimulateError()) {
      this.log(`${this.t('messages.rom.writeFailed')}: 模拟错误`)
      return {
        success: false,
        message: this.t('messages.rom.writeFailed')
      }
    }

    // 保存模拟数据
    this.mockRomData = new Uint8Array(data)
    
    this.log(this.t('messages.rom.writeComplete'))
    return {
      success: true,
      message: this.t('messages.rom.writeSuccess')
    }
  }

  /**
   * 模拟读取ROM
   */
  async readROM(size: number): Promise<CommandResult & { data?: Uint8Array }> {
    this.log(this.t('messages.rom.reading'))
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || this.t('messages.progress.reading', { read: Math.floor(size * progress / 100), total: size })),
      2500
    )
    
    if (DebugConfig.shouldSimulateError()) {
      this.log(`${this.t('messages.rom.readFailed')}: 模拟错误`)
      return {
        success: false,
        message: this.t('messages.rom.readFailed')
      }
    }

    // 返回之前写入的数据或生成随机数据
    const data = this.mockRomData?.slice(0, size) || DebugConfig.generateRandomData(size)
    
    this.log(this.t('messages.rom.readSuccess', { size: data.length }))
    return {
      success: true,
      message: this.t('messages.rom.readSuccess', { size: data.length }),
      data
    }
  }

  /**
   * 模拟校验ROM
   */
  async verifyROM(data: Uint8Array): Promise<CommandResult> {
    this.log(this.t('messages.rom.verifying'))
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || this.t('messages.progress.verifying', { verified: Math.floor(data.length * progress / 100), total: data.length })),
      2000
    )
    
    if (DebugConfig.shouldSimulateError()) {
      this.log(`${this.t('messages.rom.verifyFailed')}: 模拟错误`)
      return {
        success: false,
        message: this.t('messages.rom.verifyFailed')
      }
    }

    // 模拟校验结果
    const isMatch = this.mockRomData && this.compareData(data, this.mockRomData)
    const message = isMatch !== false ? this.t('messages.rom.verifySuccess') : this.t('messages.rom.verifyFailed')
    
    this.log(`${this.t('messages.rom.verify')}: ${message}`)
    return {
      success: isMatch !== false,
      message: message
    }
  }

  /**
   * 模拟写入RAM
   */
  async writeRAM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    this.log(this.t('messages.ram.writing', { size: data.length }))
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || this.t('messages.progress.writing', { written: Math.floor(data.length * progress / 100), total: data.length })),
      1500
    )
    
    if (DebugConfig.shouldSimulateError()) {
      this.log(`${this.t('messages.ram.writeFailed')}: 模拟错误`)
      return {
        success: false,
        message: this.t('messages.ram.writeFailed')
      }
    }

    // 保存模拟数据
    this.mockRamData = new Uint8Array(data)
    
    this.log(this.t('messages.ram.writeComplete'))
    return {
      success: true,
      message: this.t('messages.ram.writeSuccess')
    }
  }

  /**
   * 模拟读取RAM
   */
  async readRAM(size: number): Promise<CommandResult & { data?: Uint8Array }> {
    this.log(this.t('messages.ram.reading'))
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || this.t('messages.progress.reading', { read: Math.floor(size * progress / 100), total: size })),
      1000
    )
    
    if (DebugConfig.shouldSimulateError()) {
      this.log(`${this.t('messages.ram.readFailed')}: 模拟错误`)
      return {
        success: false,
        message: this.t('messages.ram.readFailed')
      }
    }

    // 返回之前写入的数据或生成随机数据
    const data = this.mockRamData?.slice(0, size) || DebugConfig.generateRandomData(size)
    
    this.log(this.t('messages.ram.readSuccess', { size: data.length }))
    return {
      success: true,
      message: this.t('messages.ram.readSuccess', { size: data.length }),
      data
    }
  }

  /**
   * 模拟校验RAM
   */
  async verifyRAM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    this.log(this.t('messages.ram.verifying'))
    
    // 模拟进度
    await DebugConfig.simulateProgress(
      (progress, detail) => this.updateProgress(progress, detail || this.t('messages.progress.verifying', { verified: Math.floor(data.length * progress / 100), total: data.length })),
      1500
    )
    
    if (DebugConfig.shouldSimulateError()) {
      this.log(`${this.t('messages.ram.verifyFailed')}: 模拟错误`)
      return {
        success: false,
        message: this.t('messages.ram.verifyFailed')
      }
    }

    // 模拟校验结果
    const isMatch = this.mockRamData && this.compareData(data, this.mockRamData)
    const message = isMatch !== false ? this.t('messages.ram.verifySuccess') : this.t('messages.ram.verifyFailed')
    
    this.log(`${this.t('messages.ram.verify')}: ${message}`)
    return {
      success: isMatch !== false,
      message: message
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
