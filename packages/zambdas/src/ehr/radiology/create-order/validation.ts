import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import {
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_ICD_10,
  INVALID_INPUT_ERROR,
  MISSING_REQUIRED_PARAMETERS,
  RADIOLOGY_SAFETY_FLAGS,
  RadiologyPerformingOrganization,
  RadiologySafetyFlag,
  Secrets,
} from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';
import { EnhancedBody, ValidatedCPTCode, ValidatedICD10Code, ValidatedInput } from '.';

export const validateInput = async (input: ZambdaInput, oystehr: Oystehr): Promise<ValidatedInput> => {
  const validatedBody = await validateBody(input, oystehr);

  const callerAccessToken = input.headers.Authorization.replace('Bearer ', '');
  if (callerAccessToken == null) {
    throw new Error('Caller access token is required');
  }

  return {
    body: validatedBody,
    callerAccessToken,
  };
};

const validateBody = async (input: ZambdaInput, oystehr: Oystehr): Promise<EnhancedBody> => {
  const {
    diagnosisCodes,
    cptCode,
    lateralityModifier,
    encounterId,
    stat,
    clinicalHistory,
    studyName,
    consentObtained,
    external,
    performingOrganization,
    timeWindow,
    safetyFlags,
  } = validateJsonBody(input);

  const isExternal = external === true;

  const diagnoses = await validateICD10Codes(diagnosisCodes, oystehr);
  const cpt = await validateCPTCode(cptCode, oystehr);
  const encounter = await fetchEncounter(encounterId, oystehr);

  if (typeof stat !== 'boolean') {
    throw new Error('Stat is required and must be a boolean');
  }

  // Clinical history is required for in-house orders, optional for external ones.
  if (clinicalHistory != null && typeof clinicalHistory !== 'string') {
    throw new Error('Clinical history must be a string');
  }
  if (!isExternal && !clinicalHistory) {
    throw new Error('Clinical history is required and must be a string');
  }
  if (typeof clinicalHistory === 'string' && clinicalHistory.length > 255) {
    throw new Error('Clinical history must be 255 characters or less');
  }
  const normalizedClinicalHistory = typeof clinicalHistory === 'string' ? clinicalHistory : '';

  if (studyName != null && typeof studyName !== 'string') {
    throw new Error('Study name must be a string');
  }

  const normalizedStudyName = typeof studyName === 'string' ? studyName.trim() || undefined : undefined;

  if (typeof consentObtained !== 'boolean') {
    throw new Error('consentObtained');
  }

  if (external != null && typeof external !== 'boolean') {
    throw new Error('external must be a boolean');
  }

  if (timeWindow != null && typeof timeWindow !== 'string') {
    throw new Error('timeWindow must be a string');
  }

  return {
    diagnoses,
    cpt,
    lateralityModifier,
    encounter,
    stat,
    clinicalHistory: normalizedClinicalHistory,
    studyName: normalizedStudyName,
    consentObtained,
    external: isExternal,
    performingOrganization: validatePerformingOrganization(performingOrganization),
    timeWindow: typeof timeWindow === 'string' ? timeWindow.trim() || undefined : undefined,
    safetyFlags: validateSafetyFlags(safetyFlags),
  };
};

export const validatePerformingOrganization = (value: unknown): RadiologyPerformingOrganization | undefined => {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw INVALID_INPUT_ERROR('performingOrganization must be an object');
  }
  const { name, address, phone, fax } = value as Record<string, unknown>;
  for (const [key, field] of Object.entries({ name, address, phone, fax })) {
    if (field != null && typeof field !== 'string') {
      throw INVALID_INPUT_ERROR(`performingOrganization.${key} must be a string`);
    }
  }
  const normalize = (field: unknown): string | undefined =>
    typeof field === 'string' ? field.trim() || undefined : undefined;
  const org: RadiologyPerformingOrganization = {
    name: normalize(name),
    address: normalize(address),
    phone: normalize(phone),
    fax: normalize(fax),
  };
  // Drop entirely-empty organizations so we don't create an empty contained resource.
  return org.name || org.address || org.phone || org.fax ? org : undefined;
};

export const validateSafetyFlags = (value: unknown): RadiologySafetyFlag[] | undefined => {
  if (value == null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw INVALID_INPUT_ERROR('safetyFlags must be an array');
  }
  for (const flag of value) {
    if (!RADIOLOGY_SAFETY_FLAGS.includes(flag as RadiologySafetyFlag)) {
      throw INVALID_INPUT_ERROR(`Invalid safety flag: ${String(flag)}`);
    }
  }
  return value.length > 0 ? (value as RadiologySafetyFlag[]) : undefined;
};

