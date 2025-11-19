import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi } from 'candidhealth';
import { randomUUID } from 'crypto';
import { Encounter, List } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  createCandidApiClient,
  createFilesDocumentReferences,
  EXPORTED_QUESTIONNAIRE_CODE,
  GenerateStatementInput,
  getSecret,
  OTTEHR_MODULE,
  PAPERWORK_PDF_ATTACHMENT_TITLE,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  assertDefined,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  createPresignedUrl,
  getAuth0Token,
  getCandidEncounterIdFromEncounter,
  topLevelCatch,
  uploadObjectToZ3,
  validateJsonBody,
  validateString,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { makeZ3Url } from '../../shared/presigned-file-urls';
import { generatePdf } from './draw';

const ZAMBDA_NAME = 'generate-statement';

export interface GenerateStatementInputValidated extends GenerateStatementInput {
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

    const serviceLines =
      candidClaimResponse && candidClaimResponse.ok ? candidClaimResponse?.body?.serviceLineItemization : undefined;

    const pdfDocument = await generatePdf(serviceLines ?? []);

    const timestamp = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
    const fileName = `Statement-${encounterId}-${timestamp}.pdf`;
    const patientId = encounter.subject?.reference?.split('/')[1];

    if (!patientId) {
      throw new Error(`Patient id not found in "${encounterReference}"`);
    }

    const baseFileUrl = makeZ3Url({
      secrets,
      fileName,
      bucketName: BUCKET_NAMES.PAPERWORK, // todo
      patientID: patientId,
    });

    console.log('Uploading file to bucket, ', BUCKET_NAMES.PAPERWORK); // todo

    let presignedUrl;
    try {
      presignedUrl = await createPresignedUrl(m2mToken, baseFileUrl, 'upload');
      await uploadObjectToZ3(new Uint8Array(await pdfDocument.save()), presignedUrl);
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

    const { docRefs } = await createFilesDocumentReferences({
      files: [
        {
          url: baseFileUrl,
          title: PAPERWORK_PDF_ATTACHMENT_TITLE, // todo
        },
      ],
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: EXPORTED_QUESTIONNAIRE_CODE, // todo
            display: PAPERWORK_PDF_ATTACHMENT_TITLE, // todo
          },
        ],
        text: PAPERWORK_PDF_ATTACHMENT_TITLE, // todo
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
          value: EXPORTED_QUESTIONNAIRE_CODE, // todo
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
  const { encounterId } = validateJsonBody(input);
  return {
    encounterId: validateString(encounterId, 'encounterId'),
    secrets: assertDefined(input.secrets, 'input.secrets'),
  };
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(oystehrToken, secrets);
}
