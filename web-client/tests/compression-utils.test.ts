import { describe, expect, it } from 'vitest';

import { GBA_NINTENDO_LOGO } from '@/utils/rom-parser';

import { diff16BitUnFilter, huffUnComp } from '../src/utils/compression-utils';

describe('GBA Logo数据处理校验', () => {
  const head = '24d400000f4000000001818282830f830cc30383018304c3080e02c20dc2070b060a050924ffae51699aa2213d84820a84e409ad11248b98c0817f21a352be199309ce2010464a4af82731ec58c7e83382e3cebf85f4df94ce4b09c194568ac01372a7fc9f844d73a3ca9a615897a327fc039876231dc7610304ae56bf38840040a70efdff52fe036f9530f197fbc08560d68025a963be03014e38e2f9a234ffbb3e0344780090cb88113a9465c07c6387f03cafd625e48b380aac7221d4f807';
  const huff = '82d0000000003c7c408080c00443f0f0000001010f0e3c3c00c4003cc4c300000000efff110000c0c03031d70f380003030c8cb4713c000000001f39e1c600000000defe220100000000030ffdf0c0c000001e3f220003030000c0e03d1c008080000f9c71012130310000d36a1b80ff00000000b7bb030706fafcf7444b000000000000e3d2f0ff00000000c0c00000000000001424100000f0d09fad6c8f10f1ef892ec5fee0ff0000000080c0400000c0407fa9a5fcff0000243b8c7c080000f8685055b4400000c0a4d602f1e2ff00000000';
  const diff = '00003c7c7cfcfcbc0000f0f0f0f0f1f100003c3c3c003c3c000000000000efff000000c0c0f0f1c700000003030f8fc30000000000001f39000000000000defe000000000000030f0000c0c0c0c0deff000003030303c3e30000008080808f1c001e214e524e5221bc3c3c3c3c3c3c3cf3f7f6fefcf8f8f03c3c3c3c3c3c3c3c1f0f0f0f0f0f0f0fcfcfcfcfcfcfcfcfe3f3f3f3f3e3c38370f0ff00f0f0791f3e1e1e1e1e1e1e1e9edededede9e1e1ec7c3c3c3c3c3e7fe737b7b7b7b73e3c33878787878381c0f1e000000';

  function hexStrToUint8Array(str: string) {
    const arr = str.match(/.{2}/g) ?? [];
    return Uint8Array.from(arr.map(byte => parseInt(byte, 16)));
  }

  it('combinedData 校验', () => {
    const logoData = GBA_NINTENDO_LOGO;
    const header = new Uint8Array([
      0x24, 0xd4, 0x00, 0x00, 0x0f, 0x40, 0x00, 0x00, 0x00, 0x01, 0x81, 0x82,
      0x82, 0x83, 0x0f, 0x83, 0x0c, 0xc3, 0x03, 0x83, 0x01, 0x83, 0x04, 0xc3,
      0x08, 0x0e, 0x02, 0xc2, 0x0d, 0xc2, 0x07, 0x0b, 0x06, 0x0a, 0x05, 0x09,
    ]);
    const combinedData = new Uint8Array(header.length + logoData.length);
    combinedData.set(header, 0);
    combinedData.set(logoData, header.length);
    const headBytes = hexStrToUint8Array(head);
    expect(combinedData).toEqual(headBytes);
  });

  it('huffUnComp 校验', () => {
    const headBytes = hexStrToUint8Array(head);
    const huffBytes = hexStrToUint8Array(huff);
    const huffDecompressed = huffUnComp(headBytes);
    expect(huffDecompressed).toEqual(huffBytes);
  });

  it('diff16BitUnFilter 校验', () => {
    const huffBytes = hexStrToUint8Array(huff);
    const diffBytes = hexStrToUint8Array(diff);
    const finalData = diff16BitUnFilter(huffBytes);
    expect(finalData).toEqual(diffBytes);
  });
});
