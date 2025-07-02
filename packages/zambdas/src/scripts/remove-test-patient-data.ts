import { FhirSearchParams } from '@oystehr/sdk';
import { exec as execCb } from 'child_process';
import { Appointment, Patient } from 'fhir/r4b';
import { promisify } from 'util';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';

const exec = promisify(execCb);

const deleteTestPatientsData = async (config: any): Promise<void> => {
  const env = config.env;

  const oystehr = await createOystehrClientFromConfig(config);

  let hasMoreAppointments = true;

  while (hasMoreAppointments) {
    const fhirSearchParams: FhirSearchParams<Patient | Appointment> = {
      resourceType: 'Patient',
      params: [
        {
          name: 'name',
          value: 'Test_Doe_Random,TA_User,TM_User,Test_first_name',
        },
        {
          name: '_revinclude',
          value: 'Appointment:patient',
        },
        {
          name: '_count',
          value: '25',
        },
      ],
    };

    const resources = (await oystehr.fhir.search<Patient | Appointment>(fhirSearchParams)).unbundle();
    const appointments = resources.filter((resource) => resource.resourceType === 'Appointment') as Appointment[];
    console.log(appointments);

    if (appointments.length === 0) {
      hasMoreAppointments = false;
      continue;
    }

    await Promise.all(
      appointments.map(async (appt) => {
        try {
          const { stdout, stderr } = await exec(`tsx ./src/scripts/delete-appointment-data.ts ${env} ${appt.id}`);

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
      })
    );
  }
};

// async function removeOldAppointments(config: any): Promise<void> {
//   const env = config.env;

//   const oystehr = await createOystehrClientFromConfig(config);

//   let hasMoreAppointments = true;

//   while (hasMoreAppointments) {
//     const fhirSearchParams = {
//       resourceType: 'Appointment',
//       params: [
//         {
//           name: 'date',
//           value: `lt${DateTime.now().minus({ days: 10 }).toUTC().toISO()}`,
//         },
//         {
//           name: '_include',
//           value: 'Appointment:patient',
//         },
//         {
//           name: '_count',
//           value: '50',
//         },
//       ],
//     };

//     const resources = (await oystehr.fhir.search<Patient | Appointment>(fhirSearchParams)).unbundle();
//     const appointments = resources.filter((resource) => resource.resourceType === 'Appointment') as Appointment[];
//     console.log(appointments);

//     if (appointments.length === 0) {
//       hasMoreAppointments = false;
//       continue;
//     }

//     await Promise.all(
//       appointments.map(async (appt) => {
//         try {
//           const { stdout, stderr } = await exec(`tsx ./src/scripts/delete-appointment-data.ts ${env} ${appt.id}`);

//           if (stdout) {
//             console.log('STDOUT:', stdout);
//             return true;
//           }

//           if (stderr) {
//             console.error('STDERR:', stderr);
//           }

//           return false;
//         } catch (error) {
//           console.error('Error:', error);
//           return false;
//         }
//       })
//     );
//   }
// }

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(deleteTestPatientsData);
  // await performEffectWithEnvFile(removeOldAppointments);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
