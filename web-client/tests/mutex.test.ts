import { describe, expect, it } from 'vitest';

import { Mutex } from '@/platform/serial/mutex';

describe('Mutex', () => {
  it('should start unlocked', () => {
    const mutex = new Mutex();
    expect(mutex.locked).toBe(false);
  });

  it('should lock on acquire and unlock on release', async () => {
    const mutex = new Mutex();
    const release = await mutex.acquire();
    expect(mutex.locked).toBe(true);
    release();
    expect(mutex.locked).toBe(false);
  });

  it('should serialise concurrent acquires', async () => {
    const mutex = new Mutex();
    const order: number[] = [];

    const task = async (id: number) => {
      const release = await mutex.acquire();
      order.push(id);
      // simulate async work
      await new Promise((r) => setTimeout(r, 10));
      release();
    };

    await Promise.all([task(1), task(2), task(3)]);

    // All three should have executed in sequence
    expect(order).toEqual([1, 2, 3]);
  });

  it('should allow re-acquire after release', async () => {
    const mutex = new Mutex();
    const release1 = await mutex.acquire();
    release1();

    const release2 = await mutex.acquire();
    expect(mutex.locked).toBe(true);
    release2();
    expect(mutex.locked).toBe(false);
  });

  it('should ensure mutual exclusion for send-receive pattern', async () => {
    const mutex = new Mutex();
    const log: string[] = [];

    const sendAndReceive = async (id: string) => {
      const release = await mutex.acquire();
      try {
        log.push(`${id}:send`);
        await new Promise((r) => setTimeout(r, 5));
        log.push(`${id}:recv`);
      } finally {
        release();
      }
    };

    await Promise.all([sendAndReceive('A'), sendAndReceive('B')]);

    // A's send+recv should complete before B's send+recv (or vice-versa)
    // but never interleaved like A:send, B:send, A:recv, B:recv
    const aStart = log.indexOf('A:send');
    const aEnd = log.indexOf('A:recv');
    const bStart = log.indexOf('B:send');
    const bEnd = log.indexOf('B:recv');

    const aBeforeB = aEnd < bStart;
    const bBeforeA = bEnd < aStart;
    expect(aBeforeB || bBeforeA).toBe(true);
  });
});
