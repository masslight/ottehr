import { FhirSearchParams } from '@oystehr/sdk';
import { exec as execCb } from 'child_process';
import { Appointment, Patient } from 'fhir/r4b';
import { promisify } from 'util';
import { deletePatientData } from './delete-patient-data';
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

async function removePatientsWithoutAppointments(config: any): Promise<void> {
  const oystehr = await createOystehrClientFromConfig(config);

  const hasMorePatients = true;
  let offset = 0;

  while (hasMorePatients) {
    const fhirSearchParams: FhirSearchParams<Patient | Appointment> = {
      resourceType: 'Patient',
      params: [
        {
          name: '_revinclude',
          value: 'Appointment:patient',
        },
        {
          name: '_count',
          value: '100',
        },
        {
          name: '_offset',
          value: offset,
        },
      ],
    };

    const resources = (await oystehr.fhir.search<Patient | Appointment>(fhirSearchParams)).unbundle();
    const patients = resources.filter((resource) => resource.resourceType === 'Patient') as Patient[];
    console.log('offset:', offset, 'patients found:', patients.length);

    let numDeletedPatients = 0;

    console.group('deleting patients without appointments');
    await Promise.all(
      patients.map(async (patient) => {
        try {
          // patient without id won't exist since we're fetching from fhir
          if (!patient.id) return;
          const hasDeletedPatient = await deletePatientData(oystehr, patient.id);
          numDeletedPatients += hasDeletedPatient;
        } catch (error) {
          console.error('Error:', error);
        }
      })
    );
    console.groupEnd();
    console.debug('deleted patients without appointments');

    offset += 100 - numDeletedPatients;

    if (patients.length === 0) break;
  }
}

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(deleteTestPatientsData);
  // await performEffectWithEnvFile(removeOldAppointments);
  await performEffectWithEnvFile(removePatientsWithoutAppointments);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
