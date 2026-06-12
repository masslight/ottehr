import { APIGatewayProxyResult } from 'aws-lambda';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, listBaseFlows, listFlowsWithServices } from '../admin-paperwork-flows/helpers';

export const index = wrapHandler(
  'admin-list-paperwork-flows',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const oystehr = await getClient(input);
    // baseFlows are ensured-and-returned (3 fixed, canonical-bound); flows are service flows.
    const [flows, baseFlows] = await Promise.all([listFlowsWithServices(oystehr), listBaseFlows(oystehr)]);
    return { statusCode: 200, body: JSON.stringify({ flows, baseFlows }) };
  }
);
