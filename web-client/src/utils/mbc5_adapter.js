import { 
  gbc_direct_write, 
  gbc_read, 
  gbc_rom_program 
} from './protocol.js'

/**
 * MBC5 Adapter - 封装MBC5卡带的协议操作
 * 参考 mission_mbc5.cs 实现
 */
export class MBC5Adapter {
  constructor(device, i18n) {
    this.device = device
    this.i18n = i18n
    this.progressCallback = null
    this.messageCallback = null
  }

  setProgressCallback(callback) {
    this.progressCallback = callback
  }

  setMessageCallback(callback) {
    this.messageCallback = callback
  }

  log(message) {
    if (this.messageCallback) {
      this.messageCallback(message)
    }
  }

  // ROM Bank 切换
  async switchROMBank(bank) {
    if (bank < 0) return

    const b0 = bank & 0xff
    const b1 = (bank >> 8) & 0xff

    // ROM addr [21:14]
    await gbc_direct_write(this.device, new Uint8Array([b0]), 0x2000)
    // ROM addr [22]
    await gbc_direct_write(this.device, new Uint8Array([b1]), 0x3000)
  }

  // RAM Bank 切换
  async switchRAMBank(bank) {
    if (bank < 0) return

    const b = bank & 0xff
    // RAM addr [16:13]
    await gbc_direct_write(this.device, new Uint8Array([b]), 0x4000)
  }

  // 获取ROM ID
  async readID() {
    this.log(this.i18n.t('mbc5.reading_id'))

    try {
      // Enter autoselect mode
      await gbc_direct_write(this.device, new Uint8Array([0xaa]), 0xaaa)
      await gbc_direct_write(this.device, new Uint8Array([0x55]), 0x555)
      await gbc_direct_write(this.device, new Uint8Array([0x90]), 0xaaa)

      // Read ID (4 bytes)
      const id = await gbc_read(this.device, 4, 0)

      // Reset
      await gbc_direct_write(this.device, new Uint8Array([0xf0]), 0x00)

      this.log(this.i18n.t('mbc5.id_read_success'))
      return Array.from(id)
    } catch (error) {
      this.log(this.i18n.t('mbc5.id_read_failed'))
      throw error
    }
  }

  // 获取ROM容量信息 - 通过CFI查询
  async getROMSize() {
    try {
      // CFI Query
      await gbc_direct_write(this.device, new Uint8Array([0x98]), 0xaa)

      // 读取设备大小 (0x4e地址)
      const deviceSizeData = await gbc_read(this.device, 1, 0x4e)
      const deviceSize = Math.pow(2, deviceSizeData[0])

      // 读取buffer写入大小 (0x56和0x54地址)
      const buffSizeHigh = await gbc_read(this.device, 1, 0x56)
      const buffSizeLow = await gbc_read(this.device, 1, 0x54)
      let bufferWriteBytes = (buffSizeHigh[0] << 8) | buffSizeLow[0]
      if (bufferWriteBytes === 0) {
        bufferWriteBytes = 0
      } else {
        bufferWriteBytes = Math.pow(2, buffSizeLow[0])
      }

      // 读取扇区信息
      const sectorCountHigh = await gbc_read(this.device, 1, 0x5c)
      const sectorCountLow = await gbc_read(this.device, 1, 0x5a)
      const sectorCount = ((sectorCountHigh[0] << 8) | sectorCountLow[0]) + 1

      const sectorSizeHigh = await gbc_read(this.device, 1, 0x60)
      const sectorSizeLow = await gbc_read(this.device, 1, 0x5e)
      const sectorSize = ((sectorSizeHigh[0] << 8) | sectorSizeLow[0]) * 256

      // Reset
      await gbc_direct_write(this.device, new Uint8Array([0xf0]), 0x00)

      return {
        deviceSize,
        sectorCount,
        sectorSize,
        bufferWriteBytes
      }
    } catch (error) {
      this.log(this.i18n.t('mbc5.rom_size_query_failed'))
      throw error
    }
  }

