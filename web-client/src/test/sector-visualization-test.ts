/**
 * 测试扇区可视化功能
 */

import { SectorInfo } from '@/types/progress-info';

// 模拟创建扇区信息的测试
function testCreateSectorInfo() {
  const startAddress = 0x000000;
  const endAddress = 0x100000;
  const sectorSize = 0x10000;

  const sectors: SectorInfo[] = [];
  const sectorMask = sectorSize - 1;
  const alignedEndAddress = endAddress & ~sectorMask;

  // 从高地址向低地址创建扇区信息（与擦除顺序一致）
  for (let address = alignedEndAddress; address >= startAddress; address -= sectorSize) {
    sectors.push({
      address,
      size: sectorSize,
      state: 'pending',
    });
  }

  console.log('创建了扇区信息:', sectors);
  console.log('扇区总数:', sectors.length);

  return sectors;
}

// 模拟更新扇区状态的测试
function testUpdateSectorProgress(sectors: SectorInfo[], currentAddress: number, state: SectorInfo['state']): SectorInfo[] {
  return sectors.map(sector => {
    if (sector.address === currentAddress) {
      return { ...sector, state };
    }
    return sector;
  });
}

// 运行测试
export function runSectorVisualizationTest() {
  console.log('开始扇区可视化测试...');

  // 测试创建扇区信息
  let sectors = testCreateSectorInfo();

  // 测试更新扇区状态
  const testAddress = 0x0F0000;
  console.log(`更新地址 ${testAddress.toString(16)} 的扇区状态为 'erasing'`);
  sectors = testUpdateSectorProgress(sectors, testAddress, 'erasing');

  console.log('更新后的扇区:', sectors.find(s => s.address === testAddress));

  // 测试完成状态
  console.log(`更新地址 ${testAddress.toString(16)} 的扇区状态为 'completed'`);
  sectors = testUpdateSectorProgress(sectors, testAddress, 'completed');

  console.log('最终扇区状态:', sectors.find(s => s.address === testAddress));

  console.log('扇区可视化测试完成！');
}
