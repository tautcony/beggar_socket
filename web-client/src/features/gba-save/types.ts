export interface GbaPreviewLaunch {
  sessionId: string;
  romData: Uint8Array;
  romName: string;
  romRevision: number;
  ramRevision: number;
  saveData?: Uint8Array;
  saveName?: string;
  usesSelectedSave: boolean;
  ramWasEmptyAtLaunch: boolean;
}

export interface GbaPreviewSavePayload {
  launch: Pick<GbaPreviewLaunch, 'sessionId' | 'romName' | 'romRevision' | 'ramRevision' | 'saveName' | 'usesSelectedSave' | 'ramWasEmptyAtLaunch'>;
  data: Uint8Array;
  capacity: number;
  changed: boolean;
  reason?: string;
}
