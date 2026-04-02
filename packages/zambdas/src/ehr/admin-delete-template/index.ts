import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { findHolderList, verifyIsTemplate } from '../shared/template-helpers';
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

  verifyIsTemplate(templateList, templateId);

  // Remove the template reference from the holder list
  const holderList = await findHolderList(oystehr);

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
