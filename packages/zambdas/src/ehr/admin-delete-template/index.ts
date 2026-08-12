import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { List } from 'fhir/r4b';
import { patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { AdminDeleteTemplateInput } from 'utils/lib/types/data/admin-template.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { findHolderList, verifyIsTemplate } from '../shared/template-helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(
  'admin-delete-template',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const validatedInput = validateRequestParameters(input);

      const { secrets } = validatedInput;
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createClinicalOystehrClient(m2mToken, secrets);

      const result = await performEffect(validatedInput, oystehr);

      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('admin-delete-template', error, ENVIRONMENT);
    }
  }
);

const performEffect = async (
  validatedInput: AdminDeleteTemplateInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr
): Promise<{ message: string }> => {
  const { templateId } = validatedInput;

  const templateList = await oystehr.fhir.get<List>({
    resourceType: 'List',
    id: templateId,
  });

  verifyIsTemplate(templateList, templateId);

  // Remove the template reference from the holder list.
  //
  // The holder is shared, mutable state: admin-create-template links new templates into it
  // (PATCH + If-Match) while deletes unlink theirs, and both can run concurrently. This used
  // to read the holder through search and PUT the whole filtered resource back with no version
  // guard, so a stale read could silently erase an entry another process had just added — after
  // which apply-template could no longer discover that template by name. Two guards close that:
  //   1. re-read the holder by id: findHolderList goes through search, which can serve a stale
  //      version under write load, and computing the removal from a stale entry array could
  //      skip the removal entirely (leaving a dangling reference to the deleted template);
  //   2. patchWithOptimisticLock: removes by index with If-Match, re-fetching and recomputing
  //      on a version conflict — so a concurrent holder write means retry, not clobber.
  const holderList = await findHolderList(oystehr);

  if (holderList?.id) {
    const holderId = holderList.id;
    const currentHolder = await oystehr.fhir.get<List>({ resourceType: 'List', id: holderId });
    await patchWithOptimisticLock(oystehr, { ...currentHolder, id: holderId }, (holder) =>
      makeRemoveTemplateFromHolderOps(holder, templateId)
    );
    console.log('Removed template from holder list');
  }

  await oystehr.fhir.delete({
    resourceType: 'List',
    id: templateId,
  });

  return {
    message: `Template "${templateList.title}" deleted successfully`,
  };
};

// JSON Patch removes by array index, so the ops must be computed against the exact holder
// version the If-Match header pins (patchWithOptimisticLock recomputes them on retry).
// Indices are emitted in descending order so each remove leaves the earlier ones valid.
export const makeRemoveTemplateFromHolderOps = (holderList: List, templateId: string): Operation[] => {
  const entries = holderList.entry ?? [];
  const ops: Operation[] = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].item.reference === `List/${templateId}`) {
      ops.push({ op: 'remove', path: `/entry/${i}` });
    }
  }
  return ops;
};
