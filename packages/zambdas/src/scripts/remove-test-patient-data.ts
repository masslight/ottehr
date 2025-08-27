import { FhirSearchParams } from '@oystehr/sdk';
import { exec as execCb } from 'child_process';
import { Appointment, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { promisify } from 'util';
import { deletePatientData } from './delete-patient-data';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';

const exec = promisify(execCb);

const CUT_OFF_DAYS = 30;
const RECENT_APT_PATIENTS_PER_RUN = 100;

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

async function removePatientsWithoutRecentAppointments(config: any): Promise<void> {
  const oystehr = await createOystehrClientFromConfig(config);

  const hasMorePatients = true;
  let offset = 0;
  let totalNumDeletedPatients = 0;
  let totalNumDeletedOtherResources = 0;

  const cutOffDate = DateTime.now().minus({ days: CUT_OFF_DAYS });

  while (hasMorePatients) {
    const fhirSearchParams: FhirSearchParams<Patient> = {
      resourceType: 'Patient',
      params: [
        {
          name: '_sort',
          value: '_lastUpdated',
        },
        {
          name: '_count',
          value: `${RECENT_APT_PATIENTS_PER_RUN}`,
        },
        {
          name: '_offset',
          value: offset,
        },
      ],
    };

    let patients: Patient[] = [];
    try {
      patients = (await oystehr.fhir.search(fhirSearchParams)).unbundle();
    } catch (error: unknown) {
      console.log(`Error fetching patients: ${error}`, JSON.stringify(error));
      console.log('ALERT:assuming token expiry, quitting script');
      break;
    }
    console.log('offset:', offset, 'patients found:', patients.length);

    let numDeletedPatients = 0;

    console.group('deleting patients without recent appointments');
    // forEach doesn't respect await https://sentry.io/answers/are-there-any-issues-with-using-async-await-with-foreach-loops-in-javascript/
    for (const patient of patients) {
      try {
        // patient without id won't exist since we're fetching from fhir
        if (!patient.id) return;
        const { patients: hasDeletedPatient, otherResources } = await deletePatientData(
          oystehr,
          patient.id,
          cutOffDate
        );
        numDeletedPatients += hasDeletedPatient;
        totalNumDeletedOtherResources += otherResources;
      } catch (error: unknown) {
        console.error('Error:', error);
        console.log('patient id', patient.id);
      }
    }
    console.groupEnd();
    console.debug('deleting patients without recent appointments completed, deleted', numDeletedPatients, 'patients');

    offset += RECENT_APT_PATIENTS_PER_RUN - numDeletedPatients;
    totalNumDeletedPatients += numDeletedPatients;

    if (patients.length === 0) break;
  }

  console.log('deleted', totalNumDeletedPatients, 'patients, skipped', offset, 'patients');
  console.log('deleted', totalNumDeletedOtherResources, 'other resources');
}

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(deleteTestPatientsData);
  // await performEffectWithEnvFile(removeOldAppointments);
  await performEffectWithEnvFile(removePatientsWithoutRecentAppointments);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
