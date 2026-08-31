import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { createFilesDocumentReferences } from 'utils/lib/fhir/helpers';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { getPaperworkResources, PAPERWORK_PDF_ATTACHMENT_TITLE } from 'utils/lib/helpers/paperwork/paperwork';
import { Secrets } from 'utils/lib/secrets';
import { PaperworkToPDFInputValidated } from 'utils/lib/types/data/paperwork.types';
import {
  EXPORTED_QUESTIONNAIRE_CODE,
  PAPERWORK_PDF_BASE_NAME,
} from 'utils/lib/types/data/paperwork/paperwork.constants';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { getAuth0Token } from '../../shared/getAuth0Token';
import { createClinicalOystehrClient, validateJsonBody, validateString } from '../../shared/helpers';
import { makeZ3Url } from '../../shared/presigned-file-urls/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createPresignedUrl, uploadObjectToZ3 } from '../../shared/z3Utils';
import { createDocument } from './document';
import { generatePdf } from './draw';

const ZAMBDA_NAME = 'paperwork-to-pdf';

let oystehrToken: string;

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { questionnaireResponseId, secrets } = validateInput(input);
  const oystehr = await createOystehr(secrets);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

  const paperworkResources = await getPaperworkResources(oystehr, questionnaireResponseId);
  if (!paperworkResources) throw new Error('Paperwork not submitted');

  const { questionnaireResponse, listResources, appointment, schedule, location } = paperworkResources;
  if (!questionnaireResponse) throw new Error('QuestionnaireResponse not found');
  const document = await createDocument(questionnaireResponse, appointment, oystehr, schedule, location);
  const pdfDocument = await generatePdf(document);

  const timestamp = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
  const fileName = `${PAPERWORK_PDF_BASE_NAME}-${questionnaireResponse?.id}-${questionnaireResponse?.meta?.versionId}-${timestamp}.pdf`;

  const baseFileUrl = makeZ3Url({
    secrets,
    fileName,
    bucketName: BUCKET_NAMES.PAPERWORK,
    patientID: document.patientInfo.id,
  });

  console.log('Uploading file to bucket, ', BUCKET_NAMES.PAPERWORK);

  let presignedUrl;
  try {
    presignedUrl = await createPresignedUrl(m2mToken, baseFileUrl, 'upload');
    await uploadObjectToZ3(await pdfDocument.save(), presignedUrl);
  } catch (error: unknown) {
    throw new Error('failed uploading pdf to z3', { cause: error });
  }

  const { docRefs } = await createFilesDocumentReferences({
    files: [
      {
        url: baseFileUrl,
        title: PAPERWORK_PDF_ATTACHMENT_TITLE,
      },
    ],
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: EXPORTED_QUESTIONNAIRE_CODE,
          display: PAPERWORK_PDF_ATTACHMENT_TITLE,
        },
      ],
      text: PAPERWORK_PDF_ATTACHMENT_TITLE,
    },
    dateCreated: DateTime.now().toUTC().toISO(),
    searchParams: [
      {
        name: 'subject',
        value: `Patient/${document.patientInfo.id}`,
      },
      {
        name: 'type',
        value: EXPORTED_QUESTIONNAIRE_CODE,
      },
      ...(questionnaireResponse.encounter?.reference
        ? [{ name: 'encounter', value: questionnaireResponse.encounter.reference }]
        : []),
    ],
    references: {
      subject: { reference: `Patient/${document.patientInfo.id}` },
      ...(questionnaireResponse.encounter && {
        context: { encounter: [questionnaireResponse.encounter] },
      }),
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
});

function validateInput(input: ZambdaInput): PaperworkToPDFInputValidated {
  const { questionnaireResponseId } = validateJsonBody(input);
  return {
    questionnaireResponseId: validateString(questionnaireResponseId, 'questionnaireResponseId'),
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createClinicalOystehrClient(oystehrToken, secrets);
}