  // 全片擦除
  async eraseChip() {
    this.log(this.i18n.t('mbc5.erasing_chip'))

    try {
      // Chip Erase sequence
      await gbc_direct_write(this.device, new Uint8Array([0xaa]), 0xaaa)
      await gbc_direct_write(this.device, new Uint8Array([0x55]), 0x555)
      await gbc_direct_write(this.device, new Uint8Array([0x80]), 0xaaa)
      await gbc_direct_write(this.device, new Uint8Array([0xaa]), 0xaaa)
      await gbc_direct_write(this.device, new Uint8Array([0x55]), 0x555)
      await gbc_direct_write(this.device, new Uint8Array([0x10]), 0xaaa) // Chip Erase

      // Wait for completion (poll for 0xff)
      let temp
      do {
        await new Promise(resolve => setTimeout(resolve, 1000))
        temp = await gbc_read(this.device, 1, 0)
        this.log(`...... ${temp[0].toString(16).padStart(2, '0').toUpperCase()}`)
      } while (temp[0] !== 0xff)

      this.log(this.i18n.t('mbc5.chip_erase_complete'))
    } catch (error) {
      this.log(this.i18n.t('mbc5.chip_erase_failed'))
      throw error
    }
  }

  // 扇区擦除
  async eraseSectors(addrFrom, addrTo, sectorSize) {
    const sectorMask = sectorSize - 1
    addrTo &= ~sectorMask

    this.log(this.i18n.t('mbc5.erasing_sectors', { 
      from: addrFrom.toString(16).toUpperCase().padStart(8, '0'), 
      to: addrTo.toString(16).toUpperCase().padStart(8, '0') 
    }))

    const totalSectors = Math.floor((addrTo - addrFrom) / sectorSize) + 1
    let erasedSectors = 0

    for (let sa = addrTo; sa >= addrFrom; sa -= sectorSize) {
      this.log(`    0x${sa.toString(16).toUpperCase().padStart(8, '0')}`)

      const bank = sa >> 14
      await this.switchROMBank(bank)

      let sectorAddr
      if (bank === 0) {
        sectorAddr = 0x0000 + (sa & 0x3fff)
      } else {
        sectorAddr = 0x4000 + (sa & 0x3fff)
      }

      // Sector Erase sequence
      await gbc_direct_write(this.device, new Uint8Array([0xaa]), 0xaaa)
      await gbc_direct_write(this.device, new Uint8Array([0x55]), 0x555)
      await gbc_direct_write(this.device, new Uint8Array([0x80]), 0xaaa)
      await gbc_direct_write(this.device, new Uint8Array([0xaa]), 0xaaa)
      await gbc_direct_write(this.device, new Uint8Array([0x55]), 0x555)
      await gbc_direct_write(this.device, new Uint8Array([0x30]), sectorAddr) // Sector Erase

      if (this.progressCallback) {
        this.progressCallback((erasedSectors + 1) / totalSectors * 100)
      }

      // Wait for completion
      let temp
      do {
        await new Promise(resolve => setTimeout(resolve, 20))
        temp = await gbc_read(this.device, 1, sectorAddr)
      } while (temp[0] !== 0xff)

      erasedSectors++
    }
  }

  // 写入ROM
  async writeROM(fileData, baseAddress = 0, romSize = null) {
    const { sectorSize, bufferWriteBytes } = await this.getROMSize()
    
    this.log(this.i18n.t('mbc5.writing_rom'))

    const startTime = Date.now()
    let currentBank = -123
    let writtenCount = 0

    while (writtenCount < fileData.length) {
      // 分包处理
      let chunkSize = fileData.length - writtenCount
      chunkSize = Math.min(chunkSize, 4096)

      const chunk = fileData.slice(writtenCount, writtenCount + chunkSize)
      const romAddress = baseAddress + writtenCount

      // 计算bank和地址
      const bank = romAddress >> 14
      if (bank !== currentBank) {
        currentBank = bank
        await this.switchROMBank(bank)
      }

      const cartAddress = bank === 0 ? 
        0x0000 + (romAddress & 0x3fff) : 
        0x4000 + (romAddress & 0x3fff)

      // 写入数据
      await gbc_rom_program(this.device, chunk, cartAddress)

      writtenCount += chunkSize
      if (this.progressCallback) {
        this.progressCallback(writtenCount / fileData.length * 100)
      }
    }

    const elapsedTime = (Date.now() - startTime) / 1000
    this.log(this.i18n.t('mbc5.rom_write_complete', { time: elapsedTime.toFixed(3) }))
  }

