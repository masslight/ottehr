import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
  SignAppointmentInput,
  SignAppointmentResponse,
  getVisitStatus,
  getEncounterStatusHistoryUpdateOp,
  getPatchBinary,
  VisitStatusLabel,
  visitStatusToFhirAppointmentStatusMap,
  visitStatusToFhirEncounterStatusMap,
  getCriticalUpdateTagOp,
  progressNoteChartDataRequestedFields,
  Secrets,
} from 'utils';
import { CandidApiClient, CandidApiEnvironment } from 'candidhealth';

import { validateRequestParameters } from './validateRequestParameters';
import { getChartData } from '../get-chart-data';
import { assertDefined, checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { ZambdaInput } from '../types';
import { VideoResourcesAppointmentPackage } from '../shared/pdf/visit-details-pdf/types';
import { getVideoResources } from '../shared/pdf/visit-details-pdf/get-video-resources';
import { composeAndCreateVisitNotePdf } from '../shared/pdf/visit-details-pdf/visit-note-pdf-creation';
import { makeVisitNotePdfDocumentReference } from '../shared/pdf/visit-details-pdf/make-visit-note-pdf-document-reference';
import { getSecret, SecretsKeys } from '../shared';
import { candidCreateEncounterRequest, CreateEncounterInput } from '../shared/candid';
import { Condition, FhirResource, Procedure, Reference } from 'fhir/r4b';
import { chartDataResourceHasMetaTagByCode } from '../shared/chart-data/chart-data-helpers';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;
let candidApiClient: CandidApiClient;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, validatedParameters.secrets);

    const oystehr = createOystehrClient(m2mtoken, validatedParameters.secrets);
    const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr, oystehrCurrentUser, validatedParameters);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Stringified error: ' + JSON.stringify(error));
    console.error('Error: ' + error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error changing appointment status and creating a charge.' }),
    };
  }
};

export const performEffect = async (
  oystehr: Oystehr,
  oystehrCurrentUser: Oystehr,
  params: SignAppointmentInput
): Promise<SignAppointmentResponse> => {
  const { appointmentId, secrets } = params;

  const newStatus = 'completed';

  const visitResources = await getVideoResources(oystehr, appointmentId, true);

  if (!visitResources) {
    {
      throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
    }
  }
  const { encounter, patient, appointment } = visitResources;

  if (encounter?.subject?.reference === undefined) {
    throw new Error(`No subject reference defined for encounter ${encounter?.id}`);
  }

  const candidEncounterId = await createCandidEncounter(visitResources, oystehr, secrets);

  console.log(`appointment and encounter statuses: ${appointment.status}, ${encounter.status}`);
  const currentStatus = getVisitStatus(appointment, encounter);
  if (currentStatus) {
    await changeStatus(oystehr, oystehrCurrentUser, visitResources, newStatus, candidEncounterId);
  }
  console.debug(`Status has been changed.`);

  const chartDataPromise = getChartData(oystehr, visitResources.encounter.id!);
  const additionalChartDataPromise = getChartData(
    oystehr,
    visitResources.encounter.id!,
    progressNoteChartDataRequestedFields
  );

  const [chartData, additionalChartData] = (await Promise.all([chartDataPromise, additionalChartDataPromise])).map(
    (promise) => promise.response
  );

  console.log('Chart data received');
  const pdfInfo = await composeAndCreateVisitNotePdf(
    { chartData, additionalChartData },
    visitResources,
    secrets,
    m2mtoken
  );
  if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);
  console.log(`Creating visit note pdf docRef`);
  await makeVisitNotePdfDocumentReference(oystehr, pdfInfo, patient.id, appointmentId, encounter.id!);

  return {
    message: 'Appointment status successfully changed.',
  };
};

