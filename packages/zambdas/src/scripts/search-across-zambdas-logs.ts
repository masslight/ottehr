import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from 'zambdas/src/scripts/helpers';
import { getAuth0Token } from '../shared';
import Oystehr from '@oystehr/sdk';
import fetch from 'node-fetch';
import fs from 'fs';

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
  logEvents: ZambdaLogEvent[];
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

async function recursiveSearchInZambda(
  params: ZambdaLogsSearchParams,
  zambdaId: string,
  token: string,
  config: any,
  maxDepth?: number
): Promise<ZambdaLogEvent[]> {
  const recursiveLoop = async (
    nextToken: string,
    logsAccumulator: ZambdaLogEvent[],
    depth: number
  ): Promise<{ logs: ZambdaLogEvent[]; depth: number }> => {
    if (maxDepth && depth > maxDepth) return { logs: logsAccumulator, depth };
    const logs = await getZambdaLogsWithFilters({ ...params, nextToken }, zambdaId, token, config);
    logsAccumulator = logsAccumulator.concat(logs.logEvents);
    if (logs.nextToken) return await recursiveLoop(logs.nextToken, logsAccumulator, ++depth);
    return { logs: logsAccumulator, depth };
  };

  const initialLogs = await getZambdaLogsWithFilters(params, zambdaId, token, config);
  if (initialLogs.nextToken) {
    const algoResult = await recursiveLoop(initialLogs.nextToken, initialLogs.logEvents, 0);
    console.log(`Logs events found: ${algoResult.logs.length}, depth reached: ${algoResult.depth}`);
    return algoResult.logs;
  }
  return initialLogs.logEvents;
}

async function startSearchingForLogs(config: any): Promise<void> {
  const dir = 'zambdasLogs';
  const searchPattern = '17ff8799';
  const maxDepth = 50;

  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });

  const allZambdas = await oystehr.zambda.list();

  for (const zambda of allZambdas) {
    console.log(`Current zambda: ${zambda.name}, id: ${zambda.id}`);
    try {
      const logs = await recursiveSearchInZambda({ filter: searchPattern }, zambda.id, token, config, maxDepth);
      console.log(`${logs.length <= 0 ? '❌' : '✅'} logs: ${logs.length}`);
      if (logs.length > 0) fs.writeFileSync(`${dir}/${zambda.name}.json`, JSON.stringify(logs, null, 2));
    } catch (e) {
      console.log(JSON.stringify(e));
    }
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
