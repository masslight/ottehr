import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FEATURE_FLAGS_CONFIG, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import {
  getOrCreateOutreachConfig,
  NotificationsTimeRestriction,
  parseNotificationsTimeRestriction,
} from '../../../rcm/scheduled-outreach-config/helpers';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { dedupeOutreachTasks } from './dedupe-outreach-tasks';

const OUTREACH_TASK_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/outreach-task`;

let m2mToken: string;

const ZAMBDA_NAME = 'cron-outreach-task-promoter';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw new Error('Secrets are not defined');

  if (!FEATURE_FLAGS_CONFIG.automatedPatientOutreachEnabled) {
    console.log(`${ZAMBDA_NAME}: automatedPatientOutreachEnabled is disabled, skipping`);
    return { statusCode: 200, body: JSON.stringify({ promoted: 0, blocked: 0, total: 0, disabled: true }) };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);

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

  // Deduplicate tasks that share the same logical identity (focus + action + birthday-year).
  // Concurrent producers can race the existence check and create more than one draft Task for
  // the same event. Collapsing them here — the single serial path that promotes draft → requested —
  // guarantees only one notification ever fires, regardless of how many drafts exist.
  const { tasksToProcess, tasksToCancel } = dedupeOutreachTasks(tasks);

  let cancelled = 0;
  for (const { task, reason } of tasksToCancel) {
    try {
      await oystehr.fhir.patch<Task>({
        resourceType: 'Task',
        id: task.id!,
        operations: [
          { op: 'replace', path: '/status', value: 'cancelled' },
          { op: 'add', path: '/statusReason', value: { text: reason } },
        ],
      });
      cancelled++;
      console.log(`${ZAMBDA_NAME}: Cancelled duplicate Task/${task.id} — ${reason}`);
    } catch (err) {
      console.error(`${ZAMBDA_NAME}: Failed to cancel duplicate Task/${task.id}:`, err);
    }
  }

  let promoted = 0;
  let blocked = 0;

  for (const task of tasksToProcess) {
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

    // Stagger promotions with a randomized delay to avoid thundering-herd on executors
    if (promoted > 0) {
      const delayMs = Math.floor(Math.random() * 1250) + 250; // 250–1500ms
      await new Promise((resolve) => setTimeout(resolve, delayMs));
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
    body: JSON.stringify({ promoted, blocked, cancelled, total: tasks.length }),
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
