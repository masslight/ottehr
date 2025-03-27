import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCb);

export const cleanAppointment = async (appointmentId: string, env: string): Promise<boolean> => {
  try {
    const { stdout, stderr } = await exec(
      `tsx ../../packages/zambdas/src/scripts/delete-appointment-data.ts ${env} ${appointmentId}`
    );

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