export const validateSecrets = (secrets: Secrets | null): Secrets => {
  if (!secrets) {
    throw new Error('Secrets are required');
  }

  const {
    ADVAPACS_CLIENT_ID,
    ADVAPACS_CLIENT_SECRET,
    AUTH0_ENDPOINT,
    AUTH0_CLIENT,
    AUTH0_SECRET,
    AUTH0_AUDIENCE,
    FHIR_API,
    PROJECT_API,
    ENVIRONMENT,
  } = secrets;
  // ADVAPACS_* are intentionally NOT required here: external (print-only) orders never transmit to
  // AdvaPACS. In-house orders that need it will fail later in writeAdvaPacsTransaction (and roll back)
  // if the creds are absent — same effective behavior as before, but without blocking external orders.
  if (
    !AUTH0_ENDPOINT ||
    !AUTH0_CLIENT ||
    !AUTH0_SECRET ||
    !AUTH0_AUDIENCE ||
    !FHIR_API ||
    !PROJECT_API ||
    !ENVIRONMENT
  ) {
    throw new Error('Missing required secrets');
  }
  return {
    ADVAPACS_CLIENT_ID,
    ADVAPACS_CLIENT_SECRET,
    AUTH0_ENDPOINT,
    AUTH0_CLIENT,
    AUTH0_SECRET,
    AUTH0_AUDIENCE,
    FHIR_API,
    PROJECT_API,
    ENVIRONMENT,
  };
};

export const validateICD10Codes = async (diagnosisCodes: unknown, oystehr: Oystehr): Promise<ValidatedICD10Code[]> => {
  if (diagnosisCodes == null) {
    throw MISSING_REQUIRED_PARAMETERS(['diagnosisCodes']);
  }

  if (!Array.isArray(diagnosisCodes) || diagnosisCodes.length < 1) {
    throw INVALID_INPUT_ERROR('diagnosisCodes must be a non-empty array');
  }

  // Validate each code sequentially so terminology lookups don't hammer the service in parallel
  const diagnoses: ValidatedICD10Code[] = [];
  for (const diagnosisCode of diagnosisCodes) {
    diagnoses.push(await validateICD10Code(diagnosisCode, oystehr));
  }
  return diagnoses;
};

const validateICD10Code = async (diagnosisCode: unknown, oystehr: Oystehr): Promise<ValidatedICD10Code> => {
  // validate diagnosisCode is a string
  if (diagnosisCode == null) {
    throw MISSING_REQUIRED_PARAMETERS(['diagnosisCode']);
  }

  if (typeof diagnosisCode !== 'string') {
    throw INVALID_INPUT_ERROR('diagnosisCode must be a string');
  }

  let terminologyResponse;
  try {
    terminologyResponse = await oystehr.terminology.searchIcd10({
      searchType: 'code',
      strictMatch: true,
      query: diagnosisCode,
    });
  } catch {
    throw new Error('Error while trying to validate ICD-10 code');
  }

  if (terminologyResponse.codes.length < 1) {
    throw INVALID_INPUT_ERROR('ICD-10 code is invalid');
  } else if (terminologyResponse.codes.length > 1) {
    throw INVALID_INPUT_ERROR('ICD-10 code is ambiguous');
  }

  const dx = {
    code: diagnosisCode,
    display: terminologyResponse.codes[0].display,
    system: CODE_SYSTEM_ICD_10,
  };

  console.log('ICD-10 code validated:', dx);

  return dx;
};

export const validateCPTCode = async (cptCode: unknown, oystehr: Oystehr): Promise<ValidatedCPTCode> => {
  // CPT codes are at least 5 digits long
  if (cptCode == null) {
    throw MISSING_REQUIRED_PARAMETERS(['cptCode']);
  }

  if (typeof cptCode !== 'string' || cptCode.length < 5) {
    throw INVALID_INPUT_ERROR('cptCode must be a string of at least 5 characters');
  }

  let terminologyResponse;
  try {
    terminologyResponse = await oystehr.terminology.searchCpt({
      searchType: 'code',
      strictMatch: true,
      query: cptCode,
    });
  } catch {
    throw new Error('Error while trying to validate CPT code');
  }

  if (terminologyResponse.codes.length < 1) {
    throw INVALID_INPUT_ERROR('CPT code is invalid');
  } else if (terminologyResponse.codes.length > 1) {
    throw INVALID_INPUT_ERROR('CPT code is ambiguous');
  }

  const cpt = {
    code: cptCode,
    display: terminologyResponse.codes[0].display,
    system: CODE_SYSTEM_CPT,
  };

  console.log('CPT code validated:', cpt);

  return cpt;
};

const fetchEncounter = async (encounterId: unknown, oystehr: Oystehr): Promise<Encounter> => {
  if (encounterId == null || typeof encounterId !== 'string') {
    throw new Error('Encounter ID is required and must be a string.');
  }

  try {
    return await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: encounterId,
    });
  } catch {
    throw new Error('Error while trying to fetch encounter');
  }
};
