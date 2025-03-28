import { Appointment, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';

const exec = promisify(execCb);

const deleteTestPatientsData = async (config: any): Promise<void> => {
  const env = process.argv[3];

  const oystehr = await createOystehrClientFromConfig(config);

  const fhirSearchParams = {
    resourceType: 'Patient',
    params: [
      {
        name: 'name',
        value: 'Test_Doe_Random,TA_User,TM_User',
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

  await Promise.all(appointments.map(async (appt) => {
    try {
      const { stdout, stderr } = await exec(
        `tsx ./src/scripts/delete-appointment-data.ts ${env} ${appt.id}`
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
      console.error('Error:', error);
      return false;
    }
  }));
};

async function removeOldAppointments(config: any): Promise<void> {
  const env = process.argv[3];

  const oystehr = await createOystehrClientFromConfig(config);

  let hasMoreAppointments = true;

  while (hasMoreAppointments) {
    const fhirSearchParams = {
      resourceType: 'Appointment',
      params: [
        {
          name: 'date',
          value: `lt${DateTime.now().minus({ days: 10 }).toUTC().toISO()}`,
        },
        {
          name: '_include',
          value: 'Appointment:patient',
        },
        {
          name: '_count',
          value: '50',
        }
      ],
    };


    const resources = (await oystehr.fhir.search<Patient | Appointment>(fhirSearchParams)).unbundle();
    const appointments = resources.filter((resource) => resource.resourceType === 'Appointment') as Appointment[];
    console.log(appointments);

    if (appointments.length === 0) {
      hasMoreAppointments = false;
      continue;
    }

    await Promise.all(appointments.map(async (appt) => {
      try {
        const { stdout, stderr } = await exec(
          `tsx ./src/scripts/delete-appointment-data.ts ${env} ${appt.id}`
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
        console.error('Error:', error);
        return false;
      }
    }));
  }
}

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(deleteTestPatientsData);
  await performEffectWithEnvFile(removeOldAppointments);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
