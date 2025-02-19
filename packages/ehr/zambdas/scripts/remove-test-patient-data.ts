import { Appointment, Patient } from 'fhir/r4b';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { performEffectWithEnvFile } from 'zambda-utils';
import { createOystehrClientFromConfig } from './helpers';

const exec = promisify(execCb);

const deleteTestPatientsData = async (config: any): Promise<void> => {
  const env = process.argv[3];

  const oystehr = await createOystehrClientFromConfig(config);

  const fhirSearchParams = {
    resourceType: 'Patient',
    params: [
      {
        name: 'name',
        value: 'TM-User',
      },
      {
        name: '_revinclude',
        value: 'Appointment:patient',
      },
    ],
  };

  const resources = (await oystehr.fhir.search<Patient | Appointment>(fhirSearchParams)).unbundle();
  const appointments = resources.filter((resource) => resource.resourceType === 'Appointment') as Appointment[];
  console.log(appointments);

  appointments.forEach(async (appt) => {
    const { stdout, stderr } = await exec(
      `tsx ../../../packages/ehr/zambdas/scripts/delete-appointment-data.ts ${env} ${appt.id}`
    );

    if (stdout) {
      console.log('STDOUT:', stdout);
      return true;
    }

    if (stderr) {
      console.error('STDERR:', stderr);
    }

    return false;
  });
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile('intake', deleteTestPatientsData);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
