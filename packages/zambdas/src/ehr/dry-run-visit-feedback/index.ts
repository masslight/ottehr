import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition, Encounter, Patient } from 'fhir/r4b';
import { getRelatedPersonForPatient, getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import {
  ADMIN_CONFIG_TAG_CODE,
  ADMIN_CONFIG_TAG_SYSTEM,
  VISIT_FEEDBACK_SENT_TAG_CODE,
  VISIT_FEEDBACK_SENT_TAG_SYSTEM,
} from '../../shared/visit-feedback-constants';

const ZAMBDA_NAME = 'dry-run-visit-feedback';
const BATCH_SIZE = 50;
const ATTENDER_CODE = 'ATND';

let m2mToken: string;

interface FeedbackConfig {
  messageTemplate: string;
}

interface DryRunRow {
  firstName: string;
  lastName: string;
  preferredName: string;
  patientId: string;
  phoneNumber: string;
  encounterId: string;
  appointmentId: string;
  dischargeTime: string;
  message: string;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createOystehrClient(m2mToken, input.secrets);

    const config = await loadConfig(oystehr);
    const requestDelayHours = input.body ? JSON.parse(input.body).delayHours : undefined;
    const delayHours = typeof requestDelayHours === 'number' && requestDelayHours >= 1 ? requestDelayHours : 24;

    const messageTemplate = config.messageTemplate.trim() || '(no message template configured)';

    // Look back one window from now: windowStart = now - delayHours, windowEnd = now
    const now = new Date();
    const windowStart = new Date(now.getTime() - delayHours * 60 * 60 * 1000).toISOString();
    const windowEnd = now.toISOString();

    if (windowStart >= windowEnd) {
      return {
        statusCode: 200,
        body: JSON.stringify({ csv: '', rows: [], message: `No discharged patients in last ${delayHours} hours.` }),
      };
    }

    const encounters = await findDischargedEncounters(oystehr, windowStart, windowEnd);
    const rows: DryRunRow[] = [];

    for (const encounter of encounters.slice(0, BATCH_SIZE)) {
      try {
        const appointmentRef = encounter.appointment?.[0]?.reference;
        if (!appointmentRef) continue;

        const appointment = await oystehr.fhir.get<any>({
          resourceType: 'Appointment',
          id: appointmentRef.replace('Appointment/', ''),
        });

        // Check if already sent
        if (
          appointment.meta?.tag?.some(
            (t: any) => t.system === VISIT_FEEDBACK_SENT_TAG_SYSTEM && t.code === VISIT_FEEDBACK_SENT_TAG_CODE
          )
        ) {
          continue;
        }

        const patientRef = encounter.subject?.reference;
        if (!patientRef) continue;

        const patient = await oystehr.fhir.get<Patient>({
          resourceType: 'Patient',
          id: patientRef.replace('Patient/', ''),
        });

        const relatedPerson = await getRelatedPersonForPatient(patient.id!, oystehr);
        const phoneNumber =
          relatedPerson?.telecom?.find((t) => t.system === 'sms' || t.system === 'phone')?.value ?? 'N/A';

        const officialName = patient.name?.find((n) => n.use === 'official') ?? patient.name?.[0];
        const firstName = officialName?.given?.join(' ') ?? '';
        const lastName = officialName?.family ?? '';
        const preferredName = patient.name?.find((n) => n.use === 'nickname')?.given?.join(' ') ?? '';

        const dischargeTime =
          encounter.participant?.find((p) => p.type?.some((t) => t.coding?.some((c) => c.code === ATTENDER_CODE)))
            ?.period?.end ?? 'Unknown';

        rows.push({
          firstName,
          lastName,
          preferredName,
          patientId: patient.id!,
          phoneNumber,
          encounterId: encounter.id!,
          appointmentId: appointment.id!,
          dischargeTime,
          message: messageTemplate,
        });
      } catch (error) {
        console.error(`Failed to process encounter ${encounter.id}:`, error);
      }
    }

    // Build CSV
    const csvHeader =
      'First Name,Last Name,Preferred Name,Patient ID,Phone Number,Encounter ID,Appointment ID,Discharge Time,Message';
    const csvRows = rows.map(
      (r) =>
        `"${r.firstName}","${r.lastName}","${r.preferredName}","${r.patientId}","${r.phoneNumber}","${
          r.encounterId
        }","${r.appointmentId}","${r.dischargeTime}","${r.message.replace(/"/g, '""')}"`
    );
    const csv = [csvHeader, ...csvRows].join('\n');

    return {
      statusCode: 200,
      body: JSON.stringify({
        csv,
        rows,
        message:
          rows.length === 0
            ? `No discharged patients in last ${delayHours} hours.`
            : `Found ${rows.length} patient${rows.length !== 1 ? 's' : ''} that would receive SMS`,
        windowStart,
        windowEnd,
      }),
    };
  } catch (error: any) {
    console.error('Error:', error);
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

async function loadConfig(oystehr: Oystehr): Promise<FeedbackConfig> {
  const results = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [{ name: '_tag', value: `${ADMIN_CONFIG_TAG_SYSTEM}|${ADMIN_CONFIG_TAG_CODE}` }],
    })
  ).unbundle();

  if (results.length === 0) {
    return { messageTemplate: '' };
  }

  return { messageTemplate: results[0].description ?? '' };
}

async function findDischargedEncounters(
  oystehr: Oystehr,
  windowStart: string,
  windowEnd: string
): Promise<Encounter[]> {
  const encounters = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        { name: 'participant-type', value: ATTENDER_CODE },
        { name: 'date', value: `ge${windowStart}` },
        { name: 'date', value: `le${windowEnd}` },
        { name: 'status', value: 'in-progress,finished' },
        { name: '_count', value: String(BATCH_SIZE * 2) },
        { name: '_sort', value: 'date' },
      ],
    })
  ).unbundle();

  return encounters.filter(
    (enc) =>
      enc.participant?.some(
        (p) =>
          p.type?.some((t) => t.coding?.some((c) => c.code === ATTENDER_CODE)) &&
          p.period?.end != null &&
          p.period.end >= windowStart &&
          p.period.end <= windowEnd
      )
  );
}
