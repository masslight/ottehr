import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { getSecret, GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { AdminDeleteTemplateInput, validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(
  'admin-delete-template',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const validatedInput = validateRequestParameters(input);

      const { secrets } = validatedInput;
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

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

  // Verify this is a template List (has exam type coding)
  const isTemplate = templateList.code?.coding?.some(
    (c) =>
      c.system === 'https://fhir.ottehr.com/CodeSystem/global-template-in-person' ||
      c.system === 'https://fhir.ottehr.com/CodeSystem/global-template-telemed'
  );
  if (!isTemplate) {
    throw new Error(`List ${templateId} is not a global template`);
  }

  // Remove the template reference from the holder list
  const holderLists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: '_tag', value: `${GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM}|` }],
    })
  ).unbundle();

  const holderList = holderLists.find(
    (l) => l.meta?.tag?.some((tag) => tag.system === GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM)
  );

  if (holderList) {
    const updatedEntries = (holderList.entry ?? []).filter((entry) => entry.item.reference !== `List/${templateId}`);
    await oystehr.fhir.update<List>({
      ...holderList,
      entry: updatedEntries,
    });
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
