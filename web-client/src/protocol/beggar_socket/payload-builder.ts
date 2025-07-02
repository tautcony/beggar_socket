import { modbusCRC16_lut } from '@/utils/crc-utils';

/**
 * 高效的 Payload 构建器类，减少数据复制操作
 * 预留包装格式：[size:2bytes] + payload + [crc:2bytes]
 */
export class PayloadBuilder {
  private buffer: Uint8Array;
  private offset = 2; // 从第2个字节开始写入payload，预留size字段
  private capacity: number;

  constructor(initialCapacity = 256) {
    // 确保至少有4字节的空间用于size和crc
    this.capacity = Math.max(initialCapacity, 4);
    this.buffer = new Uint8Array(this.capacity);
  }

  /**
   * 确保缓冲区有足够的容量
   */
  private ensureCapacity(additionalBytes: number): void {
    const required = this.offset + additionalBytes + 2; // 额外预留2字节给CRC
    if (required > this.capacity) {
      // 扩容策略：至少翻倍，或者满足需求
      const newCapacity = Math.max(this.capacity * 2, required);
      const newBuffer = new Uint8Array(newCapacity);
      newBuffer.set(this.buffer.subarray(0, this.offset));
      this.buffer = newBuffer;
      this.capacity = newCapacity;
    }
  }

  /**
   * 添加单个字节
   * @param value - 字节值
   */
  addByte(value: number): this {
    this.ensureCapacity(1);
    this.buffer[this.offset] = value & 0xFF;
    this.offset += 1;
    return this;
  }

  /**
   * 添加小端序整数 - 直接写入缓冲区，避免创建临时数组
   * @param value - 整数值
   * @param byteLength - 字节长度
   */
  addLittleEndian(value: number, byteLength: number): this {
    this.ensureCapacity(byteLength);

    // 直接写入缓冲区，避免调用 toLittleEndian 创建临时数组
    for (let i = 0; i < byteLength; i++) {
      this.buffer[this.offset + i] = (value >> (i * 8)) & 0xFF;
    }
    this.offset += byteLength;
    return this;
  }

  /**
   * 添加字节数组
   * @param data - 字节数组
   */
  addBytes(data: Uint8Array): this {
    this.ensureCapacity(data.length);
    this.buffer.set(data, this.offset);
    this.offset += data.length;
    return this;
  }

  /**
   * 构建最终的数据包
   * 包装格式：[size:2bytes] + payload + [crc:2bytes]
   * @param withCrc - 是否添加 CRC16 校验
   * @returns 完整的数据包
   */
  build(withCrc = true): Uint8Array {
    const payloadSize = this.offset - 2; // 实际payload大小（不包含预留的size字段）
    const totalSize = withCrc ? payloadSize + 4 : payloadSize + 2; // 包括size(2字节)和可选的crc(2字节)

    // 写入包大小字段（小端序）到预留的前2字节 - 包大小包括整个包
    this.buffer[0] = totalSize & 0xFF;
    this.buffer[1] = (totalSize >> 8) & 0xFF;

    // 如果需要CRC，计算并写入
    if (withCrc) {
      // 计算CRC时不包括size字段，只计算payload部分
      const crc = modbusCRC16_lut(this.buffer.subarray(2, this.offset));
      this.buffer[this.offset] = crc & 0xFF;
      this.buffer[this.offset + 1] = (crc >> 8) & 0xFF;
      return this.buffer.subarray(0, this.offset + 2);
    }

    return this.buffer.subarray(0, this.offset);
  }

  /**
   * 重置构建器
   */
  reset(): this {
    this.offset = 2; // 重置到预留位置
    return this;
  }

  /**
   * 添加地址字段（4字节小端序）
   * @param address - 地址值
   */
  addAddress(address: number): this {
    return this.addLittleEndian(address, 4);
  }

  /**
   * 添加长度字段（2字节小端序）
   * @param length - 长度值
   */
  addLength(length: number): this {
    return this.addLittleEndian(length, 2);
  }

  /**
   * 添加命令字节
   * @param command - 命令值
   */
  addCommand(command: number): this {
    return this.addByte(command);
  }

  /**
   * 获取当前payload大小（不包括预留的size字段）
   */
  get size(): number {
    return this.offset - 2;
  }

  /**
   * 获取当前容量
   */
  get bufferCapacity(): number {
    return this.capacity;
  }
}

/**
 * 创建新的 PayloadBuilder 实例
 * @param initialCapacity - 初始容量，默认256字节
 */
export function createPayload(initialCapacity?: number): PayloadBuilder {
  return new PayloadBuilder(initialCapacity);
}

export function createCommandPayload(command: number, initialCapacity?: number): PayloadBuilder {
  const builder = new PayloadBuilder(initialCapacity);
  return builder.addCommand(command);
}
