import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import {
  getOrCreateOutreachConfig,
  NotificationsTimeRestriction,
  parseNotificationsTimeRestriction,
} from '../../scheduled-outreach-config/helpers';

const OUTREACH_TASK_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/outreach-task`;

let m2mToken: string;

const ZAMBDA_NAME = 'cron-outreach-task-promoter';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw new Error('Secrets are not defined');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  // Load SMS time restriction from PlanDefinition
  const planDefinition = await getOrCreateOutreachConfig(oystehr);
  const notificationsRestriction = parseNotificationsTimeRestriction(planDefinition);

  // Find all draft tasks that are now due
  const now = DateTime.now().toISO()!;
  const draftTasks = await oystehr.fhir.search<Task>({
    resourceType: 'Task',
    params: [
      { name: '_tag', value: `${OUTREACH_TASK_TAG_SYSTEM}|` },
      { name: 'status', value: 'draft,requested' },
      { name: 'period', value: `le${now}` },
      { name: '_count', value: '100' },
    ],
  });

  const tasks = draftTasks.unbundle();
  console.log(`${ZAMBDA_NAME}: Found ${tasks.length} draft/requested outreach tasks due for promotion`);

  let promoted = 0;
  let blocked = 0;

  for (const task of tasks) {
    // Check if the task involves SMS and the window is currently closed
    if (taskUsesSms(task) && !isWithinNotificationsWindow(notificationsRestriction)) {
      console.log(`Task ${task.id} blocked by SMS time window`);
      blocked++;
      continue;
    }

    // Already requested — nothing to do
    if (task.status === 'requested') {
      continue;
    }

    // Promote: draft → requested
    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [{ op: 'replace', path: '/status', value: 'requested' }],
    });
    promoted++;
  }

  console.log(`${ZAMBDA_NAME}: Promoted ${promoted} tasks, blocked ${blocked} by SMS window`);

  return {
    statusCode: 200,
    body: JSON.stringify({ promoted, blocked, total: tasks.length }),
  };
});

/**
 * Check if a task's mediums include SMS.
 */
function taskUsesSms(task: Task): boolean {
  const mediumsInput = task.input?.find((i) => i.type?.text === 'mediums');
  if (mediumsInput?.valueString?.includes('sms')) return true;

  // For charge-card tasks, check the nested config
  const chargeCardInput = task.input?.find((i) => i.type?.text === 'charge-card-config');
  if (chargeCardInput?.valueString) {
    try {
      const cfg = JSON.parse(chargeCardInput.valueString);
      if (cfg.onSuccess?.mediums?.includes('sms') || cfg.onFailure?.mediums?.includes('sms')) return true;
    } catch {
      // ignore parse errors
    }
  }

  return false;
}

/**
 * Check if the current time falls within the allowed SMS sending window.
 */
function isWithinNotificationsWindow(restriction: NotificationsTimeRestriction): boolean {
  if (!restriction.enabled) return true;

  const now = DateTime.now().setZone(restriction.timezone);
  const currentTime = now.toFormat('HH:mm');

  return currentTime >= restriction.windowStart && currentTime <= restriction.windowEnd;
}
