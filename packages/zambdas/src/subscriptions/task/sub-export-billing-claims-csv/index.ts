import Oystehr from '@oystehr/sdk';
import { Claim, Resource, Task, TaskOutput } from 'fhir/r4b';
import {
  BUCKET_NAMES,
  EXPORT_CLAIMS_INCOMPLETE_CODE,
  EXPORT_CSV_OUTPUT_URL_CODE,
  EXPORT_TASK_SYSTEM,
  ExportBillingClaimsInput,
  getSecret,
  SecretsKeys,
  toCsv,
} from 'utils';
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
import { checkOrCreateM2MClientToken } from '../../../shared';
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
  });
  if (!filterParams) {
    return {
      rows: [],
      incomplete: false,
    };
  }

  const filteringByServiceDate = Boolean(filters.serviceDateFrom || filters.serviceDateTo);
  const rows: string[][] = [];

  const addPage = async (claims: Claim[], includedResources: Resource[]): Promise<void> => {
    if (claims.length === 0) return;
    const items = await enrichAndMapClaims({
      oystehr,
      claims,
      includedResources,
    });
    rows.push(...items.map(claimExportRow));
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

    for (let start = 0; start < claimIds.length; start += EXPORT_PAGE_SIZE) {
      const page = await fetchClaimsPageByIds({
        oystehr,
        claimIds: claimIds.slice(start, start + EXPORT_PAGE_SIZE),
      });
      await addPage(page.claims, page.includedResources);
    }

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

    const includedResources = (bundle.entry ?? []).map((entry) => entry.resource).filter(Boolean) as Resource[];
    const claims = includedResources.filter((resource): resource is Claim => resource.resourceType === 'Claim');
    if (claims.length === 0) break;

    await addPage(
      filteringByServiceDate
        ? claims.filter((claim) => claimMatchesServiceDateRange(claim, filters.serviceDateFrom, filters.serviceDateTo))
        : claims,
      includedResources
    );
    offset += claims.length;
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
