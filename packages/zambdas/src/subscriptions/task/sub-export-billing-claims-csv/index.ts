import Oystehr, { FhirResourceReturnValue } from '@oystehr/sdk';
import { Claim, Resource, Task, TaskOutput } from 'fhir/r4b';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { toCsv } from 'utils/lib/helpers/csv';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { EXPORT_CSV_OUTPUT_URL_CODE, EXPORT_TASK_SYSTEM } from 'utils/lib/types/api/invoicing.types';
import {
  EXPORT_CLAIMS_INCOMPLETE_CODE,
  EXPORT_CLAIMS_MATCH_LIMIT,
} from 'utils/lib/types/data/billing/billing.constants';
import { ExportBillingClaimsInput } from 'utils/lib/types/data/billing/billing.schemas';
import { CLAIM_EXPORT_HEADERS, claimExportRow } from '../../../billing/claim-export-csv';
import {
  buildClaimFilterParams,
  CLAIM_LIST_INCLUDE_PARAMS,
  claimMatchesServiceDateRange,
  enrichAndMapClaims,
  fetchClaimsPageByIds,
  searchClaimsBySearchText,
} from '../../../billing/claim-search';
import { createBillingClient } from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { wrapTaskHandler } from '../helpers';
import { ExportBillingClaimsCsvParams, validateRequestParameters } from './validateRequestParameters';

export const EXPORT_PAGE_SIZE = 100;

let m2mToken: string;
const ZAMBDA_NAME = 'sub-export-billing-claims-csv';

export const index = wrapTaskHandler(ZAMBDA_NAME, async (input, _oystehr) => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect(oystehr, params);
  console.groupEnd();
  console.debug('performEffect success', response);

  return response;
});

async function performEffect(
  oystehr: Oystehr,
  params: ExportBillingClaimsCsvParams
): Promise<{ taskStatus: Task['status']; statusReason: string }> {
  const { taskId, secrets, ...filters } = params;
  const { rows, incomplete } = await buildRows(oystehr, filters);

  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const projectApi = getSecret(SecretsKeys.PROJECT_API, secrets);
  const bucketName = `${projectId}-${BUCKET_NAMES.BILLING_CLAIM_EXPORTS}`;
  const objectPath = `billing-claims-export-${taskId}.csv`;

  await oystehr.z3.uploadFile({
    bucketName,
    'objectPath+': objectPath,
    file: new Blob([toCsv(CLAIM_EXPORT_HEADERS, rows)], { type: 'text/csv' }),
  });

  await oystehr.fhir.patch({
    resourceType: 'Task',
    id: taskId,
    operations: [
      {
        op: 'add',
        path: '/output',
        value: [
          taskOutput(EXPORT_CSV_OUTPUT_URL_CODE, `${projectApi}/z3/${bucketName}/${objectPath}`),
          taskOutput(EXPORT_CLAIMS_INCOMPLETE_CODE, String(incomplete)),
        ],
      },
    ],
  });

  return {
    taskStatus: 'completed',
    statusReason: `Exported ${rows.length} claim(s)`,
  };
}

export interface ClaimExportRows {
  rows: string[][];
  incomplete: boolean;
}

async function buildRows(oystehr: Oystehr, filters: ExportBillingClaimsInput): Promise<ClaimExportRows> {
  const filterParams = await buildClaimFilterParams({
    oystehr,
    params: filters,
    // Only the offset-paged branch below needs a sort an edit can't shift mid-export. The search
    // text clauses truncate at a match limit, so they keep the list's order to take the newest.
    sort: filters.searchText ? undefined : '_id',
  });
  if (!filterParams) {
    return {
      rows: [],
      incomplete: false,
    };
  }

  const filteringByServiceDate = Boolean(filters.serviceDateFrom || filters.serviceDateTo);
  const rows: string[][] = [];
  const exported = new Set<string>();

  const addPage = async (claims: Claim[], includedResources: Resource[]): Promise<void> => {
    const fresh = claims.filter(
      (claim): claim is FhirResourceReturnValue<Claim> => !!claim.id && !exported.has(claim.id)
    );
    if (fresh.length === 0) return;
    fresh.forEach((claim) => exported.add(claim.id));
    const items = await enrichAndMapClaims({
      oystehr,
      claims: fresh,
      includedResources,
    });
    rows.push(...items.map(claimExportRow));
  };

  const truncated = (): ClaimExportRows => {
    console.warn(`Export hit the ${EXPORT_CLAIMS_MATCH_LIMIT} row limit, so the CSV is partial`);
    return {
      rows: rows.slice(0, EXPORT_CLAIMS_MATCH_LIMIT),
      incomplete: true,
    };
  };

  if (filters.searchText) {
    const matched = await searchClaimsBySearchText({
      oystehr,
      searchText: filters.searchText,
      filterParams,
      withServiceDateElements: filteringByServiceDate,
    });
    const matching = filteringByServiceDate
      ? matched.claims.filter((claim) =>
          claimMatchesServiceDateRange(claim, filters.serviceDateFrom, filters.serviceDateTo)
        )
      : matched.claims;
    const claimIds = matching.map((claim) => claim.id).filter(Boolean) as string[];
    const withinLimit = claimIds.slice(0, EXPORT_CLAIMS_MATCH_LIMIT);

    for (let start = 0; start < withinLimit.length; start += EXPORT_PAGE_SIZE) {
      const page = await fetchClaimsPageByIds({
        oystehr,
        claimIds: withinLimit.slice(start, start + EXPORT_PAGE_SIZE),
      });
      await addPage(page.claims, page.includedResources);
    }

    if (withinLimit.length < claimIds.length) return truncated();

    return {
      rows,
      incomplete: matched.incomplete,
    };
  }

  let offset = 0;
  let total = 0;
  do {
    const bundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        ...CLAIM_LIST_INCLUDE_PARAMS,
        ...filterParams,
        {
          name: '_count',
          value: String(EXPORT_PAGE_SIZE),
        },
        {
          name: '_offset',
          value: String(offset),
        },
        {
          name: '_total',
          value: 'accurate',
        },
      ],
    });
    total = bundle.total ?? 0;

    const entries = bundle.entry ?? [];
    const includedResources = entries.map((entry) => entry.resource).filter(Boolean) as Resource[];
    const claims = entries
      .filter((entry) => entry.search?.mode !== 'include')
      .map((entry) => entry.resource)
      .filter((resource): resource is Claim => resource?.resourceType === 'Claim');
    if (claims.length === 0) break;

    await addPage(
      filteringByServiceDate
        ? claims.filter((claim) => claimMatchesServiceDateRange(claim, filters.serviceDateFrom, filters.serviceDateTo))
        : claims,
      includedResources
    );
    offset += claims.length;

    if (rows.length >= EXPORT_CLAIMS_MATCH_LIMIT) return truncated();
  } while (offset < total);

  return {
    rows,
    incomplete: false,
  };
}

const taskOutput = (code: string, valueString: string): TaskOutput => ({
  type: {
    coding: [
      {
        system: EXPORT_TASK_SYSTEM,
        code,
      },
    ],
  },
  valueString,
});
