export { BurnerSession } from './burner-session';
export {
  type BurnerFacade,
  BurnerFacadeImpl,
  type BurnerUseCase,
  BurnerUseCaseImpl,
  type GameDetectionResult,
} from './burner-use-case';
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
  BurnerProtocolPort,
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
export { createBurnerFacade, type CreateBurnerFacadeOptions } from './factory';
export { type BurnerFlowContext, type BurnerFlowOptions, runBurnerFlow } from './flow-template';
export type { BurnerLogEntry, BurnerSessionState, LogLevel } from './types';
