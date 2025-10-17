import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';
import { getPatchBinary, ProviderTypeCode } from 'utils';
import { makeProviderTypeExtension, PROVIDER_TYPE_EXTENSION_URL, PROVIDER_TYPE_VALUES } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from './helpers';

const BATCH_SIZE = 25;

const initializeOystehr = async (config: any): Promise<Oystehr> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');

  return new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });
};

export async function getPractitionersBatch(oystehr: Oystehr, offset: number, count: number): Promise<Practitioner[]> {
  const resources = (
    await oystehr.fhir.search<Practitioner>({
      resourceType: 'Practitioner',
      params: [
        { name: '_count', value: `${count}` },
        { name: '_offset', value: `${offset}` },
      ],
    })
  ).unbundle();

  const practitioners = resources?.filter((r) => r.resourceType === 'Practitioner').map((p) => p as Practitioner) ?? [];
  return practitioners;
}

const extractSuffixFromPractitioner = (pr: Practitioner): string | undefined => {
  const names = pr.name ?? [];
  if (names.length === 0) return undefined;

  const suffixArr = names[0].suffix ?? [];
  if (suffixArr.length > 0) return suffixArr[0];

  return undefined;
};

const normalizeSuffix = (s: string): string => s.replace(/\./g, '').trim().toUpperCase();

const processPractitioners = async (practitioners: Practitioner[]): Promise<BatchInputRequest<Practitioner>[]> => {
  const patchRequests: BatchInputRequest<Practitioner>[] = [];

  for (const pr of practitioners) {
    if (!pr.id) {
      console.warn('Practitioner without id encountered, skipping.', pr);
      continue;
    }

    const rawSuffix = extractSuffixFromPractitioner(pr);
    if (!rawSuffix) {
      continue;
    }

    const normalized = normalizeSuffix(rawSuffix);

    const providerType = (PROVIDER_TYPE_VALUES as readonly string[]).includes(normalized)
      ? (normalized as ProviderTypeCode)
      : ('other' as ProviderTypeCode);

    const providerTypeText = providerType === 'other' ? rawSuffix : providerType;

    const newExtArr = makeProviderTypeExtension(providerType, providerTypeText);
    if (!newExtArr || newExtArr.length === 0) {
      console.warn(`makeProviderTypeExtension returned empty for Practitioner/${pr.id} suffix="${rawSuffix}"`);
      continue;
    }
    const newExt = newExtArr[0];

    const existingExt = (pr.extension ?? []).find((e) => e.url === PROVIDER_TYPE_EXTENSION_URL);
    if (existingExt) {
      continue;
    }

    const patchOperations: any[] = [];
    if (pr.extension && pr.extension.length > 0) {
      patchOperations.push({
        op: 'add',
        path: '/extension/-',
        value: newExt,
      });
    } else {
      patchOperations.push({
        op: 'add',
        path: '/extension',
        value: [newExt],
      });
    }

    patchRequests.push(
      getPatchBinary({
        resourceType: 'Practitioner',
        resourceId: pr.id,
        patchOperations,
      })
    );

    console.log(
      `Prepared patch to add provider-type extension for Practitioner/${pr.id} (suffix="${rawSuffix}", providerType="${providerType}")`
    );
  }

  return patchRequests;
};

const updatePractitionersProviderType = async (config: any, oystehr?: Oystehr): Promise<void> => {
  const client = oystehr || (await initializeOystehr(config));
  console.log('Starting Practitioner provider-type extension update...');

  let offset = 0;
  let batchLength = -1;
  let totalPractitioners = 0;
  let totalPatched = 0;

  while (batchLength !== 0) {
    console.log(`Fetching practitioners batch starting at offset: ${offset}`);
    const practitioners = await getPractitionersBatch(client, offset, BATCH_SIZE);

    batchLength = practitioners.length;
    totalPractitioners += batchLength;

    if (batchLength > 0) {
      console.log(`Processing ${practitioners.length} practitioners...`);
      const patchRequests = await processPractitioners(practitioners);

      totalPatched += patchRequests.length;

      if (patchRequests.length > 0) {
        console.log(`Applying ${patchRequests.length} patch requests (batch offset ${offset})...`);
        try {
          await client.fhir.batch({
            requests: patchRequests,
          });
        } catch (error) {
          console.error(`Error during practitioner batch patch at offset ${offset}:`, JSON.stringify(error));
          throw new Error(`Error during practitioner batch patch at offset ${offset}`);
        }
      }
    }

    offset += BATCH_SIZE;
  }

  console.log(`[COMPLETE] Practitioner update summary:
    - Total practitioners processed: ${totalPractitioners}
    - Total practitioners patched (extensions added): ${totalPatched}`);
};

const setupPractitionerUpdate = async (config: any): Promise<void> => {
  await updatePractitionersProviderType(config);
};

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(setupPractitionerUpdate);
  } catch (e) {
    console.log('Catch some error while running practitioner update: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
