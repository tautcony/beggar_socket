/**
 * Session contracts: probe facts, driver lifecycle and the resolved session snapshot.
 *
 * The public `SessionProfile` never exposes raw protocol facts; only normalized
 * capabilities, versions, display model and diagnostics.
 */
import type { HostPacketLimits, HostPlatform } from '@/types/host-platform';
import type { SerialPortInfo } from '@/types/serial';

import type { CapabilitySet, RuntimeFeatures } from './capabilities';
import type { DeviceDisplayModel, DisplayText } from './display';
import type { OperationSettingsSnapshot, ParameterValue } from './parameters';
import type {
  DeviceDefinition,
  DeviceFirmwareBinding,
  FirmwareDefinition,
  FirmwareId,
  ResolvedVariantSelection,
  TransportBackend,
  UsbIdentityMatcher,
  VariantId,
  VerificationStatus,
} from './types';
import type { PortIdentityAssessment } from './usb-identity';

/**
 * Structural view of the platform `Transport`. Declared here so the pure definition
 * layer never imports `platform/serial`; the real `Transport` is assignable to it.
 */
export interface SessionTransport {
  readonly send: (payload: Uint8Array, timeoutMs?: number) => Promise<boolean>;
  readonly read: (length: number, timeoutMs?: number) => Promise<{ data: Uint8Array }>;
  readonly sendAndReceive: (
    payload: Uint8Array,
    readLength: number,
    sendTimeoutMs?: number,
    readTimeoutMs?: number,
  ) => Promise<{ data: Uint8Array }>;
  readonly close?: () => Promise<void>;
}

export interface TransportFacts {
  readonly backend: TransportBackend;
  readonly usb?: {
    readonly vendorId?: string;
    readonly productId?: string;
  };
}

export interface ProbeResult<TFacts> {
  readonly firmwareId: FirmwareId;
  readonly verification: VerificationStatus;
  readonly firmwareVersion?: string;
  /**
   * Non-fatal issues the driver observed while probing (e.g. an ignored handshake
   * mismatch). The resolver appends them to `SessionProfile.diagnostics`; they are
   * not capability hints.
   */
  readonly diagnostics?: readonly DeviceDiagnostic[];
  /** Only visible to drivers, the resolver and the display contributor. */
  readonly facts: TFacts;
}

export interface PendingSession {
  readonly transport: SessionTransport;
  readonly selection: ResolvedVariantSelection;
  readonly portInfo?: SerialPortInfo;
  readonly transportFacts: TransportFacts;
}

export interface ActiveSession {
  readonly profile: SessionProfile;
  readonly transport: SessionTransport;
  readonly connectionId: string;
}

/**
 * Everything that decides how one connection attempt is opened and how its session
 * resolves, captured once *before* the port opens.
 *
 * Opening a port is asynchronous, so re-reading the saved selection or the operation
 * parameters afterwards could observe a settings edit that happened in between. That
 * would let one attempt open the port with one baud rate and publish a profile with
 * another. The plan is therefore the only source for those values inside the attempt:
 * the port opener, the resolver and the committed `SessionProfile` all read it.
 */
export interface ConnectionPlan {
  readonly variantId: VariantId;
  /** Operation parameters of the variant namespace when the attempt started. */
  readonly parameters: Readonly<Record<string, ParameterValue>>;
  /** Baud rate the port must be opened with; absent when the binding declares none. */
  readonly baudRate?: number;
  /**
   * Identity matchers of the selected binding, copied into the snapshot.
   *
   * An attempt that fails before the first protocol byte (busy port, unplugged cable,
   * denied permission) has no session to read the match result from, so the plan keeps the
   * criteria the port was supposed to meet.
   */
  readonly identityMatchers?: readonly UsbIdentityMatcher[];
}

export interface PendingSessionContext {
  readonly pending: PendingSession;
}

/** Probe / initialize / teardown lifecycle, replacing inline `isFlashgbx` branches. */
export interface ProtocolDriver<TFacts> {
  probe(context: PendingSessionContext): Promise<ProbeResult<TFacts>>;
  initialize?(session: PendingSession): Promise<void>;
  teardown(session: ActiveSession): Promise<void>;
  cleanupPending(pending: PendingSession, stage: 'probe' | 'resolve' | 'initialize'): Promise<void>;
}

export interface DeviceDiagnostic {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: DisplayText;
  readonly stage?: 'selection' | 'transport' | 'probe' | 'resolve' | 'initialize' | 'disconnect';
}

/**
 * Structured discovery of one connection attempt.
 *
 * Produced before the first protocol byte, so both the committed profile and a failed
 * attempt can report the same variant / port / match result instead of forcing the UI to
 * infer it from log text.
 */
export interface ConnectionAttemptContext {
  readonly variantId?: string;
  readonly port?: {
    readonly path?: string;
    readonly vendorId?: string;
    readonly productId?: string;
  };
  readonly portIdentity?: PortIdentityAssessment;
}

export interface ResolvedTransportProfile {
  readonly backend: TransportBackend;
  /** Host used to expand `packetLimits`. */
  readonly platform: HostPlatform;
  readonly baudRate?: number;
  readonly packetLimits: HostPacketLimits;
  /** Firmware-side read ceiling of the resolved binding. */
  readonly maxReadChunk: number;
}

/** Immutable session snapshot produced by the resolver. */
export interface SessionProfile {
  readonly variantId: VariantId;
  readonly device: DeviceDefinition;
  readonly firmware: FirmwareDefinition;
  readonly firmwareVersion?: string;
  /** Parameter namespace of the binding; operation settings are read from it. */
  readonly parameterNamespace: string;
  readonly capabilities: CapabilitySet;
  readonly runtimeFeatures: RuntimeFeatures;
  readonly transport: ResolvedTransportProfile;
  readonly verification: VerificationStatus;
  /**
   * Connection-period parameters only (descriptors with `requiresReconnect` or
   * `group: 'connection'`). Operation settings are read from the store per operation, so
   * they are deliberately not frozen into the session.
   */
  readonly connectionParameters: Readonly<Record<string, ParameterValue>>;
  /**
   * Structured port discovery of this attempt, present whenever the host could report
   * port metadata. Callers never re-derive it from the diagnostic text.
   */
  readonly portIdentity?: PortIdentityAssessment;
  readonly display: DeviceDisplayModel;
  readonly diagnostics: readonly DeviceDiagnostic[];
}

/** Exists only during resolution; carries typed probe facts to contributors. */
export interface InternalResolveContext<TFacts> {
  readonly device: DeviceDefinition;
  readonly firmware: FirmwareDefinition;
  readonly binding: DeviceFirmwareBinding;
  readonly probe: ProbeResult<TFacts>;
  readonly capabilities: CapabilitySet;
  readonly transport: ResolvedTransportProfile;
  readonly runtimeFeatures: RuntimeFeatures;
}

/**
 * Builds the normalized display model for a binding. The facts type parameter lives on
 * the interface, not on `build`, so a FlashGBX contributor cannot receive Beggar facts.
 */
export interface DisplayContributor<TFacts> {
  build(context: InternalResolveContext<TFacts>): DeviceDisplayModel;
}

export interface OperationContext {
  readonly sessionProfile: SessionProfile;
  readonly settings: OperationSettingsSnapshot;
}
