
const GBA_ROM_BASE_ADDRESS = Array<number>();
const GBA_RAM_BASE_ADDRESS = Array<number>();
const MBC5_ROM_BASE_ADDRESS = Array<number>();
const MBC5_RAM_BASE_ADDRESS = Array<number>();

for (let i = 0; i < 32; ++i) {
  GBA_ROM_BASE_ADDRESS.push(0x400000 * i); // BANK${i} 4MB
}

MBC5_ROM_BASE_ADDRESS.push(0x100000); // GAME1 1MB
for (let i = 1; i < 16; ++i) {
  MBC5_ROM_BASE_ADDRESS.push(0x200000 * i); // GAME${i} 2MB
}
for (let i = 0; i < 16; ++i) {
  MBC5_RAM_BASE_ADDRESS.push(0x8000 * i); // SAV${i} 32KB
}

export { GBA_ROM_BASE_ADDRESS, MBC5_RAM_BASE_ADDRESS, MBC5_ROM_BASE_ADDRESS };
