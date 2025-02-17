import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import fs from 'fs';
import { Secrets } from 'zambda-utils';
import { getAuth0Token } from '../src/shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

const clearTasks = async (config: any): Promise<void> => {
  console.log('getting access token');
  let token: string;
  try {
    token = await getAuth0Token(config as Secrets);
  } catch (e) {
    console.log('error getting token', JSON.stringify(e));
    throw e;
  }

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
  });

  let searchResults: Task[] = [];
  try {
    searchResults = (
      await oystehr.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          {
            name: 'status:not',
            value: 'complete',
          },
          { name: 'identifier', value: 'OTTEHR_SMS_Migration|,OTTEHR_Messaging_Migration|' },
        ],
      })
    ).unbundle();
  } catch (e) {
    console.log('error getting search results', e);
  }
  console.log(`found ${searchResults.length} task to delete`);
  const idsToDelete = searchResults
    .map((task) => {
      return task.id;
    })
    .filter((id) => !!id) as string[];
  await batchDelete(idsToDelete, oystehr);
  console.log(`successfully deleted ${idsToDelete.length} tasks`);
};

// So we can use await
const main = async (): Promise<void> => {
  const env = process.argv[2];

  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  await clearTasks(secrets);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});

const batchDelete = async (idsToDelete: string[], oystehr: Oystehr): Promise<void> => {
  try {
    const requests: BatchInputDeleteRequest[] = idsToDelete.map((id) => {
      return {
        method: 'DELETE',
        url: `/Task/${id}`,
      };
    });
    await oystehr.fhir.transaction({ requests });
  } catch (e) {
    console.log('error getting search results', JSON.stringify(e));
    throw e;
  }
};
