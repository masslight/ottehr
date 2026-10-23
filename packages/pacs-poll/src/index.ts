import http from 'node:http';
import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { readdirSync } from 'fs';
import { DateTime } from 'luxon';
import path from 'path';
import { Counter, Gauge, Registry } from 'prom-client';
import { fileURLToPath, pathToFileURL } from 'url';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import {
  FILLER_ORDER_NUMBER_CODE_SYSTEM,
  PLACER_ORDER_NUMBER_CODE_SYSTEM,
  SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
} from 'utils/lib/fhir/radiology';
import { getPatchOperationToUpdateExtension } from 'utils/lib/fhir/resourcePatch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Prometheus metrics ──────────────────────────────────────────────

const register = new Registry();

const pollTimestamp = new Gauge({
  name: 'pacs_poll_last_run_timestamp_seconds',
  help: 'Unix timestamp of the last completed poll cycle',
  registers: [register],
});

const pollDuration = new Gauge({
  name: 'pacs_poll_run_duration_seconds',
  help: 'Duration of the last poll cycle per project',
  labelNames: ['project_id'] as const,
  registers: [register],
});

const serviceRequestsFound = new Counter({
  name: 'pacs_poll_service_requests_found_total',
  help: 'Total ServiceRequests found needing teleradiology send',
  labelNames: ['project_id'] as const,
  registers: [register],
});

const serviceRequestsSent = new Counter({
  name: 'pacs_poll_service_requests_sent_total',
  help: 'Total ServiceRequests successfully sent via Mirth',
  labelNames: ['project_id'] as const,
  registers: [register],
});

const errorsTotal = new Counter({
  name: 'pacs_poll_errors_total',
  help: 'Total errors across all types — filter by type and project_id labels',
  labelNames: ['type', 'project_id'] as const,
  registers: [register],
});

// ── Core logic (unchanged from cron version) ────────────────────────

const createOystehrClientFromConfig = async (config: ProjectConfig): Promise<any> => {
  const tokenResponse = await fetch('https://auth.zapehr.com/oauth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      audience: 'https://api.zapehr.com',
    }),
  });

  if (!tokenResponse.ok) {
    errorsTotal.inc({ type: 'auth', project_id: config.projectId });
    throw new Error(
      `Failed to fetch token for projectId ${config.projectId} with statusText: ${tokenResponse.statusText}`
    );
  }

  const tokenData = await tokenResponse.json();
  const token = tokenData.access_token;

  return new Oystehr({
    accessToken: token,
    ignoreTags: [BILLING_RESOURCE_TAG],
  });
};

interface ProjectConfig {
  projectId: string;
  clientId: string;
  clientSecret: string;
  advapacsTenant: string;
}

const pathToEnvFiles = path.resolve(__dirname, '.env');

const loadProjectConfigurations = async (): Promise<ProjectConfig[]> => {
  const projectConfigs: ProjectConfig[] = [];
  const envFiles = readdirSync(pathToEnvFiles);

  for (const file of envFiles) {
    if (file.endsWith('.env.json')) {
      try {
        const configPath = path.resolve(pathToEnvFiles, file);
        const configUrl = pathToFileURL(configPath).href;
        const configModule = await import(configUrl, { with: { type: 'json' } });
        const config = configModule.default;
        if (!config.projectId || !config.clientId || !config.clientSecret || !config.advapacsTenant) {
          console.error('Invalid config in file: ', file);
          errorsTotal.inc({ type: 'config', project_id: 'unknown' });
          continue;
        }
        projectConfigs.push(config);
      } catch (error) {
        console.error(`Error loading config file ${file}:`, error);
        errorsTotal.inc({ type: 'config', project_id: 'unknown' });
      }
    }
  }

  return projectConfigs;
};

const SEARCH_PAGE_SIZE = 50;

const findServiceRequestsToSend = async (oystehr: Oystehr): Promise<ServiceRequest[]> => {
  const twoWeeksAgo = DateTime.now().minus({ weeks: 2 });
  const baseParams = [
    { name: 'status', value: 'completed' },
    { name: 'authored', value: `ge${twoWeeksAgo.toISODate()}` },
    { name: '_count', value: SEARCH_PAGE_SIZE.toString() },
    { name: '_sort', value: '_id' },
    {
      name: '_tag',
      value: 'https://fhir.ottehr.com/CodeSystem/order-type-tag|radiology',
    },
  ];

  let offset = 0;
  const serviceRequests: ServiceRequest[] = [];

  let searchBundle = await oystehr.fhir.search<ServiceRequest>({
    resourceType: 'ServiceRequest',
    params: [...baseParams, { name: '_offset', value: offset.toString() }],
  });
  serviceRequests.push(...searchBundle.unbundle());

  while (searchBundle.link?.find((l) => l.relation === 'next')) {
    offset += SEARCH_PAGE_SIZE;
    searchBundle = await oystehr.fhir.search<ServiceRequest>({
      resourceType: 'ServiceRequest',
      params: [...baseParams, { name: '_offset', value: offset.toString() }],
    });
    serviceRequests.push(...searchBundle.unbundle());
  }

  const serviceRequestsToSend: ServiceRequest[] = [];
  for (const sr of serviceRequests) {
    const existingExtensions = sr.extension || [];
    const needsToBeSent = existingExtensions.some(
      (ext) => ext.url === SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL
    );
    const hasBeenSent = existingExtensions.some(
      (ext) => ext.url === SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL
    );

    if (needsToBeSent && !hasBeenSent) {
      serviceRequestsToSend.push(sr);
    }
  }

  return serviceRequestsToSend;
};

