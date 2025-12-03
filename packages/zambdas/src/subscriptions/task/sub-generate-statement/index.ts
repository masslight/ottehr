import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi } from 'candidhealth';
import { randomUUID } from 'crypto';
import { Appointment, Encounter, List, Location, Patient, Resource, Schedule, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  createCandidApiClient,
  createFilesDocumentReferences,
  formatDateToMDYWithTime,
  GenerateStatementInput,
  getSecret,
  OTTEHR_MODULE,
  Secrets,
  SecretsKeys,
  STATEMENT_CODE,
} from 'utils';
import { getAccountAndCoverageResourcesForPatient } from '../../../ehr/shared/harvest';
import {
  assertDefined,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  createPresignedUrl,
  getAuth0Token,
  getCandidEncounterIdFromEncounter,
  resolveTimezone,
  topLevelCatch,
  uploadObjectToZ3,
  validateJsonBody,
  validateString,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { makeZ3Url } from '../../../shared/presigned-file-urls';
import { generatePdf } from './draw';

const ZAMBDA_NAME = 'generate-statement';
const STATEMENT = 'Statement';

interface StatementResources {
  appointment: Appointment;
  encounter: Encounter;
  patient: Patient;
  location: Location | undefined;
  timezone: string;
}

interface GenerateStatementInputValidated extends GenerateStatementInput {
  secrets: Secrets;
}

let oystehrToken: string;

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { encounterId, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const resources = await getResources(encounterId, oystehr);

    const { guarantorResource } = await getAccountAndCoverageResourcesForPatient(resources.patient.id ?? '', oystehr);

    const encounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: encounterId,
    });
    const encounterReference = `Encounter/${encounterId}`;

    const candidEncounterId = getCandidEncounterIdFromEncounter(encounter);

    if (!candidEncounterId) {
      throw new Error(`Candid encounter id is missing for "${encounterReference}"`);
    }

    const candid = createCandidApiClient(secrets);
    const candidEncounterResponse = await candid.encounters.v4.get(CandidApi.EncounterId(candidEncounterId));

    const candidClaimId =
      candidEncounterResponse && candidEncounterResponse.ok
        ? candidEncounterResponse.body?.claims?.[0]?.claimId
        : undefined;

    if (!candidClaimId) {
      throw new Error(`Candid encounter "${candidEncounterId}" has no claim`);
    }

    const candidClaimResponse = await candid.patientAr.v1.itemize(CandidApi.ClaimId(candidClaimId));

    const itemizationResponse = candidClaimResponse && candidClaimResponse.ok ? candidClaimResponse?.body : undefined;

    if (!itemizationResponse) {
      throw new Error('Failed to get itemization response');
    }

    const pdfDocument = await generatePdf({
      ...resources,
      itemizationResponse,
      responsibleParty: guarantorResource,
      procedureNameProvider: async (procedureCode: string): Promise<string> => {
        return getProcedureCodeTitle(procedureCode, secrets);
      },
    });

    const timestamp = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
    const fileName = `Statement-${encounterId}-${timestamp}.pdf`;
    const patientId = encounter.subject?.reference?.split('/')[1];

    if (!patientId) {
      throw new Error(`Patient id not found in "${encounterReference}"`);
    }

    const baseFileUrl = makeZ3Url({
      secrets,
      fileName,
      bucketName: BUCKET_NAMES.STATEMENTS,
      patientID: patientId,
    });

    console.log('Uploading file to bucket, ', BUCKET_NAMES.STATEMENTS);

    let presignedUrl;
    try {
      presignedUrl = await createPresignedUrl(m2mToken, baseFileUrl, 'upload');
      await uploadObjectToZ3(pdfDocument, presignedUrl);
    } catch (error: any) {
      throw new Error(`failed uploading pdf to z3:  ${JSON.stringify(error.message)}`);
    }

    const patientReference = `Patient/${patientId}`;

    const listResources = (
      await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [
          {
            name: 'patient',
            value: patientReference,
          },
        ],
      })
    ).unbundle();

    const { date: appointmentDate, time: appointmentTime } =
      formatDateToMDYWithTime(resources.appointment?.start, resources.timezone) ?? {};

    const { docRefs } = await createFilesDocumentReferences({
      files: [
        {
          url: baseFileUrl,
          title: `${STATEMENT}-${appointmentDate}-${appointmentTime}`,
        },
      ],
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: STATEMENT_CODE,
            display: STATEMENT,
          },
        ],
        text: STATEMENT,
      },
      dateCreated: DateTime.now().toUTC().toISO(),
      searchParams: [
        {
          name: 'encounter',
          value: encounterReference,
        },
        {
          name: 'subject',
          value: patientReference,
        },
        {
          name: 'type',
          value: STATEMENT_CODE,
        },
      ],
      references: {
        subject: {
          reference: patientReference,
        },
        context: {
          encounter: [
            {
              reference: encounterReference,
            },
          ],
        },
      },
      oystehr,
      generateUUID: randomUUID,
      listResources: listResources,
      meta: {
        tag: [{ code: OTTEHR_MODULE.IP }, { code: OTTEHR_MODULE.TM }],
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        documentReference: 'DocumentReference/' + docRefs[0].id,
      }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

