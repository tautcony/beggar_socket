import { timeout } from '@/utils/async-utils';

import type { Transport } from './types';

/**
 * Initialize device by toggling DTR/RTS signals: low → high → low with timing delays.
 */
export async function initDeviceSignals(transport: Transport): Promise<void> {
  await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
  await timeout(10);
  await transport.setSignals({ dataTerminalReady: true, requestToSend: true });
  await timeout(10);
  await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
  await timeout(200);
}
