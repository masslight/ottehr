import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { APIError, getPresignedURL, getSecret, isApiError, LabelPdf, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('get-label-pdf', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { contextRelatedReference, searchParams, secrets } = validateRequestParameters(input);

    console.log('Getting token');
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    console.log('token', m2mToken);

    const oystehr = createOystehrClient(m2mToken, secrets);

    const labelDocRefs = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: 'related', value: contextRelatedReference.reference! }, ...searchParams],
      })
    ).unbundle();

    if (!labelDocRefs.length) {
      throw Error(
        `Found no DocumentReferences matching contextRelatedREference ${JSON.stringify(
          contextRelatedReference
        )} and params ${JSON.stringify(searchParams)}`
      );
    }

    const labelPdfs: LabelPdf[] = [];

    await Promise.allSettled(
      labelDocRefs.map(async (labelDocRef) => {
        const url = labelDocRef.content.find((content) => content.attachment.contentType === 'application/pdf')
          ?.attachment.url;

        if (!url) {
          throw new Error('No url found matching an application/pdf');
        }

        return {
          documentReference: labelDocRef,
          presignedURL: await getPresignedURL(url, m2mToken),
        };
      })
    ).then((results) => {
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          labelPdfs.push(result.value);
        }
      });
    });

    return {
      body: JSON.stringify(labelPdfs),
      statusCode: 200,
    };
  } catch (error: any) {
    console.log(error);
    console.log('get label pdf error:', JSON.stringify(error));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('admin-get-label-pdf', error, ENVIRONMENT);
    let body = JSON.stringify({ message: 'Error fetching label pdf' });
    if (isApiError(error)) {
      const { code, message } = error as APIError;
      body = JSON.stringify({ message, code });
    }
    return {
      statusCode: 500,
      body,
    };
  }
});
