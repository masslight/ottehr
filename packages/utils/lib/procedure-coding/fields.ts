import { ProcedureFamilyModel, ProcedureStructuredField, ProcedureStructuredFieldInput } from './model.types';

export interface ProcedureFieldVisibility {
  length: boolean;
  repairDepth: boolean;
  infusionTimes: boolean;
}

export interface StructuredCodingFields {
  lengthCm?: number;
  repairDepth?: string;
  infusionStartTime?: string;
  infusionStopTime?: string;
}

export type ProcedureFieldVisibilityInput = StructuredCodingFields & ProcedureStructuredFieldInput;

export function procedureInputFieldVisibility(
  family: ProcedureFamilyModel | undefined,
  input: ProcedureStructuredFieldInput
): ProcedureFieldVisibility {
  const fields = family?.structuredFieldsFor(input) ?? [];
  return {
    length: fields.includes(ProcedureStructuredField.Length),
    repairDepth: fields.includes(ProcedureStructuredField.RepairDepth),
    infusionTimes: fields.includes(ProcedureStructuredField.InfusionTimes),
  };
}

export function procedureFieldVisibility(
  family: ProcedureFamilyModel | undefined,
  input: ProcedureFieldVisibilityInput
): ProcedureFieldVisibility {
  const requested = procedureInputFieldVisibility(family, input);
  return {
    length: requested.length || input.lengthCm != null,
    repairDepth: requested.repairDepth || input.repairDepth != null,
    infusionTimes: requested.infusionTimes || input.infusionStartTime != null || input.infusionStopTime != null,
  };
}

export function clearUnusedStructuredFields(
  target: StructuredCodingFields,
  visibility: ProcedureFieldVisibility
): void {
  if (!visibility.length) {
    target.lengthCm = undefined;
  }
  if (!visibility.repairDepth) {
    target.repairDepth = undefined;
  }
  if (!visibility.infusionTimes) {
    target.infusionStartTime = undefined;
    target.infusionStopTime = undefined;
  }
}
