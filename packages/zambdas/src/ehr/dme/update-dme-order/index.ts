import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DeviceRequest, FhirResource, Practitioner, Reference, Task } from 'fhir/r4b';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { UpdateDmeOrderInputSchema, UpdateDmeOrderResponse } from 'utils/lib/types/api/dme.types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken } from '../../../shared/auth';
import { DME_ORDER_SEARCH_TAG, isDmeOrderDeleted, makeDmeProvenance } from '../../../shared/dme';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { createOwnerReference } from '../../../shared/tasks';
import { ZambdaInput } from '../../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../../shared/validation';
import {
  fetchDmeBillingProcedures,
  fetchDmeEncounterContext,
  fetchOrderingPractitioner,
  getDeviceRequestEncounterId,
  getEncounterCptCodes,
  makeDmeDispenseTask,
  resolveCallerPractitionerId,
  runDmeTransaction,
} from '../shared/order-helpers';
import {
  DmeOrderResources,
  makeDeleteRequests,
  makeDispenseRequests,
  makeEditRequests,
  needsNewDispenseTask,
} from './helpers';

let m2mToken: string;
const ZAMBDA_NAME = 'update-dme-order';

type UpdateDmeOrderParams = ValidatedZambdaInput<typeof UpdateDmeOrderInputSchema>;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const userToken = getUserToken(input);
  const params = validateWithSchema(UpdateDmeOrderInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, params.secrets);

  const response = await updateDmeOrder(params, userToken, oystehr);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

const fetchDmeOrderResources = async (deviceRequestId: string, oystehr: Oystehr): Promise<DmeOrderResources> => {
  const resources = (
    await oystehr.fhir.search<DeviceRequest | Task>({
      resourceType: 'DeviceRequest',
      params: [
        { name: '_id', value: deviceRequestId },
        { name: '_tag', value: DME_ORDER_SEARCH_TAG },
        { name: '_revinclude', value: 'Task:based-on' },
      ],
    })
  ).unbundle();

  const deviceRequest = resources.find(
    (r): r is DeviceRequest => r.resourceType === 'DeviceRequest' && r.id === deviceRequestId
  );
  if (!deviceRequest) throw { ...FHIR_RESOURCE_NOT_FOUND('DeviceRequest'), statusCode: 404 };
  if (isDmeOrderDeleted(deviceRequest)) throw INVALID_INPUT_ERROR('This DME order has been deleted');

  return {
    deviceRequest,
    procedures: await fetchDmeBillingProcedures(deviceRequest, oystehr),
    tasks: resources.filter((r): r is Task => r.resourceType === 'Task'),
  };
};

const resolveDispenser = async (
  practitionerId: string | undefined,
  oystehr: Oystehr
): Promise<{ practitionerId: string | undefined; owner: Reference | undefined }> => {
  if (!practitionerId) return { practitionerId: undefined, owner: undefined };
  const practitioner = await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId });
  return { practitionerId, owner: createOwnerReference(practitionerId, getFullestAvailableName(practitioner) ?? '') };
};

const updateDmeOrder = async (
  params: UpdateDmeOrderParams,
  userToken: string,
  oystehr: Oystehr
): Promise<UpdateDmeOrderResponse> => {
  const [resources, callerPractitionerId] = await Promise.all([
    fetchDmeOrderResources(params.deviceRequestId, oystehr),
    resolveCallerPractitionerId(userToken, params.secrets),
  ]);
  const { deviceRequest } = resources;
  const encounterId = getDeviceRequestEncounterId(deviceRequest);
  const provenanceRequests = (requesterReference: string | undefined): BatchInputRequest<FhirResource>[] => {
    const provenance = makeDmeProvenance({
      target: `DeviceRequest/${deviceRequest.id}`,
      activity: params.action,
      callerPractitionerId,
      requesterReference,
    });
    return provenance ? [{ method: 'POST', url: '/Provenance', resource: provenance }] : [];
  };

  if (params.action === 'update') {
    const { fields } = params;
    const providerName = getFullestAvailableName(
      await fetchOrderingPractitioner(fields.orderedByPractitionerId, oystehr)
    );
    const newDispenseTask = needsNewDispenseTask(resources, fields)
      ? makeDmeDispenseTask({
          deviceRequestReference: `DeviceRequest/${deviceRequest.id}`,
          itemName: fields.itemName,
          orderDate: deviceRequest.authoredOn,
          providerName,
          context: await fetchDmeEncounterContext(encounterId, oystehr),
        })
      : undefined;
    await runDmeTransaction(
      [
        ...makeEditRequests({ resources, fields, providerName, newDispenseTask }),
        ...provenanceRequests(`Practitioner/${fields.orderedByPractitionerId}`),
      ],
      oystehr
    );
  } else if (params.action === 'dispense') {
    const { practitionerId, owner } = await resolveDispenser(callerPractitionerId, oystehr);
    await runDmeTransaction(
      [
        ...makeDispenseRequests({ resources, practitionerId, owner, at: new Date().toISOString() }),
        ...provenanceRequests(deviceRequest.requester?.reference),
      ],
      oystehr
    );
  } else {
    await runDmeTransaction(
      [...makeDeleteRequests(resources), ...provenanceRequests(deviceRequest.requester?.reference)],
      oystehr
    );
  }

  return { cptCodes: await getEncounterCptCodes(encounterId, oystehr) };
};
