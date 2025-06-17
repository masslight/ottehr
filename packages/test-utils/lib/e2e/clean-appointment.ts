import { DateTime } from 'luxon';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

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
