import Oystehr from '@oystehr/sdk';
import { Communication, Extension } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { Secrets } from 'utils';
import { getPostGridLetter, PostGridLetterStatus } from './postgrid';

const MAIL_VENDOR_EXTENSION_URL = 'https://extensions.fhir.ottehr.com/mail-vendor';
const POSTGRID_GET_RATE_LIMIT_DELAY_MS = 1_250; // ~48 req/min, safely under 50/min limit

export interface SyncMailedStatementStatusesResult {
  total: number;
  updated: number;
  alreadyTerminal: number;
  errors: { communicationId: string; error: string }[];
}

function mapPostGridStatusToFhirStatus(pgStatus: PostGridLetterStatus): Communication['status'] {
  switch (pgStatus) {
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'stopped';
    default:
      return 'in-progress';
  }
}

function getExtensionValue(extensions: Extension[] | undefined, url: string): string | undefined {
  return extensions?.find((ext) => ext.url === url)?.valueString;
}

function buildUpdatedMailVendorExtension(
  existingExtension: Extension,
  updates: {
    status: string;
    url?: string;
    mailingClass?: string;
    pageCount?: number;
    envelopeType?: string;
    syncedAt: string;
  }
): Extension {
  const subExtensions = [...(existingExtension.extension ?? [])];

  const upsert = (extUrl: string, value: string | undefined): void => {
    if (value === undefined) return;
    const idx = subExtensions.findIndex((e) => e.url === extUrl);
    if (idx >= 0) {
      subExtensions[idx] = { url: extUrl, valueString: value };
    } else {
      subExtensions.push({ url: extUrl, valueString: value });
    }
  };

  upsert('vendor-letter-status', updates.status);
  upsert('vendor-letter-url', updates.url);
  upsert('vendor-mailing-class', updates.mailingClass);
  upsert('vendor-page-count', updates.pageCount?.toString());
  upsert('vendor-envelope-type', updates.envelopeType);
  upsert('vendor-status-synced-at', updates.syncedAt);

  return {
    ...existingExtension,
    extension: subExtensions,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncMailedStatementStatuses(
  oystehr: Oystehr,
  secrets: Secrets
): Promise<SyncMailedStatementStatusesResult> {
  const result: SyncMailedStatementStatusesResult = {
    total: 0,
    updated: 0,
    alreadyTerminal: 0,
    errors: [],
  };

  // Fetch all in-progress mailed statement Communications
  let allCommunications: Communication[] = [];
  let offset = 0;
  const pageSize = 200;

  let searchBundle = await oystehr.fhir.search<Communication>({
    resourceType: 'Communication',
    params: [
      { name: 'medium', value: 'MAILWRIT' },
      { name: 'status', value: 'in-progress' },
      { name: '_count', value: pageSize.toString() },
      { name: '_offset', value: offset.toString() },
    ],
  });

  let pageCommunications = searchBundle.unbundle();
  allCommunications = allCommunications.concat(pageCommunications);

  let pageCount = 1;
  while (searchBundle.link?.find((link) => link.relation === 'next')) {
    offset += pageSize;
    pageCount++;

    searchBundle = await oystehr.fhir.search<Communication>({
      resourceType: 'Communication',
      params: [
        { name: 'medium', value: 'MAILWRIT' },
        { name: 'status', value: 'in-progress' },
        { name: '_count', value: pageSize.toString() },
        { name: '_offset', value: offset.toString() },
      ],
    });

    pageCommunications = searchBundle.unbundle();
    allCommunications = allCommunications.concat(pageCommunications);

    if (pageCount > 50) {
      console.warn('Reached maximum pagination limit (50 pages). Stopping search.');
      break;
    }
  }

  result.total = allCommunications.length;
  console.log(`Found ${result.total} in-progress mailed statement Communications to sync`);

  for (const comm of allCommunications) {
    const commId = comm.id;
    if (!commId) continue;

    try {
      const mailVendorExt = comm.extension?.find((ext) => ext.url === MAIL_VENDOR_EXTENSION_URL);
      if (!mailVendorExt) {
        result.errors.push({ communicationId: commId, error: 'No mail-vendor extension found' });
        continue;
      }

      const letterId = getExtensionValue(mailVendorExt.extension, 'vendor-letter-id');
      if (!letterId) {
        result.errors.push({ communicationId: commId, error: 'No vendor-letter-id found' });
        continue;
      }

      const currentStatus = getExtensionValue(mailVendorExt.extension, 'vendor-letter-status');
      if (currentStatus === 'completed' || currentStatus === 'cancelled') {
        result.alreadyTerminal++;
        continue;
      }

      // Rate-limit: delay between PostGrid API calls
      await delay(POSTGRID_GET_RATE_LIMIT_DELAY_MS);

      const postGridLetter = await getPostGridLetter(letterId, secrets);

      const updatedMailVendorExt = buildUpdatedMailVendorExtension(mailVendorExt, {
        status: postGridLetter.status,
        url: postGridLetter.url,
        mailingClass: postGridLetter.mailingClass,
        pageCount: postGridLetter.pageCount,
        envelopeType: postGridLetter.envelopeType,
        syncedAt: DateTime.now().toUTC().toISO() ?? '',
      });

      const newFhirStatus = mapPostGridStatusToFhirStatus(postGridLetter.status);

      // Build the updated extensions array
      const updatedExtensions = (comm.extension ?? []).map((ext) =>
        ext.url === MAIL_VENDOR_EXTENSION_URL ? updatedMailVendorExt : ext
      );

      await oystehr.fhir.update<Communication>({
        resourceType: 'Communication',
        id: commId,
        ...comm,
        status: newFhirStatus,
        extension: updatedExtensions,
      });

      result.updated++;
      console.log(
        `Updated Communication/${commId}: ${currentStatus ?? 'unknown'} → ${
          postGridLetter.status
        } (FHIR: ${newFhirStatus})`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error syncing Communication/${commId}:`, message);
      result.errors.push({ communicationId: commId, error: message });
    }
  }

  console.log(
    `Sync complete: ${result.updated} updated, ${result.alreadyTerminal} already terminal, ${result.errors.length} errors out of ${result.total} total`
  );

  return result;
}
