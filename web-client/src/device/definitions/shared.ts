/**
 * Shared definition helpers.
 *
 * The capability matrix in the change design is normative: every firmware declares a
 * value for every `CapabilityKey`, and no firmware is allowed to leave a row empty.
 */
import type {
  CapabilityDeclaration,
  CapabilityRuleId,
  CompleteCapabilityDeclarations,
} from '../capabilities';
import type { DisplayText } from '../display';
import type { ParameterDescriptor, ParameterSchema, ParameterSchemaContext } from '../parameters';
import type { FirmwareDefinition, FirmwareId, ProtocolId } from '../types';

export const SUPPORTED: CapabilityDeclaration = { state: 'supported' };

export function unsupported(reason: DisplayText): CapabilityDeclaration {
  return { state: 'unsupported', reason };
}

export function conditional(ruleId: CapabilityRuleId, reason?: DisplayText): CapabilityDeclaration {
  return reason ? { state: 'conditional', ruleId, reason } : { state: 'conditional', ruleId };
}

export interface FirmwareDefinitionInput {
  readonly id: FirmwareId;
  readonly displayName: DisplayText;
  readonly protocol: ProtocolId;
  readonly baseCapabilities: CompleteCapabilityDeclarations;
  readonly parameters: (context: ParameterSchemaContext) => ParameterSchema;
}

/** Builds an immutable firmware definition from a complete matrix row set. */
export function createFirmwareDefinition(input: FirmwareDefinitionInput): FirmwareDefinition {
  return Object.freeze({
    id: input.id,
    displayName: input.displayName,
    protocol: input.protocol,
    baseCapabilities: Object.freeze({ ...input.baseCapabilities }),
    parameters: input.parameters,
  });
}

const MIN_PAGE_SIZE = 0x40;
const BEGGAR_SIZE_LINK_GROUP = 'beggar-sizes';

function sizeDescriptor(
  key: 'romPageSize' | 'romReadPageSize' | 'ramPageSize',
  label: DisplayText,
  defaultValue: number,
  maxValue: number,
  linkGroup?: string,
): ParameterDescriptor {
  return {
    key,
    kind: 'int',
    default: defaultValue,
    constraints: { min: MIN_PAGE_SIZE, max: maxValue },
    label,
    group: 'transfer',
    scope: 'parameterNamespace',
    ...(linkGroup ? { linkGroup } : {}),
  };
}

/**
 * Beggar namespace schema. Defaults are host derived; the read ceiling is the widest
 * variant sharing the namespace, so a Boost value stays storable while plain STM keeps
 * its smaller effective ceiling in the resolved session transport.
 */
export function createBeggarParameterSchema(context: ParameterSchemaContext): ParameterSchema {
  const limits = context.transport.packetLimits[context.platform];
  return [
    sizeDescriptor('romPageSize', 'ROM page size', limits.romWrite, limits.romWrite, BEGGAR_SIZE_LINK_GROUP),
    sizeDescriptor('romReadPageSize', 'ROM read page size', limits.romRead, context.transport.maxReadChunk, BEGGAR_SIZE_LINK_GROUP),
    sizeDescriptor('ramPageSize', 'RAM page size', limits.ramPage, limits.ramPage, BEGGAR_SIZE_LINK_GROUP),
  ];
}

/** FlashGBX namespace schema: fixed 256B pages plus the reconnect-scoped baud rate. */
export function createFlashgbxParameterSchema(context: ParameterSchemaContext): ParameterSchema {
  const limits = context.transport.packetLimits[context.platform];
  return [
    {
      key: 'baudRate',
      kind: 'enum',
      default: 'auto',
      constraints: { options: ['auto', 1_000_000, 1_500_000, 2_000_000] },
      label: 'Baud rate',
      description: 'auto expands to 2 Mbps',
      group: 'connection',
      scope: 'parameterNamespace',
      requiresReconnect: true,
    },
    sizeDescriptor('romPageSize', 'ROM page size', limits.romWrite, limits.romWrite),
    sizeDescriptor('romReadPageSize', 'ROM read page size', limits.romRead, context.transport.maxReadChunk),
    sizeDescriptor('ramPageSize', 'RAM page size', limits.ramPage, limits.ramPage),
  ];
}
