import type { SerialPortInfo } from '@/services/serial-service';

/**
 * 当需要用户选择串口时抛出的错误
 */
export class PortSelectionRequiredError extends Error {
  public readonly availablePorts: SerialPortInfo[];

  constructor(availablePorts: SerialPortInfo[]) {
    super('Port selection required');
    this.name = 'PortSelectionRequiredError';
    this.availablePorts = availablePorts;
  }
}
