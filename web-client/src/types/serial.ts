export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
}

export interface SerialConnection {
  id: string;
  isOpen: boolean;
  write: (data: Uint8Array | number[]) => Promise<void>;
  close: () => Promise<void>;
  setSignals: (signals: { dataTerminalReady?: boolean; requestToSend?: boolean }) => Promise<void>;
  onData: (callback: (data: Uint8Array) => void) => void;
  onError: (callback: (error: string) => void) => void;
  onClose: (callback: () => void) => void;
  removeDataListener: (callback: (data: Uint8Array) => void) => void;
  removeErrorListener: (callback: (error: string) => void) => void;
  removeCloseListener: (callback: () => void) => void;
}
