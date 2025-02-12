import { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import fs from 'fs';
import { getAuth0Token } from '../src/shared';
import { createOystehrClient } from '../src/shared/helpers';

const writeQuestionnaires = async (envConfig: any, env: string): Promise<void> => {
  const token = await getAuth0Token(envConfig);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }
  const oystehrClient = createOystehrClient(token, envConfig);
  try {
    const folder = fs.readdirSync('../../utils/lib/deployed-resources/questionnaires');
    const requests = await Promise.all(
      folder.flatMap(async (file) => {
        const questionnaireData = JSON.parse(
          fs.readFileSync(`../../utils/lib/deployed-resources/questionnaires/${file}`, 'utf8')
        );
        const { resource: questionnaire } = questionnaireData;

        const existingQuestionnaire = (
          await oystehrClient.fhir.search<Questionnaire>({
            resourceType: 'Questionnaire',
            params: [
              {
                name: 'url',
                value: questionnaire.url,
              },
              {
                name: 'version',
                value: questionnaire.version,
              },
            ],
          })
        ).unbundle();

        if (!existingQuestionnaire.length) {
          const createRequest: BatchInputPostRequest<Questionnaire> = {
            method: 'POST',
            url: '/Questionnaire',
            resource: questionnaire,
          };
          return createRequest;
        } else {
          console.log('existing Questionnaire id: ', existingQuestionnaire[0].id);
          const existing = existingQuestionnaire.find(
            (eq: Questionnaire) => eq.url === questionnaire.url && eq.version === questionnaire.version
          );
          if (!existing) {
            throw new Error('Questionnaire missing unexpectedly');
          }
          const updateRequest: BatchInputPutRequest<Questionnaire> = {
            method: 'PUT',
            url: `/Questionnaire/${existing.id}`,
            resource: {
              ...questionnaire,
              id: existing.id,
            },
          };
          return updateRequest;
        }
      })
    );
    await oystehrClient.fhir.transaction({ requests: requests.flatMap((r) => r) });

    const newSecrets: any = {};
    folder.forEach((file) => {
      const questionnaireData = JSON.parse(
        fs.readFileSync(`../../utils/lib/deployed-resources/questionnaires/${file}`, 'utf8')
      );
      const { resource: questionnaire, envVarName } = questionnaireData;
      if (envVarName && questionnaire?.url && questionnaire?.version) {
        const canonical = `${questionnaire.url}|${questionnaire.version}`;
        newSecrets[envVarName] = canonical;
      }
    });

    const newLocalEnv = { ...envConfig, ...newSecrets };
    const envString = JSON.stringify(newLocalEnv, null, 2);
    fs.writeFileSync(`.env/${env}.json`, envString);

    for await (const entry of Object.entries(newSecrets)) {
      const [key, value] = entry;
      if (typeof value !== 'string') {
        throw 'A secret value was unexpectedly not a string.';
      }
      console.log(`Updating secret ${key}...`);
      await oystehrClient.secret.set({
        name: key,
        value: value,
      });
      console.log(`Create/update secret ${key} succeeded`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (e) {
    console.log('questionnaire set up failed: ', e);
  }
};

// So we can use await
const main = async (): Promise<void> => {
  const env = process.argv[2];

  const envConfig = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  await writeQuestionnaires(envConfig, env);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
