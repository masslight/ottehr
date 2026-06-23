import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';

// Singleton Basic resource that records the state of the most recent mailed-statement
// status-sync cron run. There is at most one of these per project; it is upserted by the
// cron and read by the mailed-statements report.
export const MAILED_STATEMENT_SYNC_STATE_SYSTEM = 'https://fhir.ottehr.com/mailed-statement-sync/state';
export const MAILED_STATEMENT_SYNC_STATE_CODE = 'cron-state';

const LAST_RUN_AT_URL = 'https://fhir.ottehr.com/mailed-statement-sync/last-run-at';
const LAST_RUN_UPDATED_URL = 'https://fhir.ottehr.com/mailed-statement-sync/last-run-updated-count';
const LAST_RUN_ERRORS_URL = 'https://fhir.ottehr.com/mailed-statement-sync/last-run-error-count';

export interface MailedStatementSyncState {
  lastRunAt: string | null;
  updatedCount: number | null;
  errorCount: number | null;
}

const EMPTY_STATE: MailedStatementSyncState = {
  lastRunAt: null,
  updatedCount: null,
  errorCount: null,
};

function getExtensionDateTime(basic: Basic, url: string): string | null {
  return basic.extension?.find((e) => e.url === url)?.valueDateTime ?? null;
}

function getExtensionInteger(basic: Basic, url: string): number | null {
  return basic.extension?.find((e) => e.url === url)?.valueInteger ?? null;
}

function parseState(basic: Basic | undefined): MailedStatementSyncState {
  if (!basic) return EMPTY_STATE;
  return {
    lastRunAt: getExtensionDateTime(basic, LAST_RUN_AT_URL),
    updatedCount: getExtensionInteger(basic, LAST_RUN_UPDATED_URL),
    errorCount: getExtensionInteger(basic, LAST_RUN_ERRORS_URL),
  };
}

async function findSyncStateBasic(oystehr: Oystehr): Promise<Basic | undefined> {
  const bundle = await oystehr.fhir.search<Basic>({
    resourceType: 'Basic',
    params: [
      { name: 'code', value: `${MAILED_STATEMENT_SYNC_STATE_SYSTEM}|${MAILED_STATEMENT_SYNC_STATE_CODE}` },
      { name: '_count', value: '1' },
    ],
  });
  const results = bundle.unbundle();
  if (results.length > 1) {
    const ids = results.map((r) => r.id).join(', ');
    console.warn(
      `Found ${results.length} mailed-statement sync-state Basic resources (expected 1). Using the first. IDs: ${ids}`
    );
  }
  return results[0];
}

/**
 * Read the persisted state of the most recent mailed-statement status-sync cron run.
 * Returns an empty state (all nulls) if the cron has never recorded a run.
 */
export async function getMailedStatementSyncState(oystehr: Oystehr): Promise<MailedStatementSyncState> {
  const existing = await findSyncStateBasic(oystehr);
  return parseState(existing);
}

/**
 * Upsert the singleton Basic resource that records the latest mailed-statement status-sync run.
 */
export async function recordMailedStatementSyncRun(
  oystehr: Oystehr,
  run: { ranAt: string; updatedCount: number; errorCount: number }
): Promise<void> {
  const extension = [
    { url: LAST_RUN_AT_URL, valueDateTime: run.ranAt },
    { url: LAST_RUN_UPDATED_URL, valueInteger: run.updatedCount },
    { url: LAST_RUN_ERRORS_URL, valueInteger: run.errorCount },
  ];

  const existing = await findSyncStateBasic(oystehr);

  if (existing?.id) {
    await oystehr.fhir.update<Basic>({
      ...existing,
      resourceType: 'Basic',
      id: existing.id,
      extension,
    });
    return;
  }

  await oystehr.fhir.create<Basic>({
    resourceType: 'Basic',
    code: {
      coding: [{ system: MAILED_STATEMENT_SYNC_STATE_SYSTEM, code: MAILED_STATEMENT_SYNC_STATE_CODE }],
      text: 'Mailed statement status sync cron state',
    },
    extension,
  });
}
