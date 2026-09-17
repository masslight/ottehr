import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { DocumentReference, List } from 'fhir/r4b';
import { replaceOperation } from 'utils/lib/helpers/operations';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, FILE_STORAGE_REQUEST_REJECTED_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { sendWarning } from '../../shared/errors';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { deleteZ3Object, Z3Error } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'delete-patient-document';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, documentRefId } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

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
    throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`DocumentReference/${documentRefId} not found`), statusCode: 404 };
  }

  const z3Urls = docRef.content?.map((c) => c.attachment?.url).filter((url): url is string => !!url) ?? [];

  console.log(`Found ${z3Urls.length} files to delete`);

  await Promise.all(
    z3Urls.map(async (url) => {
      try {
        await deleteZ3Object(url, m2mToken);
      } catch (e) {
        if (e instanceof Z3Error && e.statusCode === 404) {
          console.warn(`Z3 file not found (already deleted?), continuing: ${url}`);
        } else if (e instanceof Z3Error && e.statusCode === 403) {
          // Permanent, and no retry clears it: either the M2M policy doesn't cover this bucket
          // (config/oystehr-core/m2ms.json) or the url isn't a deletable object in this project.
          console.error(`Z3 refused to delete ${url}`);
          sendWarning('Z3 refused a patient document file delete', getSecret(SecretsKeys.ENVIRONMENT, secrets), {
            documentRefId,
            bucket: url.split('/z3/')[1]?.split('/')[0],
          });
          throw FILE_STORAGE_REQUEST_REJECTED_ERROR('Unable to delete the stored file for this document');
        } else {
          throw e;
        }
      }
    })
  );

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
});