const changeStatus = async (
  oystehr: Oystehr,
  oystehrCurrentUser: Oystehr,
  resourcesToUpdate: VideoResourcesAppointmentPackage,
  status: VisitStatusLabel,
  candidEncounterId: string | undefined
): Promise<void> => {
  if (!resourcesToUpdate.appointment || !resourcesToUpdate.appointment.id) {
    throw new Error('Appointment is not defined');
  }
  if (!resourcesToUpdate.encounter || !resourcesToUpdate.encounter.id) {
    throw new Error('Encounter is not defined');
  }

  const appointmentStatus = visitStatusToFhirAppointmentStatusMap[status];
  const encounterStatus = visitStatusToFhirEncounterStatusMap[status];

  const patchOps: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: appointmentStatus,
    },
  ];

  const user = await oystehrCurrentUser.user.me();

  const updateTag = getCriticalUpdateTagOp(
    resourcesToUpdate.appointment,
    `Staff ${user?.email ? user.email : `(${user?.id})`}`
  );
  patchOps.push(updateTag);

  const encounterPatchOps: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: encounterStatus,
    },
  ];

  if (candidEncounterId != null) {
    encounterPatchOps.push({
      op: 'add',
      path: '/identifier',
      value: [
        {
          system: 'https://api.joincandidhealth.com/api/encounters/v4/response/encounter_id',
          value: candidEncounterId,
        },
      ],
    });
  }

  const encounterStatusHistoryUpdate: Operation = getEncounterStatusHistoryUpdateOp(
    resourcesToUpdate.encounter,
    encounterStatus
  );
  encounterPatchOps.push(encounterStatusHistoryUpdate);

  const appointmentPatch = getPatchBinary({
    resourceType: 'Appointment',
    resourceId: resourcesToUpdate.appointment.id,
    patchOperations: patchOps,
  });
  const encounterPatch = getPatchBinary({
    resourceType: 'Encounter',
    resourceId: resourcesToUpdate.encounter.id,
    patchOperations: encounterPatchOps,
  });

  await oystehr.fhir.transaction({
    requests: [appointmentPatch, encounterPatch],
  });
};

const createCandidEncounter = async (
  visitResources: VideoResourcesAppointmentPackage,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<string | undefined> => {
  const candidClientId = getSecret(SecretsKeys.CANDID_CLIENT_ID, secrets);
  if (candidClientId == null || candidClientId.length === 0) {
    return undefined;
  }
  const createEncounterInput = await createCandidCreateEncounterInput(visitResources, oystehr);
  const apiClient = createCandidApiClient(secrets);
  const request = await candidCreateEncounterRequest(createEncounterInput, apiClient);
  console.log('Candid request:' + JSON.stringify(request, null, 2));
  const response = await apiClient.encounters.v4.create(request);
  if (!response.ok) {
    throw new Error(`Error creating a Candid encounter. Response body: ${JSON.stringify(response.error)}`);
  }
  const encounter = response.body;
  console.log('Created Candid encounter:' + JSON.stringify(encounter));
  return encounter.encounterId;
};

const createCandidCreateEncounterInput = async (
  visitResources: VideoResourcesAppointmentPackage,
  oystehr: Oystehr
): Promise<CreateEncounterInput> => {
  const { encounter } = visitResources;
  const encounterId = encounter.id;
  const coverage = visitResources.coverage;
  return {
    encounter: encounter,
    patient: assertDefined(visitResources.patient, `Patient on encounter ${encounterId}`),
    practitioner: assertDefined(visitResources.practitioner, `Practitioner on encounter ${encounterId}`),
    diagnoses: (
      await oystehr.fhir.search<Condition>({
        resourceType: 'Condition',
        params: [
          {
            name: 'encounter',
            value: `Encounter/${encounterId}`,
          },
        ],
      })
    )
      .unbundle()
      .filter(
        (condition) =>
          encounter.diagnosis?.find((diagnosis) => diagnosis.condition?.reference === 'Condition/' + condition.id) !=
          null
      ),
    procedures: (
      await oystehr.fhir.search<Procedure>({
        resourceType: 'Procedure',
        params: [
          {
            name: 'subject',
            value: assertDefined(encounter.subject?.reference, `Patient id on encounter ${encounterId}`),
          },
          {
            name: 'encounter',
            value: `Encounter/${encounterId}`,
          },
        ],
      })
    )
      .unbundle()
      .filter((procedure) => chartDataResourceHasMetaTagByCode(procedure, 'cpt-code')),
    insuranceResources: coverage
      ? {
          coverage: coverage,
          subsriber: await resourceByReference(coverage.subscriber, 'Coverage.subscriber', oystehr),
          payor: await resourceByReference(coverage.payor[0], 'Coverage.payor[0]', oystehr),
        }
      : undefined,
  };
};

const resourceByReference = <T extends FhirResource>(
  reference: Reference | undefined,
  referencePath: string,
  oystehr: Oystehr
): Promise<T> => {
  const [resourceType, id] = assertDefined(reference?.reference, referencePath + '.reference').split('/');
  return oystehr.fhir.get<T>({
    resourceType,
    id,
  });
};

const createCandidApiClient = (secrets: Secrets | null): CandidApiClient => {
  if (candidApiClient == null) {
    candidApiClient = new CandidApiClient({
      clientId: getSecret(SecretsKeys.CANDID_CLIENT_ID, secrets),
      clientSecret: getSecret(SecretsKeys.CANDID_CLIENT_SECRET, secrets),
      environment:
        getSecret(SecretsKeys.CANDID_ENV, secrets) === 'PROD'
          ? CandidApiEnvironment.Production
          : CandidApiEnvironment.Staging,
    });
  }
  return candidApiClient;
};