  // 读取ROM
  async readROM(size, baseAddress = 0) {
    this.log(this.i18n.t('mbc5.reading_rom'))

    const result = new Uint8Array(size)
    const startTime = Date.now()
    let currentBank = -123
    let readCount = 0

    while (readCount < size) {
      // 分包处理
      let chunkSize = size - readCount
      chunkSize = Math.min(chunkSize, 4096)

      const romAddress = baseAddress + readCount

      // 计算bank和地址
      const bank = romAddress >> 14
      if (bank !== currentBank) {
        currentBank = bank
        await this.switchROMBank(bank)
      }

      const cartAddress = bank === 0 ? 
        0x0000 + (romAddress & 0x3fff) : 
        0x4000 + (romAddress & 0x3fff)

      // 读取数据
      const chunk = await gbc_read(this.device, chunkSize, cartAddress)
      result.set(chunk, readCount)

      readCount += chunkSize
      if (this.progressCallback) {
        this.progressCallback(readCount / size * 100)
      }
    }

    const elapsedTime = (Date.now() - startTime) / 1000
    this.log(this.i18n.t('mbc5.rom_read_complete', { time: elapsedTime.toFixed(3) }))

    return result
  }

  // 校验ROM
  async verifyROM(fileData, baseAddress = 0) {
    this.log(this.i18n.t('mbc5.verifying_rom'))

    const startTime = Date.now()
    let currentBank = -123
    let readCount = 0

    while (readCount < fileData.length) {
      // 分包处理
      let chunkSize = fileData.length - readCount
      chunkSize = Math.min(chunkSize, 4096)

      const romAddress = baseAddress + readCount

      // 计算bank和地址
      const bank = romAddress >> 14
      if (bank !== currentBank) {
        currentBank = bank
        await this.switchROMBank(bank)
      }

      const cartAddress = bank === 0 ? 
        0x0000 + (romAddress & 0x3fff) : 
        0x4000 + (romAddress & 0x3fff)

      // 读取并对比
      const chunk = await gbc_read(this.device, chunkSize, cartAddress)
      for (let i = 0; i < chunkSize; i++) {
        if (fileData[readCount + i] !== chunk[i]) {
          const errorAddr = romAddress + i
          this.log(this.i18n.t('mbc5.rom_verify_failed', {
            address: errorAddr.toString(16).toUpperCase().padStart(8, '0'),
            expected: fileData[readCount + i].toString(16).toUpperCase().padStart(2, '0'),
            actual: chunk[i].toString(16).toUpperCase().padStart(2, '0')
          }))
          return false
        }
      }

      readCount += chunkSize
      if (this.progressCallback) {
        this.progressCallback(readCount / fileData.length * 100)
      }
    }

    const elapsedTime = (Date.now() - startTime) / 1000
    this.log(this.i18n.t('mbc5.rom_verify_complete', { time: elapsedTime.toFixed(3) }))
    return true
  }

  // 写入RAM
  async writeRAM(fileData, baseAddress = 0) {
    this.log(this.i18n.t('mbc5.writing_ram'))

    // 开启RAM访问权限
    await gbc_direct_write(this.device, new Uint8Array([0x0a]), 0x0000)

    const startTime = Date.now()
    let currentBank = -123
    let writtenCount = 0

    while (writtenCount < fileData.length) {
      // 分包处理
      let chunkSize = fileData.length - writtenCount
      chunkSize = Math.min(chunkSize, 4096)

      const chunk = fileData.slice(writtenCount, writtenCount + chunkSize)
      const ramAddress = baseAddress + writtenCount

      // 计算bank和地址
      const bank = ramAddress >> 13
      const b = bank < 0 ? 0 : bank
      if (b !== currentBank) {
        currentBank = b
        await this.switchRAMBank(b)
      }

      const cartAddress = 0xa000 + (ramAddress & 0x1fff)

      // 写入数据
      await gbc_direct_write(this.device, chunk, cartAddress)

      writtenCount += chunkSize
      if (this.progressCallback) {
        this.progressCallback(writtenCount / fileData.length * 100)
      }
    }

    const elapsedTime = (Date.now() - startTime) / 1000
    this.log(this.i18n.t('mbc5.ram_write_complete', { time: elapsedTime.toFixed(3) }))
  }

