import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { getSecret, GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { AdminRenameTemplateInput, validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(
  'admin-rename-template',
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
      return topLevelCatch('admin-rename-template', error, ENVIRONMENT);
    }
  }
);

const performEffect = async (
  validatedInput: AdminRenameTemplateInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr
): Promise<{ message: string; templateId: string; newName: string }> => {
  const { templateId, newName } = validatedInput;

  const templateList = await oystehr.fhir.get<List>({
    resourceType: 'List',
    id: templateId,
  });

  // Verify this is a global template
  const hasGlobalTemplateTag = templateList.meta?.tag?.some(
    (tag) => tag.system === GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM
  );
  if (!hasGlobalTemplateTag) {
    throw new Error(`List ${templateId} is not a global template`);
  }

  templateList.title = newName;

  await oystehr.fhir.update<List>(templateList);

  return {
    message: `Template renamed to "${newName}" successfully`,
    templateId,
    newName,
  };
};
