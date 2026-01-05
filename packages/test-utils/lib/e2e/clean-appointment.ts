import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { Appointment } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM } from 'utils';

const exec = promisify(execCb);
let totalResourceCleanupTime = 0;
export const cleanAppointment = async (appointmentId: string, env: string): Promise<boolean> => {
  try {
    console.time(`cleanAppointment-${appointmentId}`);
    const startTime = DateTime.now();
    const { stdout, stderr } = await exec(
      `tsx ../../packages/zambdas/src/scripts/delete-appointment-data.ts ${env} ${appointmentId}`
    );

    console.timeEnd(`cleanAppointment-${appointmentId}`);
    const endTime = DateTime.now();
    const elapsedTime = endTime.diff(startTime, 'seconds').seconds;
    totalResourceCleanupTime += elapsedTime;
    console.log('total elapsed cleanup time:', totalResourceCleanupTime, 'seconds');

    if (stdout) {
      console.log('STDOUT:', stdout);
      return true;
    }

    if (stderr) {
      console.error('STDERR:', stderr);
    }

    return false;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const addProcessIdMetaTagToAppointment = (appointment: Appointment, processId: string): Appointment => {
  const existingMeta = appointment.meta || { tag: [] };
  const existingTags = existingMeta.tag ?? [];
  return {
    ...appointment,
    meta: {
      ...existingMeta,
      tag: [
        ...existingTags,
        {
          system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
          code: processId,
        },
      ],
    },
  };
};
