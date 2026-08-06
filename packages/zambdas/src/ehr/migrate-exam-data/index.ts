import { APIGatewayProxyResult } from 'aws-lambda';
import { MigrateExamDataInput, MigrateExamDataOutput } from 'utils/lib/types/api/chart-data/chart-data.types';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { ZambdaInput } from '../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { getPatientEncounter } from '../../shared/encounter';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { runExamMigrations } from '../../shared/chart-data/migrations';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getChartData } from '../get-chart-data';

let m2mToken: string;
const ZAMBDA_NAME = 'migrate-exam-data';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { encounterId, normalExternalGenitalExamSex, secrets } = validateInput(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    // Load current chart data
    const { response: chartData } = await getChartData(oystehr, m2mToken, encounterId);
    const examObservations = chartData.examObservations ?? [];

    // Get encounter for migration version check
    const patientEncounter = await getPatientEncounter(encounterId, oystehr);
    const encounter = patientEncounter.encounter;
    if (!encounter) throw new Error(`Encounter ${encounterId} not found`);
    const patient = patientEncounter.patient;
    if (!patient) throw new Error(`Patient not found for encounter ${encounterId}`);

    // Run migration
    const migratedObservations = await runExamMigrations(
      oystehr,
      encounter,
      patient.id!,
      encounterId,
      examObservations,
      normalExternalGenitalExamSex
    );

    const response: MigrateExamDataOutput = {
      message: 'Migration complete',
      migratedCount: migratedObservations.length,
      chartData: { ...chartData, examObservations: migratedObservations },
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

function validateInput(input: ZambdaInput): MigrateExamDataInput & { secrets: ZambdaInput['secrets'] } {
  const { body, secrets } = input;
  const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
  const encounterId = parsedBody?.encounterId;
  if (!encounterId) throw new Error('encounterId is required');

  let normalExternalGenitalExamSex: 'male' | 'female' | undefined;
  const normalExternalGenitalExamSexParsed = parsedBody?.normalExternalGenitalExamSex;

  if (normalExternalGenitalExamSexParsed === 'male' || normalExternalGenitalExamSexParsed === 'female') {
    normalExternalGenitalExamSex = normalExternalGenitalExamSexParsed;
  } else if (normalExternalGenitalExamSexParsed !== undefined) {
    throw new Error('normalExternalGenitalExamSex must be either "male" or "female"');
  }

  return { encounterId, normalExternalGenitalExamSex, secrets };
}
