import { getSecret, Secrets, SecretsKeys, topLevelCatch, ZambdaInput } from 'zambda-utils';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import Oystehr from '@oystehr/sdk';
import { createDocument } from './document';
import { generatePdf } from './draw';
import { DocumentReference, List, QuestionnaireResponse } from 'fhir/r4b';
import { BUCKET_PAPERWORK_PDF } from '../../scripts/setup';
import { DateTime } from 'luxon';
import { addOperation, EXPORTED_QUESTIONNAIRE_CODE, findExistingListByDocumentTypeCode, replaceOperation } from 'utils';
import {
  captureSentryException,
  configSentry,
  createOystehrClient,
  getAuth0Token,
  validateJsonBody,
  validateString,
} from '../../shared';

interface Input {
  questionnaireResponseId: string;
  documentReference: DocumentReference;
  secrets: Secrets | null;
}

const ZAMBDA_NAME = 'paperwork-to-pdf';

let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry(ZAMBDA_NAME, input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { questionnaireResponseId, documentReference: documentReferenceBase, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    const questionnaireResponse = await oystehr.fhir.get<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: questionnaireResponseId,
    });

    const document = await createDocument(questionnaireResponse, oystehr);
    const pdfDocument = await generatePdf(document);

    const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
    const z3Bucket = projectId + '-' + BUCKET_PAPERWORK_PDF;
    await createZ3Bucket(z3Bucket, oystehr);

    const timestamp = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
    const pdfFilePath = `${document.patientInfo.id}/${questionnaireResponse.id}-${questionnaireResponse.meta?.versionId}-${timestamp}.pdf`;
    await oystehr.z3.uploadFile({
      bucketName: z3Bucket,
      'objectPath+': pdfFilePath,
      file: new Blob([new Uint8Array(await pdfDocument.save())]),
    });

    const projectApi = getSecret(SecretsKeys.PROJECT_API, secrets);
    const documentReference = await oystehr.fhir.create<DocumentReference>({
      ...documentReferenceBase,
      subject: {
        reference: 'Patient/' + document.patientInfo.id,
      },
      content: [
        {
          attachment: {
            url: `${projectApi}/z3/${z3Bucket}/${pdfFilePath}`,
            contentType: 'application/pdf',
            title: 'Paperwork PDF',
          },
        },
      ],
      date: DateTime.now().toUTC().toISO(),
    });
    await addDocumentReferenceToList(documentReference, oystehr);
    return {
      statusCode: 200,
      body: JSON.stringify({
        documentReference: 'DocumentReference/' + documentReference.id,
      }),
    };
  } catch (error: any) {
    return topLevelCatch(ZAMBDA_NAME, error, input.secrets, captureSentryException);
  }
});

function validateInput(input: ZambdaInput): Input {
  const { questionnaireResponseId, documentReference } = validateJsonBody(input);
  if (documentReference.resourceType !== 'DocumentReference') {
    throw new Error('documentReference must be a "DocumentReference" resource');
  }
  return {
    questionnaireResponseId: validateString(questionnaireResponseId, 'questionnaireResponseId'),
    documentReference: documentReference,
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (zapehrToken == null) {
    zapehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(zapehrToken, secrets);
}

async function createZ3Bucket(z3Bucket: string, oystehr: Oystehr): Promise<void> {
  await oystehr.z3
    .createBucket({
      bucketName: z3Bucket,
    })
    .catch((e) => {
      console.error(`Failed to create bucket "${z3Bucket}"`, e);
      return Promise.resolve();
    });
}

async function addDocumentReferenceToList(documentReference: DocumentReference, oystehr: Oystehr): Promise<void> {
  const lists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        {
          name: 'patient',
          value: documentReference.subject?.reference ?? '',
        },
      ],
    })
  ).unbundle();

  const list = findExistingListByDocumentTypeCode(lists, EXPORTED_QUESTIONNAIRE_CODE);
  if (list == null) {
    console.log(`List with code "${EXPORTED_QUESTIONNAIRE_CODE}" not found`);
    return;
  }

  const updatedFolderEntries = [
    ...(list?.entry ?? []),
    {
      date: DateTime.now().setZone('UTC').toISO() ?? '',
      item: {
        type: 'DocumentReference',
        reference: `DocumentReference/${documentReference.id}`,
      },
    },
  ];

  await oystehr.fhir.patch<List>({
    resourceType: 'List',
    id: list?.id ?? '',
    operations: [
      (list.entry ?? []).length > 0
        ? replaceOperation('/entry', updatedFolderEntries)
        : addOperation('/entry', updatedFolderEntries),
    ],
  });
}
