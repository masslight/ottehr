import Oystehr from '@oystehr/sdk';
import { getRelatedPersonForPatient } from './patients';
import { Patient } from 'fhir/r4b';

export async function sendSms(message: string, resourceReference: string, oystehr: Oystehr): Promise<void> {
  try {
    const commid = await oystehr.transactionalSMS.send({
      message,
      resource: resourceReference,
    });
    console.log('message send res: ', commid);
  } catch (e) {
    console.log('message send error: ', JSON.stringify(e));
  }
}

export async function sendSmsForPatient(
  message: string,
  oystehr: Oystehr,
  patient: Patient | undefined
): Promise<void> {
  if (!patient) {
    console.error("Message didn't send because no patient was found for encounter");
    return;
  }
  const relatedPerson = await getRelatedPersonForPatient(patient.id!, oystehr);
  if (!relatedPerson) {
    console.error("Message didn't send because no related person was found for this patient, patientId: " + patient.id);
    return;
  }
  const recepient = `RelatedPerson/${relatedPerson.id}`;
  await sendSms(message, recepient, oystehr);
}
