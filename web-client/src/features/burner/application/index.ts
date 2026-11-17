export { BurnerSession } from './burner-session';
export {
  type BurnerUseCase,
  BurnerUseCaseImpl,
  type GameDetectionResult,
} from './burner-use-case';
export {
  ConnectionOperationCoordinator,
  type ConnectionOperationFailureReason,
  type ConnectionOperationResult,
  type ConnectionOperationToken,
  type RunConnectionOperationOptions,
} from './connection-operation-coordinator';
export { ConnectionOrchestrationUseCase } from './connection-use-case';
export type {
  ConnectionCommandResult,
  ConnectionContext,
  ConnectionFailure,
  ConnectionFailureCode,
  ConnectionFailureStage,
  ConnectionSnapshot,
  ConnectionState,
  ConnectionUseCaseResult,
} from './domain/connection';
export type {
  BurnerConnectionHandle,
  BurnerConnectionPort,
  BurnerConnectionSelection,
  BurnerProtocolSession,
  BurnerSessionPort,
} from './domain/ports';
export type {
  BurnerDomainError,
  BurnerDomainFailure,
  BurnerDomainProgress,
  BurnerDomainResult,
  BurnerDomainSuccess,
  BurnerErrorCode,
  BurnerErrorStage,
} from './domain/result';
export { createBurnerUseCase, type CreateBurnerUseCaseOptions } from './factory';
export { type BurnerFlowContext, type BurnerFlowOptions, runBurnerFlow } from './flow-template';
export type { BurnerLogEntry, BurnerSessionState, LogLevel } from './types';