  // 读取RAM
  async readRAM(size, baseAddress = 0) {
    this.log(this.i18n.t('mbc5.reading_ram'))

    // 开启RAM访问权限
    await gbc_direct_write(this.device, new Uint8Array([0x0a]), 0x0000)

    const result = new Uint8Array(size)
    const startTime = Date.now()
    let currentBank = -123
    let readCount = 0

    while (readCount < size) {
      // 分包处理
      let chunkSize = size - readCount
      chunkSize = Math.min(chunkSize, 4096)

      const ramAddress = baseAddress + readCount

      // 计算bank和地址
      const bank = ramAddress >> 13
      const b = bank < 0 ? 0 : bank
      if (b !== currentBank) {
        currentBank = b
        await this.switchRAMBank(b)
      }

      const cartAddress = 0xa000 + (ramAddress & 0x1fff)

      // 读取数据
      const chunk = await gbc_read(this.device, chunkSize, cartAddress)
      result.set(chunk, readCount)

      readCount += chunkSize
      if (this.progressCallback) {
        this.progressCallback(readCount / size * 100)
      }
    }

    const elapsedTime = (Date.now() - startTime) / 1000
    this.log(this.i18n.t('mbc5.ram_read_complete', { time: elapsedTime.toFixed(3) }))

    return result
  }

  // 校验RAM
  async verifyRAM(fileData, baseAddress = 0) {
    this.log(this.i18n.t('mbc5.verifying_ram'))

    // 开启RAM访问权限
    await gbc_direct_write(this.device, new Uint8Array([0x0a]), 0x0000)

    const startTime = Date.now()
    let currentBank = -123
    let readCount = 0

    while (readCount < fileData.length) {
      // 分包处理
      let chunkSize = fileData.length - readCount
      chunkSize = Math.min(chunkSize, 4096)

      const ramAddress = baseAddress + readCount

      // 计算bank和地址
      const bank = ramAddress >> 13
      const b = bank < 0 ? 0 : bank
      if (b !== currentBank) {
        currentBank = b
        await this.switchRAMBank(b)
      }

      const cartAddress = 0xa000 + (ramAddress & 0x1fff)

      // 读取并对比
      const chunk = await gbc_read(this.device, chunkSize, cartAddress)
      for (let i = 0; i < chunkSize; i++) {
        if (fileData[readCount + i] !== chunk[i]) {
          const errorAddr = ramAddress + i
          this.log(this.i18n.t('mbc5.ram_verify_failed', {
            address: errorAddr.toString(16).toUpperCase().padStart(8, '0'),
            expected: fileData[readCount + i].toString(16).toUpperCase().padStart(2, '0'),
            actual: chunk[i].toString(16).toUpperCase().padStart(2, '0')
          }))
          return false
        }
      }

      readCount += chunkSize
      if (this.progressCallback) {
        this.progressCallback(readCount / fileData.length * 100)
      }
    }

    const elapsedTime = (Date.now() - startTime) / 1000
    this.log(this.i18n.t('mbc5.ram_verify_complete', { time: elapsedTime.toFixed(3) }))
    return true
  }

  // 检查区域是否为空
  async isBlank(address, size = 512) {
    const bank = address >> 14
    await this.switchROMBank(bank)

    const cartAddress = bank === 0 ? 
      0x0000 + (address & 0x3fff) : 
      0x4000 + (address & 0x3fff)

    const data = await gbc_read(this.device, size, cartAddress)
    return data.every(byte => byte === 0xff)
  }
}
