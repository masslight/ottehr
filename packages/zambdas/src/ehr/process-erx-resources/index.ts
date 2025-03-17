import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, MedicationRequest } from 'fhir/r4b';
import { getPatchBinary, isTruthy } from 'utils';
import { Secrets } from 'zambda-utils';
import { topLevelCatch } from '../shared/errors';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets | null } {
  return {
    secrets: input.secrets,
  };
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const { secrets } = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);
    console.log('Created zapToken and fhir client');

    const medicationRequestSearch = await oystehr.fhir.search<MedicationRequest>({
      resourceType: 'MedicationRequest',
      params: [
        {
          name: 'encounter:missing',
          value: 'true',
        },
      ],
    });

    const medicationRequests = medicationRequestSearch.entry
      ?.filter((entry) => entry.resource?.resourceType === 'MedicationRequest')
      .map((entry) => entry.resource as MedicationRequest);

    console.log(`Med requests: ${JSON.stringify(medicationRequests)}`);

    const patientIds =
      medicationRequests
        ?.filter((medReq) => medReq.subject?.reference?.startsWith('Patient'))
        .map((medReq) => medReq.subject?.reference || '')
        .filter(isTruthy) || [];

    console.log(`Patient IDs: ${JSON.stringify(patientIds)}`);

    const encounterSearch = await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_sort',
          value: '-_lastUpdated',
        },
        {
          name: 'appointment.patient',
          value: `${patientIds.join(',')}`,
        },
        { name: '_count', value: '100' },
      ],
    });

    const encounters = encounterSearch.entry
      ?.filter((entry) => entry.resource?.resourceType === 'Encounter')
      .map((entry) => entry.resource as Encounter);

    console.log(`Encounters: ${JSON.stringify(encounters)}`);

    const batchRequests: BatchInputRequest<MedicationRequest>[] = [];

    console.log('Going through MedicationRequests');
    medicationRequests?.forEach((medReq) => {
      console.log(`Reviewing MedicationRequest with id: ${medReq.id}`);
      const practitionerRef = medReq.requester?.reference;
      const patientRef = medReq.subject?.reference;
      if (practitionerRef && patientRef) {
        console.log(`Trying to find appropriate encounters with corresponding patient and practitioner`);
        const encountersToConsider = encounters?.filter((enc) => {
          const foundPractitioner = enc.participant?.find(
            (participant) => participant.individual?.reference === practitionerRef
          );
          const foundPatient = enc.subject?.reference === patientRef;
          return foundPatient && foundPractitioner;
        });

        // adding medications to the latest updated encounter with same patient and practitioner as in Med Request resource
        const encounter = encountersToConsider?.at(0);

        console.log(`Appropriate encounter was ${encounter ? `found with id ${encounter.id}` : 'not found...'}`);

        if (encounter) {
          console.log(`Updating MedRequest with encounter ${encounter?.id}`);
          batchRequests.push(
            getPatchBinary({
              resourceType: medReq.resourceType,
              resourceId: medReq.id!,
              patchOperations: [
                {
                  op: 'add',
                  path: '/encounter',
                  value: { reference: `Encounter/${encounter.id}` },
                },
              ],
            })
          );
        }
      }
    });

    if (batchRequests.length > 0) {
      console.log(`Executing batch requests...`);
      const bundle = await oystehr.fhir.batch({ requests: batchRequests });
      console.log(`Done. Response bundle: ${JSON.stringify(bundle)}`);
    }

    return {
      statusCode: 200,
      body: 'Successfully processed erx resources',
    };
  } catch (error: any) {
    await topLevelCatch('Process ERX resources error', error, input.secrets);
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify(error.message),
    };
  }
};
