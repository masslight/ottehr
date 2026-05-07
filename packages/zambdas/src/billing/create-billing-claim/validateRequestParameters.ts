import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export interface CreateClaimParams {
  patientId: string;
  patientOverrides?: { firstName?: string; lastName?: string; dob?: string; gender?: string };
  coverageId?: string;
  coverageOverrides?: { subscriberId?: string };
  practitionerId?: string;
  practitionerOverrides?: { firstName?: string; lastName?: string; npi?: string };
  facilityId?: string;
  facilityOverrides?: { name?: string };
  billingProviderId?: string;
  diagnoses?: { code: string; display?: string }[];
  serviceLines?: {
    cptCode: string;
    units: number;
    charges: number;
    serviceDate: string;
    placeOfService?: string;
    modifiers?: string[];
  }[];
  secrets: ZambdaInput['secrets'];
}

function validateOverrides(overrides: unknown, allowed: string[], label: string): void {
  if (overrides === undefined) return;
  if (typeof overrides !== 'object' || overrides === null) {
    throw INVALID_INPUT_ERROR(`"${label}" must be an object when provided`);
  }
  for (const key of Object.keys(overrides)) {
    if (!allowed.includes(key)) {
      throw INVALID_INPUT_ERROR(`"${label}.${key}" is not an allowed override field`);
    }
  }
}

export function validateRequestParameters(input: ZambdaInput): CreateClaimParams {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let body: any;
  try {
    body = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  if (!body.patientId) throw MISSING_REQUIRED_PARAMETERS(['patientId']);
  if (typeof body.patientId !== 'string' || !body.patientId.trim()) {
    throw INVALID_INPUT_ERROR('"patientId" must be a non-empty string');
  }

  for (const field of ['coverageId', 'practitionerId', 'facilityId', 'billingProviderId'] as const) {
    if (body[field] !== undefined && (typeof body[field] !== 'string' || !body[field].trim())) {
      throw INVALID_INPUT_ERROR(`"${field}" must be a non-empty string when provided`);
    }
  }

  validateOverrides(body.patientOverrides, ['firstName', 'lastName', 'dob', 'gender'], 'patientOverrides');
  validateOverrides(body.coverageOverrides, ['subscriberId'], 'coverageOverrides');
  validateOverrides(body.practitionerOverrides, ['firstName', 'lastName', 'npi'], 'practitionerOverrides');
  validateOverrides(body.facilityOverrides, ['name'], 'facilityOverrides');

  if (body.diagnoses !== undefined) {
    if (!Array.isArray(body.diagnoses)) throw INVALID_INPUT_ERROR('"diagnoses" must be an array');
    for (const [i, dx] of body.diagnoses.entries()) {
      if (typeof dx.code !== 'string' || !dx.code.trim()) {
        throw INVALID_INPUT_ERROR(`"diagnoses[${i}].code" must be a non-empty string`);
      }
    }
  }

  if (body.serviceLines !== undefined) {
    if (!Array.isArray(body.serviceLines)) throw INVALID_INPUT_ERROR('"serviceLines" must be an array');
    for (const [i, line] of body.serviceLines.entries()) {
      if (typeof line.cptCode !== 'string' || !line.cptCode.trim()) {
        throw INVALID_INPUT_ERROR(`"serviceLines[${i}].cptCode" must be a non-empty string`);
      }
      if (typeof line.units !== 'number' || line.units <= 0) {
        throw INVALID_INPUT_ERROR(`"serviceLines[${i}].units" must be a positive number`);
      }
      if (typeof line.charges !== 'number') {
        throw INVALID_INPUT_ERROR(`"serviceLines[${i}].charges" must be a number`);
      }
      if (typeof line.serviceDate !== 'string' || !line.serviceDate.trim()) {
        throw INVALID_INPUT_ERROR(`"serviceLines[${i}].serviceDate" must be a non-empty string`);
      }
    }
  }

  return {
    patientId: body.patientId,
    patientOverrides: body.patientOverrides,
    coverageId: body.coverageId,
    coverageOverrides: body.coverageOverrides,
    practitionerId: body.practitionerId,
    practitionerOverrides: body.practitionerOverrides,
    facilityId: body.facilityId,
    facilityOverrides: body.facilityOverrides,
    billingProviderId: body.billingProviderId,
    diagnoses: body.diagnoses,
    serviceLines: body.serviceLines,
    secrets: input.secrets,
  };
}
