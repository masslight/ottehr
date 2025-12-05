import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { readdirSync } from 'fs';
import { DateTime } from 'luxon';
import path from 'path';
import {
  getPatchOperationToUpdateExtension,
  SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
} from 'utils';

const createOystehrClientFromConfig = async (config: ProjectConfig): Promise<any> => {
  const tokenResponse = await fetch('https://oystehr.auth0.com/oauth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      audience: 'https://api.oystehr.com/',
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
}

const loadProjectConfigurations = async (): Promise<ProjectConfig[]> => {
  // Load all JSON files from .env, parse them, and return ProjectConfig array
  const projectConfigs: ProjectConfig[] = [];
  const envFiles = readdirSync(path.resolve(__dirname, '.env'));

  for (const file of envFiles) {
    if (file.endsWith('.env.json')) {
      const configPath = path.resolve(__dirname, `.env/${file}`);
      const config = await import(configPath);
      if (!config.projectId || !config.clientId || !config.clientSecret) {
        console.error('Invalid config in file: ', file);
        // TODO: We don't want to let one bum config file break the whole thing. But we do want this to be a noisy error.
        continue;
      }
      projectConfigs.push(config);
    }
  }

  return projectConfigs;
};

const findServiceRequestsToSend = async (oystehr: any): Promise<any[]> => {
  // 1. Fetch ServiceRequests that need to be sent to teleradiology

  const twoWeeksAgo = DateTime.now().minus({ weeks: 2 });
  const serviceRequests = await oystehr.fhir.search({
    resourceType: 'ServiceRequest',
    params: [
      { name: 'status', value: 'completed' },
      {
        name: 'authored',
        value: `ge${twoWeeksAgo.toISODate()}`,
      },
    ],
  });

  const serviceRequestsToSend: ServiceRequest[] = [];
  for (const sr of serviceRequests.entry || []) {
    const serviceRequest = sr.resource as ServiceRequest;
    const existingExtensions = serviceRequest.extension || [];
    const needsToBeSent = existingExtensions.some(
      (ext) => ext.url === SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL
    );
    const hasBeenSent = existingExtensions.some(
      (ext) => ext.url === SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL
    );

    if (needsToBeSent && !hasBeenSent) {
      serviceRequestsToSend.push(serviceRequest);
    }
  }

  return serviceRequests;
};

const _sendWithMirth = async (serviceRequests: ServiceRequest[]): Promise<ServiceRequest[]> => {
  const serviceRequestsSentWithMirth: ServiceRequest[] = [];
  for (const sr of serviceRequests) {
    try {
      console.log(`Sending ServiceRequest ${sr.id} to teleradiology via Mirth...`);
      // TODO
      const _mirthResponse = await fetch('localhost::8080/mirth-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessionNumber: sr.identifier,
        }),
      });

      // TODO If successful, add to the list to patch as 'sent'
      serviceRequestsSentWithMirth.push(sr);
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
  // const serviceRequestsToPatchAsSent = await sendWithMirth(serviceRequestsToSend);
  // await patchServiceRequests(serviceRequestsToPatchAsSent, oystehr);
  // TODO for testing just patch any SRs that are passed in without making a mirth call
  await patchServiceRequests(serviceRequestsToSend, oystehr);
};

const main = async (): Promise<void> => {
  const projectConfigs = await loadProjectConfigurations();
  for await (const config of projectConfigs) {
    console.log('Processing projectId:', config.projectId);
    console.time('Processing time');
    await sendStudiesToTeleradiology(config);
    console.timeEnd('Processing time');
    console.log('Finished processing projectId:', config.projectId);
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
