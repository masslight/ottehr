import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getPresignedURL, getSecret, InPersonReceiptTemplateData, MIME_TYPES, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  EmailAttachment,
  getEmailClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'send-receipt-by-email';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.group('validateRequestParameters');
    const { recipientFullName, email, receiptDocRefId, secrets } = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.log('fetching document reference');
    const documentReference = await oystehr.fhir.get<DocumentReference>({
      id: receiptDocRefId,
      resourceType: 'DocumentReference',
    });
    console.log('fetched document reference id ', documentReference.id);

    const content = documentReference.content[0];
    const z3Url = content.attachment.url;
    console.log(`content: ${JSON.stringify(content)}, url: ${z3Url}`);

    if (z3Url) {
      const presignedUrl = await getPresignedURL(z3Url, m2mToken);
      const file = await fetch(presignedUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (file.status !== 200) throw new Error('Failed to fetch file, status: ' + file.status);
      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      const attachment: EmailAttachment = {
        content: fileBuffer.toString('base64'),
        filename: 'receipt.pdf',
        type: file.headers.get('content-type') || MIME_TYPES.PDF,
        disposition: 'attachment',
      };

      const templateData: InPersonReceiptTemplateData = {
        'recipient-name': recipientFullName,
        date: DateTime.now().toFormat('MM/dd/yyyy'),
      };
      const emailClient = getEmailClient(secrets);
      await emailClient.sendInPersonReceiptEmail(email, templateData, [attachment]);
    }

    return {
      body: JSON.stringify('Email sent'),
      statusCode: 200,
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
