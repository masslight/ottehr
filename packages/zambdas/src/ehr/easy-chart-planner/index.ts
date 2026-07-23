import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { runEasyChartPlanner } from '../../shared/easy-chart/planner-core';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

// The planner pipeline itself lives in shared/easy-chart/planner-core so the ambient-scribe
// precompute can run it too; re-export the prompt internals for the pinned prompt tests and
// eval tooling that import them from this module.
export { buildPrompt, RESPONSE_SCHEMA, runEasyChartPlanner } from '../../shared/easy-chart/planner-core';

let m2mToken: string;

const ZAMBDA_NAME = 'easy-chart-planner';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { narrative, noteContext, chartState, encounterId, incremental, secrets } = validateRequestParameters(input);

  // Best-effort Oystehr client: the planner still produces a useful decomposition without
  // templates/patient context, and planner-core captures every degraded fetch.
  let oystehr: Oystehr | undefined;
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    oystehr = createClinicalOystehrClient(m2mToken, secrets);
  } catch (e) {
    console.warn('Planner: Oystehr client init failed, proceeding without templates/patient:', e);
    captureException(e);
  }

  const output = await runEasyChartPlanner(
    { narrative, noteContext, chartState, encounterId, incremental },
    oystehr,
    secrets
  );
  return { statusCode: 200, body: JSON.stringify(output) };
});
