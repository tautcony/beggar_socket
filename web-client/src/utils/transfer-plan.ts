/**
 * 传输分块规划与 ROM 镜像准备工具
 */

export interface NextChunkParams {
  /** 当前全局字节地址 */
  address: number;
  /** 剩余待传输字节数 */
  remaining: number;
  /** 规范化后的页大小（2 的幂） */
  pageSize: number;
  /** 当前 bank 窗口大小（如 GBA 32 MiB、MBC 16 KiB） */
  bankSize?: number;
  /** 当前扇区终点（exclusive），写入时用于不跨扇区边界 */
  sectorEnd?: number;
  /** 写入缓冲页大小；当 address 未按 bufferSize 对齐时先对齐到下一个写缓冲页边界 */
  bufferSize?: number;
}

/**
 * 向下取不超过 value 的最大 2 的幂（最小钳制到 min）
 */
export function floorPowerOfTwo(value: number, min = 1): number {
  const safeMin = Math.max(1, Math.floor(min));
  if (!Number.isFinite(value) || value <= safeMin) {
    return safeMin;
  }
  const intVal = Math.floor(value);
  return 1 << (31 - Math.clz32(intVal));
}

function nextBoundary(address: number, align: number): number {
  return Math.floor(address / align) * align + align;
}

/**
 * 计算当前地址下一次安全传输的块长度：
 * - 终点对齐页边界（若起点未按 bufferSize 对齐，则先对齐到写缓冲页边界）
 * - 不超过 remaining
 * - 不跨越 bankSize 窗口边界
 * - 不跨越 sectorEnd 边界
 */
export function nextChunkSize(params: NextChunkParams): number {
  const { address, remaining, pageSize, bankSize, sectorEnd, bufferSize } = params;
  if (remaining <= 0 || pageSize <= 0) {
    return 0;
  }

  const needsBufferAlign = bufferSize !== undefined && bufferSize > 1 && address % bufferSize !== 0;
  const align = needsBufferAlign ? Math.min(pageSize, bufferSize) : pageSize;

  let end = Math.min(nextBoundary(address, align), address + remaining);

  if (bankSize !== undefined && bankSize > 0) {
    end = Math.min(end, nextBoundary(address, bankSize));
  }

  if (sectorEnd !== undefined) {
    end = Math.min(end, sectorEnd);
  }

  return Math.max(0, end - address);
}

/**
 * 若输入镜像短于 size，则复制并在尾部填充 0xFF 至 size；否则直接返回原视图
 */
export function prepareRomImage(data: Uint8Array, size: number): Uint8Array {
  if (size <= 0) {
    return new Uint8Array(0);
  }
  if (data.byteLength >= size) {
    return data;
  }
  const padded = new Uint8Array(size);
  padded.set(data, 0);
  padded.fill(0xff, data.byteLength);
  return padded;
}

/**
 * 检查数据块是否全部为擦除态字节（0xFF）
 */
export function isAllErasedBytes(chunk: Uint8Array): boolean {
  for (const byte of chunk) {
    if (byte !== 0xff) {
      return false;
    }
  }
  return true;
}
