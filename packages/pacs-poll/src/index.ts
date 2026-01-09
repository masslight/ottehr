import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { readdirSync } from 'fs';
import { DateTime } from 'luxon';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  FILLER_ORDER_NUMBER_CODE_SYSTEM,
  getPatchOperationToUpdateExtension,
  PLACER_ORDER_NUMBER_CODE_SYSTEM,
  SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
} from 'utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    throw new Error(
      `Failed to fetch token for projectId ${config.projectId} with statusText: ${tokenResponse.statusText}`
    );
  }

  const tokenData = await tokenResponse.json();
  const token = tokenData.access_token;

  return new Oystehr({
    accessToken: token,
  });
};

interface ProjectConfig {
  projectId: string;
  clientId: string;
  clientSecret: string;
  advapacsTenant: string;
}

const pathToEnvFiles = path.resolve(__dirname, '../.env');

const loadProjectConfigurations = async (): Promise<ProjectConfig[]> => {
  // Load all JSON files from .env, parse them, and return ProjectConfig array
  const projectConfigs: ProjectConfig[] = [];
  const envFiles = readdirSync(pathToEnvFiles);

  for (const file of envFiles) {
    if (file.endsWith('.env.json')) {
      const configPath = path.resolve(pathToEnvFiles, file);
      const configUrl = pathToFileURL(configPath).href;
      const configModule = await import(configUrl, { with: { type: 'json' } });
      const config = configModule.default;
      if (!config.projectId || !config.clientId || !config.clientSecret || !config.advapacsTenant) {
        console.error('Invalid config in file: ', file);
        // TODO: We don't want to let one bum config file break the whole thing. But we do want this to be a noisy error.
        continue;
      }
      projectConfigs.push(config);
    }
  }

  return projectConfigs;
};

const findServiceRequestsToSend = async (oystehr: Oystehr): Promise<ServiceRequest[]> => {
  // 1. Fetch ServiceRequests that need to be sent to teleradiology

  const twoWeeksAgo = DateTime.now().minus({ weeks: 2 });
  const serviceRequests = (
    await oystehr.fhir.search<ServiceRequest>({
      resourceType: 'ServiceRequest',
      params: [
        { name: 'status', value: 'completed' },
        {
          name: 'authored',
          value: `ge${twoWeeksAgo.toISODate()}`,
        },
      ],
    })
  ).unbundle();

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

const sendWithMirth = async (serviceRequests: ServiceRequest[], advapacsTenant: string): Promise<ServiceRequest[]> => {
  const serviceRequestsSentWithMirth: ServiceRequest[] = [];
  for (const sr of serviceRequests) {
    try {
      console.log(`Sending ServiceRequest ${sr.id} to teleradiology via Mirth...`);
      const fillerOrderNumber = sr.identifier?.find((id) => id.system === FILLER_ORDER_NUMBER_CODE_SYSTEM)?.value;
      if (!fillerOrderNumber) {
        console.error(`ServiceRequest ${sr.id} is missing filler order number, skipping.`);
        continue;
      }
      const placerOrderNumber = sr.identifier?.find((id) => id.system === PLACER_ORDER_NUMBER_CODE_SYSTEM)?.value;
      if (!placerOrderNumber) {
        console.error(`ServiceRequest ${sr.id} is missing placer order number, skipping.`);
        continue;
      }

      const mirthResponse = await fetch(`http://localhost:8989/`, {
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

      if (mirthResponse.ok) {
        serviceRequestsSentWithMirth.push(sr);
      } else {
        console.error(
          `Failed to send ServiceRequest ${sr.id} via Mirth with status ${mirthResponse.status}: ${mirthResponse.statusText}`
        );
      }
    } catch (error) {
      console.error(`Failed to send ServiceRequest ${sr.id}:`, error);
    }
  }
  return serviceRequestsSentWithMirth;
};

const patchServiceRequests = async (serviceRequests: ServiceRequest[], oystehr: Oystehr): Promise<void> => {
  for (const sr of serviceRequests) {
    const hasBeenSentOperation = getPatchOperationToUpdateExtension(sr, {
      url: SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
      valueDateTime: DateTime.now().toISO(),
    });
    if (hasBeenSentOperation) {
      await oystehr.fhir.patch({
        resourceType: 'ServiceRequest',
        id: sr.id as string,
        operations: [hasBeenSentOperation],
      });
      console.log(`Patched ServiceRequest ${sr.id} as sent to teleradiology.`);
    }
  }
};

const sendStudiesToTeleradiology = async (config: ProjectConfig): Promise<void> => {
  const oystehr = await createOystehrClientFromConfig(config);
  const serviceRequestsToSend = await findServiceRequestsToSend(oystehr);
  if (serviceRequestsToSend.length === 0) {
    console.log(`No ServiceRequests to send to teleradiology for project ${config.projectId}`);
    return;
  }
  const serviceRequestsToPatchAsSent = await sendWithMirth(serviceRequestsToSend, config.advapacsTenant);
  await patchServiceRequests(serviceRequestsToPatchAsSent, oystehr);
};

const main = async (): Promise<void> => {
  console.log('Starting PACS Poll Teleradiology Sender at ', new Date().toISOString());
  const projectConfigs = await loadProjectConfigurations();
  for await (const config of projectConfigs) {
    console.log(`Processing projectId ${config.projectId} and tenant ${config.advapacsTenant}`);
    console.time('Processing time');
    await sendStudiesToTeleradiology(config);
    console.timeEnd('Processing time');
    console.log('Finished processing projectId:', config.projectId);
  }
  console.log('Finished PACS Poll Teleradiology Sender at ', new Date().toISOString());
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
