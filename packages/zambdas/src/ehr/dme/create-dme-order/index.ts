import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DeviceRequest, FhirResource, Procedure } from 'fhir/r4b';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { CreateDmeOrderInputSchema, CreateDmeOrderResponse } from 'utils/lib/types/api/dme.types';
import { checkOrCreateM2MClientToken, getUserToken } from '../../../shared/auth';
import { makeCPTCodeDTO } from '../../../shared/chart-data';
import { makeDmeBillingProcedures, makeDmeDeviceRequest, makeDmeProvenance } from '../../../shared/dme';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../../shared/validation';
import {
  fetchDmeEncounterContext,
  fetchOrderingPractitioner,
  makeBillingProcedureRequests,
  makeDmeDispenseTask,
  resolveCallerPractitionerId,
  runDmeTransaction,
} from '../shared/order-helpers';

let m2mToken: string;
const ZAMBDA_NAME = 'create-dme-order';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const userToken = getUserToken(input);
  const params = validateWithSchema(CreateDmeOrderInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, params.secrets);

  const callerPractitionerId = await resolveCallerPractitionerId(userToken, params.secrets);
  const response = await createDmeOrder(params, callerPractitionerId, oystehr);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

const createDmeOrder = async (
  params: ValidatedZambdaInput<typeof CreateDmeOrderInputSchema>,
  callerPractitionerId: string | undefined,
  oystehr: Oystehr
): Promise<CreateDmeOrderResponse> => {
  const { secrets: _secrets, encounterId, ...fields } = params;

  const [context, orderingPractitioner] = await Promise.all([
    fetchDmeEncounterContext(encounterId, oystehr),
    fetchOrderingPractitioner(fields.orderedByPractitionerId, oystehr),
  ]);
  const patientId = context.patient.id!;

  const deviceRequestFullUrl = `urn:uuid:${randomUUID()}`;
  const deviceRequest = makeDmeDeviceRequest({ fields, encounterId, patientId });
  const requests: BatchInputPostRequest<FhirResource>[] = [
    { method: 'POST', url: '/DeviceRequest', resource: deviceRequest, fullUrl: deviceRequestFullUrl },
    ...makeBillingProcedureRequests(
      makeDmeBillingProcedures({ fields, encounterId, patientId, deviceRequestReference: deviceRequestFullUrl })
    ),
  ];
  const provenance = makeDmeProvenance({
    target: deviceRequestFullUrl,
    activity: 'create',
    callerPractitionerId,
    requesterReference: deviceRequest.requester?.reference,
  });
  if (provenance) requests.push({ method: 'POST', url: '/Provenance', resource: provenance });

  if (!fields.external) {
    requests.push({
      method: 'POST',
      url: '/Task',
      resource: makeDmeDispenseTask({
        deviceRequestReference: deviceRequestFullUrl,
        itemName: fields.itemName,
        orderDate: deviceRequest.authoredOn,
        providerName: getFullestAvailableName(orderingPractitioner),
        context,
      }),
    });
  }

  const created = await runDmeTransaction(requests, oystehr);
  const deviceRequestId = created.find((r): r is DeviceRequest => r.resourceType === 'DeviceRequest')?.id;
  if (!deviceRequestId) throw new Error('DME order was not created');

  const cptCodesSaved = created
    .filter((r): r is Procedure => r.resourceType === 'Procedure')
    .map(makeCPTCodeDTO)
    .filter((dto): dto is CPTCodeDTO => !!dto);

  return { deviceRequestId, cptCodesSaved };
};