const sendAndPatchServiceRequest = async (
  sr: ServiceRequest,
  advapacsTenant: string,
  oystehr: Oystehr,
  projectId: string
): Promise<boolean> => {
  const fillerOrderNumber = sr.identifier?.find((id) => id.system === FILLER_ORDER_NUMBER_CODE_SYSTEM)?.value;
  if (!fillerOrderNumber) {
    console.error(`ServiceRequest ${sr.id} is missing filler order number, skipping.`);
    errorsTotal.inc({ type: 'mirth', project_id: projectId });
    return false;
  }
  const placerOrderNumber = sr.identifier?.find((id) => id.system === PLACER_ORDER_NUMBER_CODE_SYSTEM)?.value;
  if (!placerOrderNumber) {
    console.error(`ServiceRequest ${sr.id} is missing placer order number, skipping.`);
    errorsTotal.inc({ type: 'mirth', project_id: projectId });
    return false;
  }

  console.log(`Sending ServiceRequest ${sr.id} to teleradiology via Mirth...`);
  let mirthResponse: Response;
  try {
    mirthResponse = await fetch(`http://localhost:8989/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fillerOrderNumber,
        placerOrderNumber,
        advapacsTenant,
      }),
    });
  } catch (error) {
    console.error(`Failed to send ServiceRequest ${sr.id}:`, error);
    errorsTotal.inc({ type: 'mirth', project_id: projectId });
    return false;
  }

  if (!mirthResponse.ok) {
    console.error(
      `Failed to send ServiceRequest ${sr.id} via Mirth with status ${mirthResponse.status}: ${mirthResponse.statusText}`
    );
    errorsTotal.inc({ type: 'mirth', project_id: projectId });
    return false;
  }

  const hasBeenSentOperation = getPatchOperationToUpdateExtension(sr, {
    url: SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
    valueDateTime: DateTime.now().toISO(),
  });
  if (hasBeenSentOperation) {
    try {
      await oystehr.fhir.patch({
        resourceType: 'ServiceRequest',
        id: sr.id as string,
        operations: [hasBeenSentOperation],
      });
      console.log(`Patched ServiceRequest ${sr.id} as sent to teleradiology.`);
    } catch (error) {
      console.error(`Failed to patch ServiceRequest ${sr.id}:`, error);
      errorsTotal.inc({ type: 'patch', project_id: projectId });
    }
  }

  return true;
};

const sendStudiesToTeleradiology = async (config: ProjectConfig): Promise<void> => {
  const oystehr = await createOystehrClientFromConfig(config);
  const serviceRequestsToSend = await findServiceRequestsToSend(oystehr);

  serviceRequestsFound.inc({ project_id: config.projectId }, serviceRequestsToSend.length);

  if (serviceRequestsToSend.length === 0) {
    console.log(`No ServiceRequests to send to teleradiology for project ${config.projectId}`);
    return;
  }

  let sentCount = 0;
  for (const sr of serviceRequestsToSend) {
    const sent = await sendAndPatchServiceRequest(sr, config.advapacsTenant, oystehr, config.projectId);
    if (sent) sentCount++;
  }
  serviceRequestsSent.inc({ project_id: config.projectId }, sentCount);
};

// ── Poll loop ───────────────────────────────────────────────────────

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '60000', 10);
const METRICS_PORT = parseInt(process.env.METRICS_PORT ?? '9090', 10);

const pollOnce = async (): Promise<void> => {
  console.log('Starting poll cycle at', new Date().toISOString());
  const projectConfigs = await loadProjectConfigurations();
  for (const config of projectConfigs) {
    console.log(`Processing projectId ${config.projectId} and tenant ${config.advapacsTenant}`);
    const start = performance.now();
    try {
      await sendStudiesToTeleradiology(config);
    } catch (error) {
      console.error(`Error processing project ${config.projectId}:`, error);
      errorsTotal.inc({ type: 'poll', project_id: config.projectId });
    }
    const durationSec = (performance.now() - start) / 1000;
    pollDuration.set({ project_id: config.projectId }, durationSec);
    console.log(`Finished processing projectId ${config.projectId} in ${durationSec.toFixed(2)}s`);
  }
  pollTimestamp.setToCurrentTime();
  console.log('Finished poll cycle at', new Date().toISOString());
};

const main = async (): Promise<void> => {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } else if (req.url === '/health' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok' }));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });

  server.listen(METRICS_PORT, () => {
    console.log(`Metrics server listening on port ${METRICS_PORT}`);
  });

  let polling = false;
  const guardedPoll = async (): Promise<void> => {
    if (polling) {
      console.log('Previous poll cycle still running, skipping this tick');
      return;
    }
    polling = true;
    try {
      await pollOnce();
    } finally {
      polling = false;
    }
  };

  await guardedPoll();
  const interval = setInterval(guardedPoll, POLL_INTERVAL_MS);

  const shutdown = (): void => {
    console.log('Shutting down...');
    clearInterval(interval);
    server.close(() => {
      console.log('Metrics server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
