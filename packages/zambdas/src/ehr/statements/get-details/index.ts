import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getOrCreateCandidApiClient, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getStatementDetails,
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

  const body = JSON.parse(input.body) as Record<string, unknown>;

  const statementType = body.statementType;
  if (typeof statementType !== 'string' || !validStatementTypes.has(statementType as StatementType)) {
    throw new Error('statementType must be one of: standard, past-due, final-notice');
  }

  const encounterId = body.encounterId;
  if (typeof encounterId !== 'string' || encounterId.trim().length === 0) {
    throw new Error('encounterId is required');
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
  return createOystehrClient(oystehrToken, secrets);
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
