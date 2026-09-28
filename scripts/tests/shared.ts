import { Location, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { CreateAppointmentResponse, createOystehrClient, ServiceMode } from 'utils';

let BASE_URL = 'http://localhost:3000/local/zambda';

/** Points every zambda call at another local server (`--url http://localhost:3010`); the default is :3000. */
export function setZambdaBaseUrl(serverUrl: string): void {
  BASE_URL = `${serverUrl.replace(/\/$/, '')}/local/zambda`;
}

export function zambdaBaseUrl(): string {
  return BASE_URL;
}
const OPEN_ZAMBDAS = new Set(['create-slot']);

export async function getToken(envConfig: Record<string, string>): Promise<string> {
  const response = await fetch(envConfig.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: envConfig.AUTH0_CLIENT,
      client_secret: envConfig.AUTH0_SECRET,
      audience: envConfig.AUTH0_AUDIENCE,
    }),
  });
  if (!response.ok) throw new Error(`Auth0 token request failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function callZambda<T>(name: string, token: string, body: object): Promise<T> {
  const endpoint = OPEN_ZAMBDAS.has(name) ? 'execute-public' : 'execute';
  const response = await fetch(`${BASE_URL}/${name}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${name} failed: ${response.status} ${await response.text()}`);
  const wrapper = (await response.json()) as { status: number; output: T };
  if (wrapper.status !== 200)
    throw new Error(`${name} returned status ${wrapper.status}: ${JSON.stringify(wrapper.output)}`);
  return wrapper.output;
}

export const TEST_PATIENT_DOB = '1990-01-01';
export const TEST_PATIENT_SEX = 'male';

export interface TestAppointmentOptions {
  /** ISO date; defaults to TEST_PATIENT_DOB. */
  dateOfBirth?: string;
  sex?: 'male' | 'female';
  firstName?: string;
  /** Book for an existing test patient instead of creating one — a second visit makes the patient "established". */
  patientId?: string;
  reasonForVisit?: string;
  /** create-appointment insists on one for a machine caller booking a new patient. */
  phoneNumber?: string;
}

export async function createTestAppointment(
  token: string,
  envConfig: Record<string, string>,
  label: string,
  options: TestAppointmentOptions = {}
): Promise<{ appointmentId: string; encounterId: string; patientId: string; resourceIds: string[] }> {
  const oystehr = createOystehrClient(token, envConfig.FHIR_API, envConfig.PROJECT_API);

  const fhirResources = (
    await oystehr.fhir.search<Location | Schedule>({
      resourceType: 'Location',
      params: [
        { name: 'status', value: 'active' },
        { name: '_count', value: '20' },
        { name: '_revinclude', value: 'Schedule:actor:Location' },
      ],
    })
  ).unbundle();

  const schedule = fhirResources.find((r) => r.resourceType === 'Schedule') as Schedule | undefined;
  if (!schedule?.id) throw new Error('No active schedule found in FHIR');

  const slot = await callZambda<Slot>('create-slot', token, {
    scheduleId: schedule.id,
    startISO: DateTime.now().toISO(),
    lengthInMinutes: 15,
    serviceModality: ServiceMode['in-person'],
    walkin: true,
    serviceCategoryCode: 'urgent-care',
  });

  const appt = await callZambda<CreateAppointmentResponse>('create-appointment', token, {
    slotId: slot.id,
    patient: {
      ...(options.patientId ? { id: options.patientId, newPatient: false } : { newPatient: true }),
      firstName: options.firstName ?? 'Test',
      lastName: label,
      dateOfBirth: options.dateOfBirth ?? TEST_PATIENT_DOB,
      sex: options.sex ?? TEST_PATIENT_SEX,
      email: `test.${label.toLowerCase()}@example.com`,
      phoneNumber: options.phoneNumber ?? '2025550123',
      reasonForVisit: options.reasonForVisit ?? 'Sore throat and fever',
    },
    language: 'en',
  });

  return {
    appointmentId: appt.appointmentId,
    encounterId: appt.encounterId,
    patientId: appt.fhirPatientId,
    resourceIds: [
      `Encounter/${appt.encounterId}`,
      `Appointment/${appt.appointmentId}`,
      `QuestionnaireResponse/${appt.questionnaireResponseId}`,
      // A second visit for the same patient shares the RelatedPerson and Patient; deleting them twice is harmless.
      `RelatedPerson/${appt.relatedPersonId}`,
      `Patient/${appt.fhirPatientId}`,
      `Slot/${slot.id}`,
    ],
  };
}

export async function deleteTestResources(
  token: string,
  envConfig: Record<string, string>,
  resourceIds: string[]
): Promise<void> {
  const oystehr = createOystehrClient(token, envConfig.FHIR_API, envConfig.PROJECT_API);
  await Promise.allSettled(
    resourceIds.map((ref) => {
      const [resourceType, id] = ref.split('/');
      return oystehr.fhir.delete({ resourceType: resourceType as any, id });
    })
  );
}

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';

export async function callGemini(
  prompt: string,
  projectId: string,
  apiKey: string,
  responseSchema?: object,
  model: string = GEMINI_MODEL
): Promise<string> {
  const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        ...(responseSchema && {
          responseMimeType: 'application/json',
          responseSchema,
        }),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini call failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
  return data.candidates[0].content.parts[0].text;
}
