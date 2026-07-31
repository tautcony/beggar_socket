import { describe, expect, it } from 'vitest';

import { BurnerSession } from '@/features/burner/application/burner-session';
import { formatBurnerLogMessage } from '@/utils/burner-log';

describe('formatBurnerLogMessage', () => {
  it('formats explicit error content when present', () => {
    expect(formatBurnerLogMessage({
      message: 'ROM写入失败',
      error: 'ROM write retries exhausted @ 0x00040000: Read timeout in 3000ms',
    })).toBe('ROM写入失败: ROM write retries exhausted @ 0x00040000: Read timeout in 3000ms');
  });
});

describe('BurnerSession.addLog', () => {
  it('stores string input as-is without implicit normalization', () => {
    const session = new BurnerSession();

    session.addLog(
      '13:10:39',
      'ROM write retry 1/2 @ 0x00000000: Read package timeout in 3000ms '
      + '(read#199, expected=1B, received=0B)',
      'warn',
    );

    expect(session.snapshot.logs).toEqual([
      {
        time: '13:10:39',
        level: 'warn',
        message: 'ROM write retry 1/2 @ 0x00000000: Read package timeout in 3000ms (read#199, expected=1B, received=0B)',
      },
    ]);
  });

  it('preserves explicit structured fields without rewriting them', () => {
    const session = new BurnerSession();

    session.addLog('13:10:39', {
      message: 'ROM write retry 1/2 @ 0x00000000',
      error: 'Read timeout in 3000ms',
      details: 'Read package timeout in 3000ms (read#199, expected=1B, received=0B)',
    }, 'warn');

    expect(session.snapshot.logs).toEqual([
      {
        time: '13:10:39',
        level: 'warn',
        message: 'ROM write retry 1/2 @ 0x00000000',
        error: 'Read timeout in 3000ms',
        details: 'Read package timeout in 3000ms (read#199, expected=1B, received=0B)',
      },
    ]);
  });
});
