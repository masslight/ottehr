import { BatchInputRequest } from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import {
  Account,
  Coverage,
  Encounter,
  FhirResource,
  Location,
  Patient,
  Provenance,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CreateNursingOrderParameters,
  getSecret,
  NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY,
  PRACTITIONER_CODINGS,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  fillMeta,
  getMyPractitionerId,
  topLevelCatch,
  ZambdaInput,
} from '../../shared';
import { getPrimaryInsurance } from '../shared/labs';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`create-nursing-order started, input: ${JSON.stringify(input)}`);

  let validatedParameters: CreateNursingOrderParameters & { secrets: Secrets | null; userToken: string };

  try {
    validatedParameters = validateRequestParameters(input);
    console.log('validateRequestParameters success');
  } catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid request parameters. ${error.message || error}`,
      }),
    };
  }

  try {
    const { userToken, secrets, encounterId, notes } = validatedParameters;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    const _practitionerIdFromCurrentUser = await getMyPractitionerId(oystehrCurrentUser);

    const encounterResourcesRequest = async (): Promise<(Encounter | Patient | Location | Coverage | Account)[]> =>
      (
        await oystehr.fhir.search({
          resourceType: 'Encounter',
          params: [
            {
              name: '_id',
              value: encounterId,
            },
            {
              name: '_include',
              value: 'Encounter:patient',
            },
            {
              name: '_include',
              value: 'Encounter:location',
            },
            {
              name: '_revinclude:iterate',
              value: 'Coverage:patient',
            },
            {
              name: '_revinclude:iterate',
              value: 'Account:patient',
            },
          ],
        })
      ).unbundle() as (Encounter | Patient | Location | Coverage | Account)[];

    const userPractitionerIdRequest = async (): Promise<string> => {
      try {
        const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);
        return await getMyPractitionerId(oystehrCurrentUser);
      } catch (e) {
        throw Error('Resource configuration error - user creating this order must have a Practitioner resource linked');
      }
    };

    const [encounterResources, userPractitionerId] = await Promise.all([
      encounterResourcesRequest(),
      userPractitionerIdRequest(),
    ]);

    const {
      encounterSearchResults,
      coverageSearchResults,
      accountSearchResults,
      patientsSearchResults,
      locationsSearchResults,
    } = encounterResources.reduce(
      (acc, resource) => {
        if (resource.resourceType === 'Encounter') acc.encounterSearchResults.push(resource as Encounter);
        if (resource.resourceType === 'Patient') acc.patientsSearchResults.push(resource as Patient);
        if (resource.resourceType === 'Location') acc.locationsSearchResults.push(resource as Location);

        if (resource.resourceType === 'Coverage' && resource.status === 'active')
          acc.coverageSearchResults.push(resource as Coverage);

        if (resource.resourceType === 'Account' && resource.status === 'active')
          acc.accountSearchResults.push(resource as Account);

        return acc;
      },
      {
        encounterSearchResults: [] as Encounter[],
        patientsSearchResults: [] as Patient[],
        coverageSearchResults: [] as Coverage[],
        accountSearchResults: [] as Account[],
        locationsSearchResults: [] as Location[],
      }
    );

    const encounter = (() => {
      const targetEncounter = encounterSearchResults.find((encounter) => encounter.id === encounterId);
      if (!targetEncounter) throw Error('Encounter not found');
      return targetEncounter;
    })();

    const patient = (() => {
      if (patientsSearchResults.length !== 1) {
        throw Error(`Patient not found, results contain ${patientsSearchResults.length} patients`);
      }
      return patientsSearchResults[0];
    })();

    const account = (() => {
      if (accountSearchResults.length !== 1) {
        throw Error(`Account not found, results contain ${accountSearchResults.length} accounts`);
      }
      return accountSearchResults[0];
    })();

    const attendingPractitionerId = (() => {
      const practitionerId = encounter.participant
        ?.find(
          (participant) =>
            participant.type?.find(
              (type) => type.coding?.some((c) => c.system === PRACTITIONER_CODINGS.Attender[0].system)
            )
        )
        ?.individual?.reference?.replace('Practitioner/', '');

      if (!practitionerId) throw Error('Attending practitioner not found');
      return practitionerId;
    })();

    const coverage = getPrimaryInsurance(account, coverageSearchResults);

    const location: Location | undefined = locationsSearchResults[0];

    const serviceRequestFullUrl = `urn:uuid:${randomUUID()}`;

    const serviceRequestConfig: ServiceRequest = {
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      subject: {
        reference: `Patient/${patient.id}`,
      },
      encounter: {
        reference: `Encounter/${encounterId}`,
      },
      requester: {
        reference: `Practitioner/${attendingPractitionerId}`,
      },
      authoredOn: DateTime.now().toISO() || undefined,
      priority: 'stat',
      ...(location && {
        locationReference: [
          {
            type: 'Location',
            reference: `Location/${location.id}`,
          },
        ],
      }),
      meta: fillMeta('nursing order', 'order-type-tag'),
      ...(notes && { note: [{ text: notes }] }),
      ...(coverage && { insurance: [{ reference: `Coverage/${coverage.id}` }] }),
    };

    const taskConfig: Task = {
      resourceType: 'Task',
      status: 'requested',
      basedOn: [{ reference: serviceRequestFullUrl }],
      encounter: { reference: `Encounter/${encounterId}` },
      authoredOn: DateTime.now().toISO(),
      intent: 'order',
      ...(location && { location: { reference: `Location/${location.id}` } }),
    };

    const provenanceConfig: Provenance = {
      resourceType: 'Provenance',
      activity: {
        coding: [NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder],
      },
      target: [{ reference: serviceRequestFullUrl }],
      ...(location && { location: { reference: `Location/${location.id}` } }),
      recorded: DateTime.now().toISO(),
      agent: [
        {
          who: { reference: `Practitioner/${userPractitionerId}` },
          onBehalfOf: { reference: `Practitioner/${attendingPractitionerId}` },
        },
      ],
    };

    const transactionResponse = await oystehr.fhir.transaction({
      requests: [
        {
          method: 'POST',
          url: '/ServiceRequest',
          resource: serviceRequestConfig,
          fullUrl: serviceRequestFullUrl,
        },
        {
          method: 'POST',
          url: '/Task',
          resource: taskConfig,
        },
        {
          method: 'POST',
          url: '/Provenance',
          resource: provenanceConfig,
        },
      ] as BatchInputRequest<FhirResource>[],
    });

    if (!transactionResponse.entry?.every((entry) => entry.response?.status[0] === '2')) {
      throw Error('Error creating nursing order in transaction');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        transactionResponse,
      }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('create-nursing-order', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error processing request: ${error.message || error}`,
      }),
    };
  }
});
