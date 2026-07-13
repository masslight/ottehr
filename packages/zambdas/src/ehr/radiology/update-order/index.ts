import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Extension, ServiceRequest } from 'fhir/r4b';
import {
  createOystehrClient,
  FHIR_EXTENSION,
  getPatchOperationToUpdateExtension,
  SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL,
  UpdateRadiologyOrderZambdaInput,
  UpdateRadiologyOrderZambdaOutput,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../../shared';
import { buildRadiologyOrderContent } from '../create-order';
import {
  validateCPTCode,
  validateICD10Codes,
  validatePerformingOrganization,
  validateSafetyFlags,
} from '../create-order/validation';
import { ValidatedInput, validateInput, validateSecrets } from './validation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'radiology-update-order';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    const validatedInput = await validateInput(unsafeInput);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets.FHIR_API, secrets.PROJECT_API);

    const output = await performEffect(validatedInput, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify({ output }),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
});

async function performEffect(
  validatedInput: ValidatedInput,
  oystehr: Oystehr
): Promise<UpdateRadiologyOrderZambdaOutput> {
  const { serviceRequestId, consentObtained, edit } = validatedInput.body;

  // Get the existing service request from Oystehr
  console.group('Fetching service request from Oystehr');
  const serviceRequest: ServiceRequest = await oystehr.fhir.get({
    resourceType: 'ServiceRequest',
    id: serviceRequestId,
  });
  console.groupEnd();
  console.debug('Service request fetched successfully');

  // Full content edit (external orders): rebuild the mutable fields and PUT the whole resource.
  if (edit) {
    await updateOrderContent(serviceRequest, edit, oystehr);
    return {};
  }

  // Patch the consentObtained extension on the service request
  console.group('Patching service request consentObtained extension');
  const consentOperation = getPatchOperationToUpdateExtension(serviceRequest, {
    url: FHIR_EXTENSION.ServiceRequest.consentObtained.url,
    valueBoolean: consentObtained,
  });

  if (!consentOperation) {
    console.debug('No update needed for consentObtained extension');
    return {};
  }

  await oystehr.fhir.patch({
    resourceType: 'ServiceRequest',
    id: serviceRequest.id!,
    operations: [consentOperation],
  });
  console.debug('Service request consentObtained extension patched successfully');

  return {};
}

async function updateOrderContent(
  existing: ServiceRequest,
  edit: NonNullable<UpdateRadiologyOrderZambdaInput['edit']>,
  oystehr: Oystehr
): Promise<void> {
  const diagnoses = await validateICD10Codes(edit.diagnosisCodes, oystehr);
  const cpt = await validateCPTCode(edit.cptCode, oystehr);

  if (typeof edit.stat !== 'boolean') {
    throw new Error('stat is required and must be a boolean');
  }
  if (typeof edit.consentObtained !== 'boolean') {
    throw new Error('consentObtained is required and must be a boolean');
  }
  const clinicalHistory = typeof edit.clinicalHistory === 'string' ? edit.clinicalHistory : '';
  if (clinicalHistory.length > 255) {
    throw new Error('Clinical history must be 255 characters or less');
  }

  const content = buildRadiologyOrderContent({
    diagnoses,
    cpt,
    lateralityModifier: edit.lateralityModifier,
    stat: edit.stat,
    clinicalHistory,
    studyName: typeof edit.studyName === 'string' ? edit.studyName.trim() || undefined : undefined,
    consentObtained: edit.consentObtained,
    external: edit.external === true,
    performingOrganization: validatePerformingOrganization(edit.performingOrganization),
    timeWindow: typeof edit.timeWindow === 'string' ? edit.timeWindow.trim() || undefined : undefined,
    safetyFlags: validateSafetyFlags(edit.safetyFlags),
  });

  // Preserve the original order time; the rest of the managed content is rebuilt.
  const requestedTimeExt = existing.extension?.find((ext) => ext.url === SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL);
  const extension: Extension[] = [...content.contentExtensions];
  if (requestedTimeExt) {
    extension.push(requestedTimeExt);
  }

  const updated: ServiceRequest = {
    ...existing,
    priority: content.priority,
    code: content.code,
    orderDetail: content.orderDetail,
    reasonCode: content.reasonCode,
    contained: content.contained,
    performer: content.performer,
    extension,
  };

  console.group('Updating external radiology order content');
  await oystehr.fhir.update(updated);
  console.groupEnd();
  console.debug('External radiology order content updated successfully');
}
