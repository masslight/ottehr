import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition, Appointment, Encounter, Patient } from 'fhir/r4b';
import { getPatchBinary, getPatchOperationForNewMetaTag, getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { sendSmsForPatient } from '../../shared/communication';
import {
  ADMIN_CONFIG_TAG_CODE,
  ADMIN_CONFIG_TAG_SYSTEM,
  ENABLED_AT_EXTENSION_URL,
  LAST_PROCESSED_EXTENSION_URL,
  VISIT_FEEDBACK_SENT_TAG_CODE,
  VISIT_FEEDBACK_SENT_TAG_SYSTEM,
} from '../../shared/visit-feedback-constants';

const ZAMBDA_NAME = 'send-visit-feedback';
const BATCH_SIZE = 50;
const ATTENDER_CODE = 'ATND';

let m2mToken: string;

interface FeedbackConfig {
  enabled: boolean;
  messageTemplate: string;
  delayHours: number;
  enabledAt: string | undefined;
  lastProcessed: string | undefined;
  resourceId: string | undefined;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createOystehrClient(m2mToken, input.secrets);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);

    const config = await loadConfig(oystehr);

    if (!config.enabled || !config.messageTemplate.trim() || !config.enabledAt) {
      console.log('Visit feedback is disabled or not configured, skipping');
      return { statusCode: 200, body: JSON.stringify({ message: 'Skipped — not enabled' }) };
    }

    const windowStart = config.lastProcessed ?? config.enabledAt;
    const now = new Date();
    const windowEnd = new Date(now.getTime() - config.delayHours * 60 * 60 * 1000).toISOString();

    if (windowStart >= windowEnd) {
      console.log('No new window to process');
      return { statusCode: 200, body: JSON.stringify({ message: 'No new discharges in window' }) };
    }

    console.log(`Processing discharges between ${windowStart} and ${windowEnd}`);

    const encounters = await findDischargedEncounters(oystehr, windowStart, windowEnd);
    console.log(`Found ${encounters.length} encounters to process`);

    let sentCount = 0;
    for (const encounter of encounters.slice(0, BATCH_SIZE)) {
      try {
        const appointmentRef = encounter.appointment?.[0]?.reference;
        if (!appointmentRef) {
          console.warn(`Encounter ${encounter.id} has no appointment reference, skipping`);
          continue;
        }

        const appointment = await oystehr.fhir.get<Appointment>({
          resourceType: 'Appointment',
          id: appointmentRef.replace('Appointment/', ''),
        });

        // Check if already sent
        if (
          appointment.meta?.tag?.some(
            (t) => t.system === VISIT_FEEDBACK_SENT_TAG_SYSTEM && t.code === VISIT_FEEDBACK_SENT_TAG_CODE
          )
        ) {
          console.log(`Appointment ${appointment.id} already tagged, skipping`);
          continue;
        }

        const patientRef = encounter.subject?.reference;
        if (!patientRef) {
          console.warn(`Encounter ${encounter.id} has no patient reference, skipping`);
          continue;
        }

        const patient = await oystehr.fhir.get<Patient>({
          resourceType: 'Patient',
          id: patientRef.replace('Patient/', ''),
        });

        await sendSmsForPatient(config.messageTemplate, oystehr, patient, ENVIRONMENT);

        // Tag appointment as sent
        await oystehr.fhir.transaction({
          requests: [
            getPatchBinary({
              resourceId: appointment.id!,
              resourceType: 'Appointment',
              patchOperations: [
                getPatchOperationForNewMetaTag(appointment, {
                  system: VISIT_FEEDBACK_SENT_TAG_SYSTEM,
                  code: VISIT_FEEDBACK_SENT_TAG_CODE,
                }),
              ],
            }),
          ],
        });

        sentCount++;
        console.log(`Sent feedback SMS for encounter ${encounter.id}, patient ${patient.id}`);
      } catch (error) {
        console.error(`Failed to process encounter ${encounter.id}:`, error);
      }
    }

    // Advance cursor
    await updateCursor(oystehr, config.resourceId!, windowEnd);
    console.log(`Processed ${sentCount} feedback messages, cursor advanced to ${windowEnd}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Sent ${sentCount} feedback messages` }),
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
    return {
      enabled: false,
      messageTemplate: '',
      delayHours: 24,
      enabledAt: undefined,
      lastProcessed: undefined,
      resourceId: undefined,
    };
  }

  const ad = results[0];
  return {
    enabled: ad.status === 'active',
    messageTemplate: ad.description ?? '',
    delayHours: ad.timingDuration?.value ?? 24,
    enabledAt: ad.extension?.find((e) => e.url === ENABLED_AT_EXTENSION_URL)?.valueDateTime,
    lastProcessed: ad.extension?.find((e) => e.url === LAST_PROCESSED_EXTENSION_URL)?.valueDateTime,
    resourceId: ad.id,
  };
}

async function findDischargedEncounters(
  oystehr: Oystehr,
  windowStart: string,
  windowEnd: string
): Promise<Encounter[]> {
  // Search for encounters with attender participant whose period.end falls in the window
  // The attender's period.end is the discharge timestamp
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

  // Filter to only encounters where the attender participant has period.end set (discharged)
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

async function updateCursor(oystehr: Oystehr, configId: string, cursor: string): Promise<void> {
  const config = await oystehr.fhir.get<ActivityDefinition>({
    resourceType: 'ActivityDefinition',
    id: configId,
  });

  const extensions = (config.extension ?? []).filter((e) => e.url !== LAST_PROCESSED_EXTENSION_URL);
  extensions.push({ url: LAST_PROCESSED_EXTENSION_URL, valueDateTime: cursor });
  config.extension = extensions;

  await oystehr.fhir.update<ActivityDefinition>(config);
}
