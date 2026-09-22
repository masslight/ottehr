import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { getOutboundDeliveryChannel } from 'utils/lib/fhir/outbound-delivery';
import {
  PATIENT_ACTION_LOG_VIEWER_ROLES,
  RevokeActionLogInputValidated,
  RevokeActionLogOutput,
} from 'utils/lib/types/api/action-logs.types';
import { checkOrCreateM2MClientToken, requireUserWithRole } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'revoke-action-log';
let m2mToken = '';
/** A resend chain is never deep; this only guards against a malformed `partOf` loop. */
const MAX_CHAIN_SIZE = 50;

/**
 * Revokes an emailed document link: the attempt and every later attempt in its resend chain are cancelled, which
 * makes `open-document-link` refuse them and stops an expired one from re-sending.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parameters = validateRequestParameters(input);
  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const user = await requireUserWithRole(userToken, parameters.secrets, PATIENT_ACTION_LOG_VIEWER_ROLES);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, parameters.secrets);

  const output = await performEffect(parameters, oystehr, user);
  return { statusCode: 200, body: JSON.stringify(output) };
});

export async function performEffect(
  parameters: RevokeActionLogInputValidated,
  oystehr: Oystehr,
  user: User
): Promise<RevokeActionLogOutput> {
  const original = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: parameters.attemptId });
  if (getOutboundDeliveryChannel(original) !== 'email') throw new Error('Only emailed document links can be revoked');

  // The recipient may hold a later link than the one shown in the log, so the whole chain goes.
  const chain = await collectResendChain(oystehr, original);
  const statusReason = { text: `Revoked by ${user.name || user.email || user.id}` };
  await Promise.all(
    chain.map((task) =>
      oystehr.fhir.patch<Task>({
        resourceType: 'Task',
        id: task.id!,
        operations: [
          { op: 'replace', path: '/status', value: 'cancelled' },
          { op: 'add', path: '/statusReason', value: statusReason },
        ],
      })
    )
  );
  return { attemptId: parameters.attemptId, revokedCount: chain.length };
}

/** The attempt and every descendant linked to it through `partOf`, oldest first. */
async function collectResendChain(oystehr: Oystehr, start: Task): Promise<Task[]> {
  const chain: Task[] = [start];
  for (let index = 0; index < chain.length && chain.length < MAX_CHAIN_SIZE; index++) {
    const children = (
      await oystehr.fhir.search<Task>({
        resourceType: 'Task',
        params: [{ name: 'part-of', value: `Task/${chain[index].id}` }],
      })
    )
      .unbundle()
      .filter((resource) => resource.resourceType === 'Task' && !chain.some((seen) => seen.id === resource.id));
    chain.push(...children);
  }
  return chain;
}
