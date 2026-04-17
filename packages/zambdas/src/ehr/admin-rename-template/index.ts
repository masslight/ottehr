import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  AdminRenameTemplateInput,
  getSecret,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

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

  // Verify this is a template List (has exam type coding)
  const isTemplate = templateList.code?.coding?.some(
    (c) => c.system === GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM || c.system === GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM
  );
  if (!isTemplate) {
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
