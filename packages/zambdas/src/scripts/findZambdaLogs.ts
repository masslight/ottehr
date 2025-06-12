import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from 'zambdas/src/scripts/helpers';
import { getAuth0Token } from '../shared';
import Oystehr from '@oystehr/sdk';
import fetch from 'node-fetch';

interface ZambdaLogsSearchParams {
  filter?: string;
  start?: number;
  end?: number;
  nextToken?: string;
}

interface ZambdaLogEvent {
  message: string;
  timeStamp: number;
  ingestionTime: number;
}

interface ZambdaLogResponse {
  events: ZambdaLogEvent[];
  nextToken?: string;
}

async function getZambdaLogsWithFilters(
  params: ZambdaLogsSearchParams,
  zambdaId: string,
  token: string,
  config: any
): Promise<ZambdaLogResponse> {
  const response = await fetch(`${config.PROJECT_API}/zambda/${zambdaId}/logStream/search`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const res = await response.json();
    throw new Error(`HTTP status: ${response.status}, error: ${res}, ${JSON.stringify(res)}`);
  }

  if (response.body) {
    const data = await response.json();
    return data?.output ? data.output : data;
  }
  throw new Error('Error while fetching Zambda logs, nothing found.');
}

async function startSearchingForLogs(config: any): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });

  const searchPattern = '2c3a9d58-a6e1-44c5-bba1-8bec339bc299';

  const allZambdas = await oystehr.zambda.list();
  // console.log('allZambdas', JSON.stringify(allZambdas.map((zambda) => zambda.id)));

  for (const zambda of allZambdas) {
    console.log(`Current zambda: ${zambda.name}, id: ${zambda.id}`);
    const logs = await getZambdaLogsWithFilters({ filter: searchPattern }, zambda.id, token, config);
    console.log('logs', JSON.stringify(logs));
  }
}

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(startSearchingForLogs);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
