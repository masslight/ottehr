import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, List, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  addOperation,
  EXPORTED_QUESTIONNAIRE_CODE,
  findExistingListByDocumentTypeCode,
  getSecret,
  PAPERWORK_PDF_ATTACHMENT_TITLE,
  PAPERWORK_PDF_BASE_NAME,
  replaceOperation,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  createPresignedUrl,
  getAuth0Token,
  topLevelCatch,
  uploadObjectToZ3,
  validateJsonBody,
  validateString,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { makeZ3Url } from '../../shared/presigned-file-urls';
import { createDocument } from './document';
import { generatePdf } from './draw';

interface Input {
  questionnaireResponseId: string;
  documentReference: DocumentReference;
  secrets: Secrets | null;
}

const ZAMBDA_NAME = 'paperwork-to-pdf';
const BUCKET_PAPERWORK_PDF = 'exported-questionnaires';

let oystehrToken: string;

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { questionnaireResponseId, documentReference: documentReferenceBase, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const questionnaireResponse = await oystehr.fhir.get<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: questionnaireResponseId,
    });

    const document = await createDocument(questionnaireResponse, oystehr);
    const pdfDocument = await generatePdf(document);

    const timestamp = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
    const fileName = `${PAPERWORK_PDF_BASE_NAME}-${questionnaireResponse.id}-${questionnaireResponse.meta?.versionId}-${timestamp}.pdf`;

    const baseFileUrl = makeZ3Url({
      secrets,
      fileName,
      bucketName: BUCKET_PAPERWORK_PDF,
      patientID: document.patientInfo.id,
    });

    console.log('Uploading file to bucket, ', BUCKET_PAPERWORK_PDF);

    let presignedUrl;
    try {
      presignedUrl = await createPresignedUrl(m2mToken, baseFileUrl, 'upload');
      await uploadObjectToZ3(new Uint8Array(await pdfDocument.save()), presignedUrl);
    } catch (error: any) {
      throw new Error(`failed uploading pdf to z3:  ${JSON.stringify(error.message)}`);
    }

    if (questionnaireResponse.encounter) {
      documentReferenceBase.context = {
        encounter: [questionnaireResponse.encounter],
      };
    }
    const documentReference = await oystehr.fhir.create<DocumentReference>({
      ...documentReferenceBase,
      subject: {
        reference: 'Patient/' + document.patientInfo.id,
      },
      content: [
        {
          attachment: {
            url: baseFileUrl,
            contentType: 'application/pdf',
            title: PAPERWORK_PDF_ATTACHMENT_TITLE,
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
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
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
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(oystehrToken, secrets);
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
