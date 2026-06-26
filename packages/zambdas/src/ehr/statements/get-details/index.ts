import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  getOrCreateCandidApiClient,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
} from 'utils';
import {
  createClinicalOystehrClient,
  getAuth0Token,
  getStatementDetails,
  safeJsonParse,
  StatementType,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

const ZAMBDA_NAME = 'get-statement-details';

interface GetStatementTypeInput {
  statementType: StatementType;
  encounterId: string;
  secrets: Secrets;
}

const validStatementTypes = new Set<StatementType>(['standard', 'past-due', 'final-notice']);
let oystehrToken: string;

function validateRequestParameters(input: ZambdaInput): GetStatementTypeInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const body = safeJsonParse(input.body) as Record<string, unknown>;

  const statementType = body.statementType;
  if (typeof statementType !== 'string' || !validStatementTypes.has(statementType as StatementType)) {
    throw INVALID_INPUT_ERROR('statementType must be one of: standard, past-due, final-notice');
  }

  const encounterId = body.encounterId;
  if (typeof encounterId !== 'string' || encounterId.trim().length === 0) {
    throw MISSING_REQUIRED_PARAMETERS(['encounterId']);
  }

  return {
    statementType: statementType as StatementType,
    encounterId,
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets): Promise<Oystehr> {
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createClinicalOystehrClient(oystehrToken, secrets);
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedInput = validateRequestParameters(input);
  const oystehr = await createOystehr(validatedInput.secrets);
  const candidApiClient = await getOrCreateCandidApiClient(oystehr, validatedInput.secrets);
  const statementDetails = await getStatementDetails({
    encounterId: validatedInput.encounterId,
    statementType: validatedInput.statementType,
    secrets: validatedInput.secrets,
    oystehr,
    candidApiClient,
  });

  return {
    statusCode: 200,
    body: JSON.stringify(statementDetails),
  };
});
