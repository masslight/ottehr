import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Patient, Questionnaire, QuestionnaireResponse, Task } from 'fhir/r4b';
import { getCanonicalQuestionnaire, TASK_INPUT_TYPE_CODES, TASK_INPUT_TYPE_SYSTEM } from 'utils';
import { wrapTaskHandler } from '../helpers';
import { executePageHarvest, HarvestContext } from './page-handlers';

export const index = wrapTaskHandler('sub-harvest-paperwork-page', async (input, oystehr) => {
  const { task } = input;

  const patchIndex = extractPatchIndex(task);
  const qrId = extractQrId(task);

  console.log(`harvesting page at index ${patchIndex} for QuestionnaireResponse/${qrId}`);

  const { qr, patient, encounter, appointment, location } = await fetchResources(qrId, oystehr);

  const pageLinkId = qr.item?.[patchIndex]?.linkId;
  if (!pageLinkId) {
    return { taskStatus: 'failed' as const, statusReason: `no page found at index ${patchIndex} on QR ${qrId}` };
  }

  console.log(`page linkId resolved: ${pageLinkId}`);

  const questionnaire = await fetchQuestionnaire(qr, oystehr);

  const { secrets } = input;
  const ctx: HarvestContext = {
    qr,
    pageLinkId,
    patient,
    encounter,
    appointment,
    location,
    questionnaire,
    oystehr,
    secrets,
  };

  const result = await executePageHarvest(ctx);
  console.log(`harvest result: ${result}`);

  return { taskStatus: 'completed' as const, statusReason: result };
});

export function extractPatchIndex(task: Task): number {
  const input = task.input?.find(
    (i) =>
      i.type?.coding?.some((c) => c.system === TASK_INPUT_TYPE_SYSTEM && c.code === TASK_INPUT_TYPE_CODES.PAGE_INDEX)
  );
  if (input?.valueUnsignedInt === undefined) {
    throw new Error('Task is missing page-index input');
  }
  return input.valueUnsignedInt;
}

export function extractQrId(task: Task): string {
  const ref = task.focus?.reference;
  if (!ref?.startsWith('QuestionnaireResponse/')) {
    throw new Error(`Task focus is not a QuestionnaireResponse: ${ref}`);
  }
  return ref.replace('QuestionnaireResponse/', '');
}

async function fetchResources(
  qrId: string,
  oystehr: Oystehr
): Promise<{
  qr: QuestionnaireResponse;
  patient: Patient;
  encounter: Encounter;
  appointment: Appointment;
  location: Location | undefined;
}> {
  const resources = (
    await oystehr.fhir.search<QuestionnaireResponse | Encounter | Patient | Appointment | Location>({
      resourceType: 'QuestionnaireResponse',
      params: [
        { name: '_id', value: qrId },
        { name: '_include', value: 'QuestionnaireResponse:encounter' },
        { name: '_include:iterate', value: 'Encounter:appointment' },
        { name: '_include:iterate', value: 'Appointment:patient' },
        { name: '_include:iterate', value: 'Appointment:location' },
      ],
    })
  ).unbundle();

  const qr = resources.find((r): r is QuestionnaireResponse => r.resourceType === 'QuestionnaireResponse');
  const encounter = resources.find((r): r is Encounter => r.resourceType === 'Encounter');
  const patient = resources.find((r): r is Patient => r.resourceType === 'Patient');
  const appointment = resources.find((r): r is Appointment => r.resourceType === 'Appointment');
  const location = resources.find((r): r is Location => r.resourceType === 'Location');

  if (!qr?.id) throw new Error(`QuestionnaireResponse ${qrId} not found`);
  if (!encounter?.id) throw new Error('Encounter not found');
  if (!patient?.id) throw new Error('Patient not found');
  if (!appointment?.id) throw new Error('Appointment not found');

  return { qr, patient, encounter, appointment, location };
}

async function fetchQuestionnaire(qr: QuestionnaireResponse, oystehr: Oystehr): Promise<Questionnaire | undefined> {
  if (!qr.questionnaire) return undefined;
  const parts = qr.questionnaire.split('|');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return undefined;
  try {
    return await getCanonicalQuestionnaire({ url: parts[0], version: parts[1] }, oystehr);
  } catch (error) {
    console.warn(`Failed to fetch questionnaire ${qr.questionnaire}:`, error);
    return undefined;
  }
}
