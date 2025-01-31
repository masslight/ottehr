// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
import { ZambdaInput } from '../types';
import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';
import { AuditEvent, FhirResource } from 'fhir/r4b';
import { getResourcesFromBatchInlineRequests, GetVersionedChartDataResponse } from 'utils';
import Oystehr from '@oystehr/sdk';
import { convertChartResourcesToResponse } from '../get-chart-data/helpers';
import { getPersonIdFromAuditEvent, parseAuditEventEntity } from 'utils/lib/helpers/resources';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { chartDataAuditEventId, secrets } = validateRequestParameters(input);
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const output = await performEffect(oystehr, chartDataAuditEventId);

    return {
      body: JSON.stringify(output),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Error saving encounter data...' }),
      statusCode: 500,
    };
  }
};

async function performEffect(oystehr: Oystehr, auditEventId: string): Promise<GetVersionedChartDataResponse> {
  const auditEvent = (await oystehr.fhir.get({ resourceType: 'AuditEvent', id: auditEventId })) as AuditEvent;
  console.log(`AuditEvent with id: ${auditEvent.id} successfully fetched`);

  const requests = parseAuditEventIntoResourceInlineRequests(auditEvent);
  console.log(
    `AuditEvent was parsed into resources requests: previousSet: ${requests.previousSet.length} requests, newSet: ${requests.newSet.length} requests.`
  );

  const [previousResourcesSet, newResourcesSet] = await Promise.all([
    getResourcesFromBatchInlineRequests(oystehr, requests.previousSet),
    getResourcesFromBatchInlineRequests(oystehr, requests.newSet),
  ]);
  console.log(
    `Resources for chart data received: previousSetRes: ${previousResourcesSet.length} resources, newSetRes: ${newResourcesSet.length} resources.`
  );

  const auditEventPatientId = getPersonIdFromAuditEvent(auditEvent, 'Patient');
  const encounterId = previousResourcesSet.find((res) => res.resourceType === 'Encounter')?.id;
  console.log(`Patient id: ${auditEventPatientId}, Encounter id: ${encounterId}`);
  if (auditEventPatientId && encounterId) {
    const previousChartData = convertChartResourcesToResponse(
      previousResourcesSet as FhirResource[],
      auditEventPatientId,
      encounterId
    ).chartData;
    const newChartData = convertChartResourcesToResponse(
      newResourcesSet as FhirResource[],
      auditEventPatientId,
      encounterId
    ).chartData;
    console.log('Chart parsed.');
    return {
      previousChartData,
      newChartData,
    };
  } else throw new Error('Patient id or encounter id was not found for this auditEvent.');
}

function parseAuditEventIntoResourceInlineRequests(auditEvent: AuditEvent): {
  previousSet: string[];
  newSet: string[];
} {
  const entities = auditEvent.entity;
  const resultOldRequests: string[] = [];
  const resultNewRequests: string[] = [];
  entities?.forEach((entity) => {
    const parsedEntity = parseAuditEventEntity(entity);
    const entityResourceReference = parsedEntity.resourceReference.reference;

    resultOldRequests.push(`/${entityResourceReference}/_history/${parsedEntity.previousVersionId}`);
    if (parsedEntity.newVersionId)
      resultNewRequests.push(`/${entityResourceReference}/_history/${parsedEntity.newVersionId}`);
    else resultNewRequests.push(`/${entityResourceReference}/_history/${parsedEntity.previousVersionId}`);
  });
  return {
    previousSet: resultOldRequests,
    newSet: resultNewRequests,
  };
}