function validateInput(input: ZambdaInput): GenerateStatementInputValidated {
  const inputJson = validateJsonBody(input);

  if (inputJson.resourceType !== 'Task') {
    throw new Error(`Input needs to be a Task resource`);
  }

  const task = inputJson as Task;

  return {
    encounterId: validateString(task.encounter?.reference?.split('/')[1], 'encounterId'),
    secrets: assertDefined(input.secrets, 'input.secrets'),
  };
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(oystehrToken, secrets);
}

const getResources = async (encounterId: string, oystehr: Oystehr): Promise<StatementResources> => {
  const items: Array<Appointment | Encounter | Patient | Location | Schedule> = (
    await oystehr.fhir.search<Appointment | Encounter | Patient | Location | Schedule>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:location',
        },
        {
          name: '_revinclude:iterate',
          value: 'Schedule:actor:Location',
        },
      ],
    })
  ).unbundle();

  const appointment: Appointment | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Appointment';
  }) as Appointment;
  if (!appointment) throw new Error('Appointment not found');

  const encounter: Encounter | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Encounter';
  }) as Encounter;
  if (!encounter) throw new Error('Encounter not found');

  const patient: Patient | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Patient';
  }) as Patient;
  if (!patient) throw new Error('Patient not found');

  const location: Location | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Location';
  }) as Location;

  const schedule: Schedule | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Schedule';
  }) as Schedule;

  const timezone = resolveTimezone(schedule, location, 'America/New_York');

  return {
    appointment,
    encounter,
    patient,
    location,
    timezone,
  };
};

async function getProcedureCodeTitle(code: string, secrets: Secrets): Promise<string> {
  const apiKey = getSecret(SecretsKeys.NLM_API_KEY, secrets);
  const names = await Promise.all([searchCodeName(code, 'HCPT', apiKey), searchCodeName(code, 'HCPCS', apiKey)]);
  const name = names.find((name) => name != null);
  return name ? `${code} - ${name}` : code;
}

async function searchCodeName(code: string, sabs: string, apiKey: string): Promise<string | undefined> {
  const response = await fetch(
    `https://uts-ws.nlm.nih.gov/rest/search/current?apiKey=${apiKey}&returnIdType=code&inputType=code&string=${code}&sabs=${sabs}&partialSearch=true&searchType=rightTruncation`
  );
  if (!response.ok) {
    return undefined;
  }
  const responseBody = (await response.json()) as {
    result: {
      results: {
        ui: string;
        name: string;
      }[];
    };
  };
  return responseBody.result.results.find((entry) => entry)?.name;
}
