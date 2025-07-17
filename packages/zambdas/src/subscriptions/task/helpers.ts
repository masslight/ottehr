import { RelatedPerson, Task } from 'fhir/r4b';
import { createOystehrClient, getSecret, getSMSNumberForIndividual, Secrets, SecretsKeys, TaskStatus } from 'utils';
import { sendErrors } from '../../shared';

export const getDocReferenceIDFromFocus = (task: Task): string => {
  const ref = task.focus?.reference;
  if (!ref) {
    throw `no reference found on Task ${task.id}`;
  }
  const [resource, id] = ref.split('/');
  if (resource !== 'DocumentReference') {
    throw `no DocRef specified as focus on Task ${task.id}`;
  }
  if (!id) {
    throw `no DocRef id missing in focus on Task ${task.id}`;
  }
  return id;
};

export const sendText = async (
  message: string,
  fhirRelatedPerson: RelatedPerson,
  oystehrToken: string,
  secrets: Secrets | null
): Promise<{ taskStatus: TaskStatus; statusReason: string | undefined }> => {
  let taskStatus: TaskStatus, statusReason: string | undefined;
  const smsNumber = getSMSNumberForIndividual(fhirRelatedPerson);
  if (smsNumber) {
    console.log('sending message to', smsNumber);
    const messageRecipient = `RelatedPerson/${fhirRelatedPerson.id}`;
    const oystehr = createOystehrClient(
      oystehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );
    try {
      const result = await oystehr.transactionalSMS.send({
        message,
        resource: messageRecipient,
      });
      console.log('send SMS result', result);
      taskStatus = 'completed';
      statusReason = 'text sent successfully';
    } catch (e) {
      console.log('message send error: ', JSON.stringify(e));
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
      void sendErrors(e, ENVIRONMENT);
      taskStatus = 'failed';
      statusReason = `failed to send text to ${smsNumber}`;
    }
  } else {
    taskStatus = 'failed';
    statusReason = `could not retrieve sms number for related person ${fhirRelatedPerson.id}`;
    console.log('Could not find sms number. Skipping sending text');
  }
  return { taskStatus, statusReason };
};
