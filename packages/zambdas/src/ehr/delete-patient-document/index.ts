import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { DocumentReference, List } from 'fhir/r4b';
import { getSecret, replaceOperation, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  deleteZ3Object,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'delete-patient-document';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets, documentRefId } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const docRef = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          {
            name: '_id',
            value: documentRefId,
          },
        ],
      })
    ).unbundle()[0];

    if (!docRef) {
      throw new Error(`DocumentReference not found id=${documentRefId}`);
    }

    const z3Urls = docRef.content?.map((c) => c.attachment?.url).filter((url): url is string => !!url) ?? [];

    console.log(`Found ${z3Urls.length} files to delete`);

    await Promise.all(z3Urls.map((url) => deleteZ3Object(url, m2mToken)));

    const listResources = (
      await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [{ name: 'subject', value: docRef.subject?.reference || '' }],
      })
    ).unbundle() as List[];

    const targetLists = listResources.filter(
      (list) => list.entry?.some((entry) => entry.item?.reference === `DocumentReference/${documentRefId}`)
    );

    await Promise.all(
      targetLists.map(async (list) => {
        const updatedEntries =
          list.entry?.filter((e) => e.item?.reference !== `DocumentReference/${documentRefId}`) ?? [];

        const operations: Operation[] = [replaceOperation('/entry', updatedEntries)];

        return oystehr.fhir.patch<List>({
          resourceType: 'List',
          id: list.id!,
          operations,
        });
      })
    );

    await oystehr.fhir.delete({
      resourceType: 'DocumentReference',
      id: documentRefId,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
