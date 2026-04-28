import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { CODE_SYSTEM_CPT, CODE_SYSTEM_ICD_10, Secrets } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';
import { searchIcd10Codes } from '../../../shared/icd-10-search';
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
  const { diagnosisCode, cptCode, lateralityModifier, encounterId, stat, clinicalHistory, studyName, consentObtained } =
    validateJsonBody(input);

  const diagnosis = await validateICD10Code(diagnosisCode);
  const cpt = await validateCPTCode(cptCode, oystehr);
  const encounter = await fetchEncounter(encounterId, oystehr);

  if (typeof stat !== 'boolean') {
    throw new Error('Stat is required and must be a boolean');
  }

  if (!clinicalHistory || typeof clinicalHistory !== 'string') {
    throw new Error('Clinical history is required and must be a string');
  }

  if (clinicalHistory.length > 255) {
    throw new Error('Clinical history must be 255 characters or less');
  }

  if (studyName != null && typeof studyName !== 'string') {
    throw new Error('Study name must be a string');
  }

  const normalizedStudyName = typeof studyName === 'string' ? studyName.trim() || undefined : undefined;

  if (typeof consentObtained !== 'boolean') {
    throw new Error('consentObtained');
  }

  return {
    diagnosis,
    cpt,
    lateralityModifier,
    encounter,
    stat,
    clinicalHistory,
    studyName: normalizedStudyName,
    consentObtained,
  };
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
  if (
    !ADVAPACS_CLIENT_ID ||
    !ADVAPACS_CLIENT_SECRET ||
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

const validateICD10Code = async (diagnosisCode: unknown): Promise<ValidatedICD10Code> => {
  // validate diagnosisCode is a string
  if (diagnosisCode == null || typeof diagnosisCode !== 'string') {
    throw new Error('diagnosisCode is required and must be a string');
  }

  const searchResult = await searchIcd10Codes(diagnosisCode as string);

  if (searchResult.length < 1) {
    throw new Error('ICD-10 code is invalid');
  } else if (searchResult.length > 1) {
    throw new Error('ICD-10 code is ambiguous');
  }

  const dx = {
    code: diagnosisCode,
    display: searchResult[0].display,
    system: CODE_SYSTEM_ICD_10,
  };

  console.log('ICD-10 code validated:', dx);

  return dx;
};

const validateCPTCode = async (cptCode: unknown, oystehr: Oystehr): Promise<ValidatedCPTCode> => {
  // CPT codes are at least 5 digits long
  if (cptCode == null || typeof cptCode !== 'string' || cptCode.length < 5) {
    throw new Error('cptCode is required and must be a string of length 5 or more');
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
    throw new Error('CPT code is invalid');
  } else if (terminologyResponse.codes.length > 1) {
    throw new Error('CPT code is ambiguous');
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
