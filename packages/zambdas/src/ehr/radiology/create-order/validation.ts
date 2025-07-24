import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { CODE_SYSTEM_ICD_10, getSecret, Secrets, SecretsKeys } from 'utils';
import { validateJsonBody, ZambdaInput } from '../../../shared';
import { EnhancedBody, ValidatedCPTCode, ValidatedICD10Code, ValidatedInput } from '.';

export const validateInput = async (
  input: ZambdaInput,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<ValidatedInput> => {
  const validatedBody = await validateBody(input, secrets, oystehr);

  const callerAccessToken = input.headers.Authorization.replace('Bearer ', '');
  if (callerAccessToken == null) {
    throw new Error('Caller access token is required');
  }

  return {
    body: validatedBody,
    callerAccessToken,
  };
};

const validateBody = async (input: ZambdaInput, secrets: Secrets, oystehr: Oystehr): Promise<EnhancedBody> => {
  const { diagnosisCode, cptCode, encounterId, stat, clinicalHistory } = validateJsonBody(input);

  const diagnosis = await validateICD10Code(diagnosisCode, secrets);
  const cpt = await validateCPTCode(cptCode, secrets);
  const encounter = await fetchEncounter(encounterId, oystehr);

  if (typeof stat !== 'boolean') {
    throw new Error('Stat is required and must be a boolean');
  }

  if (!clinicalHistory || typeof clinicalHistory !== 'string') {
    throw new Error('Clinical history is required and must be a string');
  }

  return {
    diagnosis,
    cpt,
    encounter,
    stat,
    clinicalHistory,
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
    NLM_API_KEY,
    FHIR_API,
    PROJECT_API,
  } = secrets;
  if (
    !ADVAPACS_CLIENT_ID ||
    !ADVAPACS_CLIENT_SECRET ||
    !AUTH0_ENDPOINT ||
    !AUTH0_CLIENT ||
    !AUTH0_SECRET ||
    !AUTH0_AUDIENCE ||
    !NLM_API_KEY ||
    !FHIR_API ||
    !PROJECT_API
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
    NLM_API_KEY,
    FHIR_API,
    PROJECT_API,
  };
};

const validateICD10Code = async (diagnosisCode: unknown, secrets: Secrets): Promise<ValidatedICD10Code> => {
  let icdResponseBody: {
    pageSize: number;
    pageNumber: number;
    result: {
      results: {
        ui: string;
        name: string;
      }[];
      recCount: number;
    };
  } | null = null;

  // The shortest length ICD-10 code is A00, which represents Cholera.
  if (diagnosisCode == null || typeof diagnosisCode !== 'string' || diagnosisCode.length < 3) {
    throw new Error('diagnosisCode is required and must be a string of length 3 or more');
  }

  try {
    const apiKey = getSecret(SecretsKeys.NLM_API_KEY, secrets);

    const icdResponse = await fetch(
      `https://uts-ws.nlm.nih.gov/rest/search/current?apiKey=${apiKey}&pageSize=50&returnIdType=code&inputType=sourceUi&string=${diagnosisCode}&sabs=ICD10CM&searchType=exact`
    );
    if (!icdResponse.ok) {
      throw new Error(icdResponse.statusText);
    }
    icdResponseBody = (await icdResponse.json()) as {
      pageSize: number;
      pageNumber: number;
      result: {
        results: {
          ui: string;
          name: string;
        }[];
        recCount: number;
      };
    };
  } catch {
    throw new Error('Error while trying to validate ICD-10 code');
  }

  if (icdResponseBody.result.recCount < 1) {
    throw new Error('ICD-10 code is invalid');
  } else if (icdResponseBody.result.recCount > 1) {
    throw new Error('ICD-10 code is ambiguous');
  }

  const dx = {
    code: diagnosisCode,
    display: icdResponseBody.result.results[0].name,
    system: CODE_SYSTEM_ICD_10,
  };

  console.log('ICD-10 code validated:', dx);

  return dx;
};

const validateCPTCode = async (cptCode: unknown, secrets: Secrets): Promise<ValidatedCPTCode> => {
  let cptResponseBody: {
    pageSize: number;
    pageNumber: number;
    result: {
      results: {
        ui: string;
        name: string;
      }[];
      recCount: number;
    };
  } | null = null;

  // CPT codes are at least 5 digits long
  if (cptCode == null || typeof cptCode !== 'string' || cptCode.length < 5) {
    throw new Error('cptCode is required and must be a string of length 5 or more');
  }

  try {
    const apiKey = getSecret(SecretsKeys.NLM_API_KEY, secrets);

    const icdResponse = await fetch(
      `https://uts-ws.nlm.nih.gov/rest/search/current?apiKey=${apiKey}&pageSize=50&returnIdType=code&inputType=sourceUi&string=${cptCode}&sabs=CPT&searchType=exact`
    );
    if (!icdResponse.ok) {
      throw new Error(icdResponse.statusText);
    }
    cptResponseBody = (await icdResponse.json()) as {
      pageSize: number;
      pageNumber: number;
      result: {
        results: {
          ui: string;
          name: string;
        }[];
        recCount: number;
      };
    };
  } catch {
    throw new Error('Error while trying to validate CPT code');
  }

  if (cptResponseBody.result.recCount < 1) {
    throw new Error('CPT code is invalid');
  } else if (cptResponseBody.result.recCount > 1) {
    throw new Error('CPT code is ambiguous');
  }

  const cpt = {
    code: cptCode,
    display: cptResponseBody.result.results[0].name,
    system: CODE_SYSTEM_ICD_10,
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
