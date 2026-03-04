export { BurnerSession } from './burner-session';
export { createBurnerFacade, type CreateBurnerFacadeOptions } from './factory';
export { ConnectionOrchestrationUseCase } from './connection-use-case';
export {
  type BurnerFacade,
  BurnerFacadeImpl,
  type BurnerUseCase,
  BurnerUseCaseImpl,
  type GameDetectionResult,
} from './burner-use-case';
export { type BurnerFlowContext, type BurnerFlowOptions, runBurnerFlow } from './flow-template';
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
export type { BurnerLogEntry, BurnerSessionState, LogLevel } from './types';
