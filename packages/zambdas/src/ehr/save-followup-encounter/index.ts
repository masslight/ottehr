import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter } from 'fhir/r4b';
import {
  FOLLOWUP_TYPES,
  getSecret,
  SaveFollowupEncounterZambdaInput,
  SaveFollowupEncounterZambdaOutput,
  Secrets,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { createEncounterResource, updateEncounterResource } from './helpers';

export interface SaveFollowupEncounterZambdaInputValidated extends SaveFollowupEncounterZambdaInput {
  secrets: Secrets;
}
export function validateRequestParameters(input: ZambdaInput): SaveFollowupEncounterZambdaInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  const { encounterDetails } = JSON.parse(input.body);
  if (!encounterDetails.patientId || !encounterDetails.followupType) {
    throw new Error(
      `Missing required input param(s): ${!encounterDetails.patientId ? 'patintId' : ''} ${
        !encounterDetails.followupType ? 'followupType' : ''
      }`
    );
  }

  if (!FOLLOWUP_TYPES.includes(encounterDetails.followupType)) {
    throw new Error(`followupType must be one of the following ${FOLLOWUP_TYPES}`);
  }

  if (!input.secrets) {
    throw new Error('No secrets provided');
  }

  return {
    secrets: input.secrets,
    encounterDetails,
  };
}

let m2mToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    const { secrets, encounterDetails } = validateRequestParameters(input);
    console.log('updated encounter details', encounterDetails);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    let encounter: Encounter | undefined;

    if (encounterDetails.encounterId) {
      console.log('updating a follow up encounter', encounterDetails.encounterId);
      encounter = await updateEncounterResource(encounterDetails.encounterId, encounterDetails, oystehr);
    } else {
      console.log('creating a followup encounter for patient', encounterDetails.patientId);
      encounter = await createEncounterResource(encounterDetails, oystehr);
    }

    if (encounter.id === undefined) {
      throw new Error('Encounter ID is undefined after creation or update');
    }

    const response: SaveFollowupEncounterZambdaOutput = {
      encounterId: encounter.id,
    };

    return {
      body: JSON.stringify(response),
      statusCode: 200,
    };
  } catch (error) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('admin-save-followup-encounter', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error saving followup encounter' }),
    };
  }
};
