import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Extension, Procedure, ServiceRequest, Task } from 'fhir/r4b';
import { FHIR_EXTENSION } from 'utils/lib/fhir/constants';
import { getExtension } from 'utils/lib/fhir/helpers';
import { SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL } from 'utils/lib/fhir/radiology';
import { getPatchOperationToUpdateExtension } from 'utils/lib/fhir/resourcePatch';
import { createOystehrClient } from 'utils/lib/helpers/helpers';
import { UpdateRadiologyOrderZambdaInput, UpdateRadiologyOrderZambdaOutput } from 'utils/lib/types/api/radiology';
import { RADIOLOGY_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { makeCptModifierExtension } from '../../../shared/candid';
import { isRadiologyOrderReviewed, savePerformedBy } from '../../../shared/radiology';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { buildRadiologyOrderContent, ValidatedCPTCode } from '../create-order';
import {
  validateCPTCode,
  validateICD10Codes,
  validatePerformingOrganization,
  validateSafetyFlags,
} from '../create-order/validation';
import { searchRadiologyResultDocRefs } from '../shared/result-doc-refs';
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
  const { serviceRequestId, update } = validatedInput.body;

  // Get the existing service request from Oystehr
  console.group('Fetching service request from Oystehr');
  const serviceRequest: ServiceRequest = await oystehr.fhir.get({
    resourceType: 'ServiceRequest',
    id: serviceRequestId,
  });
  console.groupEnd();
  console.debug('Service request fetched successfully');

  switch (update.type) {
    case 'content':
      await updateOrderContent(serviceRequest, update.order, oystehr);
      return {};
    case 'performed-by':
      await recordPerformer(serviceRequest, update.performedById, oystehr);
      return {};
    case 'consent':
      await updateConsent(serviceRequest, update.consentObtained, oystehr);
      return {};
  }
}

async function updateConsent(
  serviceRequest: ServiceRequest,
  consentObtained: boolean,
  oystehr: Oystehr
): Promise<void> {
  const consentOperation = getPatchOperationToUpdateExtension(serviceRequest, {
    url: FHIR_EXTENSION.ServiceRequest.consentObtained.url,
    valueBoolean: consentObtained,
  });

  if (!consentOperation) {
    console.debug('No update needed for consentObtained extension');
    return;
  }

  console.group('Patching service request consentObtained extension');
  await oystehr.fhir.patch({
    resourceType: 'ServiceRequest',
    id: serviceRequest.id!,
    operations: [consentOperation],
  });
  console.groupEnd();
  console.debug('Service request consentObtained extension patched successfully');
}

/**
 * Records who performed the study. The PACS callback that moves an order to `performed` carries no
 * practitioner we can resolve, so this is the only way the name is ever captured — and it is captured on its
 * own, rather than riding along with the preliminary read, so the "performed" history row is filled at the
 * moment someone knows the answer instead of whenever a read happens to be written.
 */
async function recordPerformer(serviceRequest: ServiceRequest, performedById: string, oystehr: Oystehr): Promise<void> {
  const isExternal = !!getExtension(serviceRequest, FHIR_EXTENSION.ServiceRequest.externalRadiologyOrder.url)
    ?.valueBoolean;
  if (isExternal) {
    throw RADIOLOGY_ERROR('External radiology orders are performed elsewhere, so they record no performer.');
  }

  // `completed` is what the order list reads as the `performed` status — before that the study hasn't
  // happened, so there is nobody to record.
  if (serviceRequest.status !== 'completed') {
    throw RADIOLOGY_ERROR('This study has not been performed yet.');
  }

  const tasks = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequest.id}` }],
    })
  ).unbundle();
  if (isRadiologyOrderReviewed(tasks, serviceRequest.id!)) {
    throw RADIOLOGY_ERROR('This order has already been reviewed and can no longer be changed.');
  }

  console.group('Saving performed by on the service request');
  await savePerformedBy(serviceRequest, performedById, oystehr);
  console.groupEnd();
  console.debug('Performed by saved successfully');
}

async function updateOrderContent(
  existing: ServiceRequest,
  edit: Extract<UpdateRadiologyOrderZambdaInput['update'], { type: 'content' }>['order'],
  oystehr: Oystehr
): Promise<void> {
  // Only external (print-only) orders are editable. In-house orders are transmitted to AdvaPACS at
  // creation, and rewriting them here would silently diverge from the PACS copy and drop the
  // teleradiology extensions that the wholesale extension rebuild below does not preserve.
  const isExternal =
    existing.extension?.find((ext) => ext.url === FHIR_EXTENSION.ServiceRequest.externalRadiologyOrder.url)
      ?.valueBoolean === true;
  if (!isExternal) {
    throw new Error('Only external radiology orders can be edited');
  }

  // An external order is editable only until results are uploaded (spec: editable/reprintable up to the
  // time results have been entered). Once a result DocumentReference exists, the order is locked.
  const resultDocRefs = await searchRadiologyResultDocRefs(existing.id!, oystehr);
  if (resultDocRefs.length > 0) {
    throw new Error('Cannot edit a radiology order after results have been uploaded');
  }

  const diagnoses = await validateICD10Codes(edit.diagnosisCodes, oystehr);
  const cpt = await validateCPTCode(edit.cptCode, oystehr);

  const clinicalHistory = edit.clinicalHistory?.trim() ?? '';

  const content = buildRadiologyOrderContent({
    diagnoses,
    cpt,
    lateralityModifier: edit.lateralityModifier,
    stat: edit.stat,
    clinicalHistory,
    studyName: typeof edit.studyName === 'string' ? edit.studyName.trim() || undefined : undefined,
    consentObtained: edit.consentObtained,
    // The guard above guarantees this is an external order; the flag is not client-controlled on edit.
    external: true,
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
    // Omit reasonCode entirely when there is no diagnosis (optional at order time).
    reasonCode: content.reasonCode.length > 0 ? content.reasonCode : undefined,
    contained: content.contained,
    performer: content.performer,
    extension,
  };

  console.group('Updating external radiology order content');
  await oystehr.fhir.update(updated);
  console.groupEnd();
  console.debug('External radiology order content updated successfully');

  await syncOurProcedure(existing, cpt, edit.lateralityModifier, oystehr);
}

// create-order writes a billing Procedure (meta-tagged 'cpt-code') whose code surfaces in the chart's
// Assessment section; an edited CPT must be mirrored there or the chart keeps billing the old code.
async function syncOurProcedure(
  serviceRequest: ServiceRequest,
  cpt: ValidatedCPTCode,
  lateralityModifier: { display: string; code: string } | undefined,
  oystehr: Oystehr
): Promise<void> {
  const procedures = (
    await oystehr.fhir.search<Procedure>({
      resourceType: 'Procedure',
      params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequest.id}` }],
    })
  ).unbundle();

  if (procedures.length === 0) {
    console.warn(`No billing Procedure found for ServiceRequest/${serviceRequest.id}; skipping CPT sync`);
    return;
  }

  const modifierExtension = lateralityModifier ? { extension: [makeCptModifierExtension([lateralityModifier])] } : {};
  await Promise.all(
    procedures.map((procedure) =>
      oystehr.fhir.update<Procedure>({
        ...procedure,
        code: { coding: [{ ...cpt, ...modifierExtension }] },
      })
    )
  );
  console.debug('Billing procedure CPT code synced successfully');
}
