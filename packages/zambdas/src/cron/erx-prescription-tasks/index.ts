import { APIGatewayProxyResult } from 'aws-lambda';
import { DateTime } from 'luxon';
import { ERX_MEDICATION_META_TAG_CODE } from 'utils/lib/fhir/constants';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { completeSettledPrescriptionTasks, createPrescriptionTasks } from '../../shared/erx-prescription-tasks';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';

let m2mToken: string;

const ZAMBDA_NAME = 'erx-prescription-tasks-cron';

// How far back the hourly run looks for prescriptions still Sending or stopped
const LOOKBACK_DAYS = 30;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const now = DateTime.now();
  // No-confirmation tasks for prescriptions still Sending after 24 hours, and error tasks the subscription missed.
  // The written date (authoredOn) is only a date, so the 24 hours count from when it was sent.
  const created = await createPrescriptionTasks(
    oystehr,
    [
      { name: 'status', value: 'draft,stopped' },
      { name: '_tag', value: ERX_MEDICATION_META_TAG_CODE },
      { name: 'authoredon', value: `ge${now.minus({ days: LOOKBACK_DAYS }).toISODate()}` },
    ],
    now
  );
  const completed = await completeSettledPrescriptionTasks(oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify({
      createdTaskIds: created.map((task) => task.id),
      completedTaskIds: completed.map((task) => task.id),
    }),
  };
});
