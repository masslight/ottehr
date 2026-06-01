import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import {
  ALREADY_EXISTS_WITH_MESSAGE,
  CODE_SYSTEM_ICD_10,
  getAllFhirSearchPages,
  getSecret,
  PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE,
  PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL,
  SecretsKeys,
  UpdateApprovedPatientEducationCodesInput,
  UpdateApprovedPatientEducationCodesOutput,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { extractApprovedEducationIcdCodes } from '../shared/approved-patient-education-helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

type ValidatedInput = UpdateApprovedPatientEducationCodesInput & Pick<ZambdaInput, 'secrets'>;

interface EffectInput extends ValidatedInput {
  target: DocumentReference;
}

export const index = wrapHandler(
  'update-approved-patient-education-codes',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const validatedInput = validateRequestParameters(input);
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
      const oystehr = createOystehrClient(m2mToken, validatedInput.secrets);

      const effectInput = await complexValidation(validatedInput, oystehr);
      const result = await performEffect(effectInput, oystehr);
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('update-approved-patient-education-codes', error, ENVIRONMENT);
    }
  }
);

const complexValidation = async (validatedInput: ValidatedInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { documentReferenceId, icdCodes } = validatedInput;

  const target = await oystehr.fhir.get<DocumentReference>({
    resourceType: 'DocumentReference',
    id: documentReferenceId,
  });

  const isApproved = (target.type?.coding ?? []).some((c) => c.code === PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE);
  if (!isApproved) {
    throw new Error('DocumentReference is not an approved patient education entry');
  }

  // Reject duplicates against any other approved-education DocumentReference.
  const incomingIcdSet = new Set(icdCodes.map((c) => c.code));
  const others = await getAllFhirSearchPages<DocumentReference>(
    {
      resourceType: 'DocumentReference',
      params: [{ name: 'type', value: PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE }],
    },
    oystehr
  );
  const conflictingCodes = new Set<string>();
  for (const other of others) {
    if (other.id === documentReferenceId) continue;
    if (!(other.type?.coding ?? []).some((c) => c.code === PATIENT_EDUCATION_APPROVED_DOC_TYPE_CODE)) continue;
    for (const { code } of extractApprovedEducationIcdCodes(other)) {
      if (incomingIcdSet.has(code)) conflictingCodes.add(code);
    }
  }
  if (conflictingCodes.size > 0) {
    throw ALREADY_EXISTS_WITH_MESSAGE(
      `The following ICD codes are already used by other approved PDFs: ${Array.from(conflictingCodes).join(', ')}`
    );
  }

  return { ...validatedInput, target };
};

const performEffect = async (
  effectInput: EffectInput,
  oystehr: Oystehr
): Promise<UpdateApprovedPatientEducationCodesOutput> => {
  const { documentReferenceId, icdCodes, target } = effectInput;

  const updatedDocRef: DocumentReference = {
    ...target,
    extension: [
      ...(target.extension ?? []).filter((e) => e.url !== PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL),
      {
        url: PATIENT_EDUCATION_APPROVED_ICD_EXTENSION_URL,
        extension: icdCodes.map((c) => ({
          url: 'icdCode',
          valueCoding: {
            system: CODE_SYSTEM_ICD_10,
            code: c.code,
            display: c.display,
          },
        })),
      },
    ],
  };

  await oystehr.fhir.update<DocumentReference>(updatedDocRef);

  return { documentReferenceId };
};
