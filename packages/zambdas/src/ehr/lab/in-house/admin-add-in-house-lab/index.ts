import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { ActivityDefinition, Provenance } from 'fhir/r4b';
import { ADMIN_IN_HOUSE_LAB_TEST_EXISTS_ERROR } from 'utils/lib/types/errors';
import { AdminAddInHouseLabInput, AdminAddInHouseLabOutput } from 'utils/lib/types/data/in-house/in-house.types';
import { IN_HOUSE_LAB_LATEST_TAG_DEFINITION } from 'utils/lib/types/data/in-house/in-house.constants';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { ZambdaInput } from '../../../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { parseCreatedResourcesBundle } from '../../../../shared/resources.helpers';
import { topLevelCatch } from '../../../../shared/lambda';
import { wrapHandler } from '../../../../shared/sentry';
import {
  convertAdminInHouseLabItemDefinitionToActivityDefinition,
  getInHouseLabTestUrlAndVersion,
  makeAdminProvenanceResourceRequest,
} from '../../shared/in-house-labs';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-add-in-house-lab';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`admin-add-in-house-lab started, input: ${JSON.stringify(input)}`);
  try {
    const validatedParameters: AdminAddInHouseLabInput & { secrets: Secrets | null; userToken: string } =
      validateRequestParameters(input);

    const { secrets, userId, data } = validatedParameters;

    console.log('validateRequestParameters success');
    console.log('This is your data in the zambda', JSON.stringify(data));

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    // determine if the canonical url exists already, error if so
    const { url: canonicalUrl, version } = getInHouseLabTestUrlAndVersion(data, {});
    const testWithUrlExists = await checkForExistingCanonicalUrl(oystehr, canonicalUrl);
    if (testWithUrlExists) {
      throw ADMIN_IN_HOUSE_LAB_TEST_EXISTS_ERROR(data.name);
    }

    // make activitydefinition config
    const draftActivityDefConfig = convertAdminInHouseLabItemDefinitionToActivityDefinition(data);

    // assign the new version string and the latest tag
    const finalActivityDefinitionFullurl = `urn:uuid:${randomUUID()}`;
    const finalActivityDefConfig: ActivityDefinition = {
      ...draftActivityDefConfig,
      version: version,
      meta: {
        ...(draftActivityDefConfig.meta || {}),
        tag: [...(draftActivityDefConfig.meta?.tag || []), IN_HOUSE_LAB_LATEST_TAG_DEFINITION],
      },
    };

    console.log('This is the new activityDef config: ', JSON.stringify(finalActivityDefConfig));

    const createActivityDefinitionPostRequest: BatchInputPostRequest<ActivityDefinition> = {
      method: 'POST',
      url: '/ActivityDefinition',
      fullUrl: finalActivityDefinitionFullurl,
      resource: finalActivityDefConfig,
    };

    const requests: BatchInputRequest<ActivityDefinition | Provenance>[] = [
      createActivityDefinitionPostRequest,
      makeAdminProvenanceResourceRequest([finalActivityDefinitionFullurl], userId, 'ADD'),
    ];

    const transactionResult = await oystehr.fhir.transaction<ActivityDefinition | Provenance>({ requests });
    console.log('this was the transactionResult', JSON.stringify(transactionResult));

    const adWriteResult = parseCreatedResourcesBundle(transactionResult).find(
      (res): res is ActivityDefinition => res.resourceType === 'ActivityDefinition'
    );
    if (!adWriteResult || !adWriteResult.id)
      throw new Error('New ActivityDefinition not in the transaction result or id is undefined');

    const response: AdminAddInHouseLabOutput = { activityDefinitionId: adWriteResult.id || '' };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error in admin-add-in-house-lab', error);

    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('admin-add-in-house-lab', error, ENVIRONMENT);
  }
});

const checkForExistingCanonicalUrl = async (oystehr: Oystehr, urlToCheck: string): Promise<boolean> => {
  console.log('checking if this canonical url exists', urlToCheck);
  const existingActivityDefinitions = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        {
          name: 'url',
          value: urlToCheck,
        },
      ],
    })
  ).unbundle();

  console.log(
    'These are the existing ADs with that url: ',
    JSON.stringify(existingActivityDefinitions.map((ad) => ad.id))
  );

  return existingActivityDefinitions.length > 0;
};
