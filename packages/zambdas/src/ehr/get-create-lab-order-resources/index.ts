import Oystehr, { BatchInputRequest, Bundle } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Coverage, Organization } from 'fhir/r4b';
import {
  APIError,
  CODE_SYSTEM_COVERAGE_CLASS,
  EXTERNAL_LAB_ERROR,
  flattenBundleResources,
  getSecret,
  isApiError,
  LAB_ORG_TYPE_CODING,
  LabOrderResourcesRes,
  OrderableItemSearchResult,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types';
import { getPrimaryInsurance } from '../shared/labs';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-create-lab-order-resources';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { patientId, search: labSearch, secrets } = validatedParameters;
    console.log('search passed', labSearch);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const { accounts, coverages, labOrgsGUIDs } = await getResources(oystehr, patientId, labSearch);

    let coverageName: string | undefined;
    if (patientId) {
      coverageName = getCoverageName(accounts, coverages);
    }

    let labs: OrderableItemSearchResult[] = [];
    if (labSearch) {
      labs = await getLabs(labOrgsGUIDs, labSearch, m2mToken);
    }

    const response: LabOrderResourcesRes = {
      coverageName,
      labs,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('admin-get-create-lab-order-resources', error, ENVIRONMENT);
    let body = JSON.stringify({ message: `Error getting resources for create lab order: ${error}` });
    if (isApiError(error)) {
      const { code, message } = error as APIError;
      body = JSON.stringify({ message, code });
    }
    return {
      statusCode: 500,
      body,
    };
  }
});

const getResources = async (
  oystehr: Oystehr,
  patientId?: string,
  labSearch?: string
): Promise<{ accounts: Account[]; coverages: Coverage[]; labOrgsGUIDs: string[] }> => {
  const requests: BatchInputRequest<Coverage | Account | Organization>[] = [];

  if (patientId) {
    const coverageSearchRequest: BatchInputRequest<Coverage> = {
      method: 'GET',
      url: `/Coverage?patient=Patient/${patientId}&status=active`,
    };
    const accountSearchRequest: BatchInputRequest<Account> = {
      method: 'GET',
      url: `/Account?subject=Patient/${patientId}&status=active`,
    };
    requests.push(coverageSearchRequest, accountSearchRequest);
  }

  if (labSearch) {
    const organizationSearchRequest: BatchInputRequest<Organization> = {
      method: 'GET',
      url: `/Organization?type=${LAB_ORG_TYPE_CODING.system}|${LAB_ORG_TYPE_CODING.code}`,
    };
    requests.push(organizationSearchRequest);
  }

  const searchResults: Bundle<Coverage | Account | Organization> = await oystehr.fhir.batch({
    requests,
  });
  const resources = flattenBundleResources<Coverage | Account | Organization>(searchResults);

  const coverages: Coverage[] = [];
  const accounts: Account[] = [];
  const organizations: Organization[] = [];
  const labOrgsGUIDs: string[] = [];

  resources.forEach((resource) => {
    if (resource.resourceType === 'Organization') {
      const fhirOrg = resource as Organization;
      organizations.push(fhirOrg);
      const labGuid = fhirOrg.identifier?.find((id) => id.system === OYSTEHR_LAB_GUID_SYSTEM)?.value;
      if (labGuid) labOrgsGUIDs.push(labGuid);
    }
    if (resource.resourceType === 'Coverage') coverages.push(resource as Coverage);
    if (resource.resourceType === 'Account') accounts.push(resource as Account);
  });

  return { coverages, accounts, labOrgsGUIDs };
};

const getLabs = async (
  labOrgsGUIDs: string[],
  search: string,
  m2mToken: string
): Promise<OrderableItemSearchResult[]> => {
  const labIds = labOrgsGUIDs.join(',');
  let cursor = '';
  const items: OrderableItemSearchResult[] = [];

  do {
    const url = `${OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API}?labIds=${labIds}&itemNames=${search}&limit=100&cursor=${cursor}`;
    const orderableItemsSearch = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${m2mToken}`,
      },
    });
    const response = await orderableItemsSearch.json();
    const orderableItemRes = response.orderableItems as OrderableItemSearchResult[];
    items.push(...orderableItemRes);
    cursor = response?.metadata?.nextCursor || '';
  } while (cursor);

  return items;
};

const getCoverageName = (accounts: Account[], coverages: Coverage[]): string => {
  if (accounts.length !== 1)
    // there should only be one active account
    throw EXTERNAL_LAB_ERROR(
      'Please update responsible party information - patient must have one active account record to represent a guarantor to external lab orders'
    );
  const patientAccount = accounts[0];
  if (!patientAccount.guarantor) {
    throw EXTERNAL_LAB_ERROR(
      'Please update responsible party information - patient must have an account with a guarantor resource to external lab orders'
    );
  }
  const isSelfPay = !patientAccount.coverage?.length ? true : false;
  const patientPrimaryInsurance = getPrimaryInsurance(patientAccount, coverages);
  const primaryInsuranceName = patientPrimaryInsurance?.class?.find(
    (c) => c.type.coding?.find((code) => code.system === CODE_SYSTEM_COVERAGE_CLASS)
  )?.name;
  if (!patientPrimaryInsurance && !isSelfPay)
    throw EXTERNAL_LAB_ERROR(
      'Please update patient payment information - patient must have insurance or have designated self pay to external lab orders'
    );
  if (patientPrimaryInsurance && !primaryInsuranceName)
    throw EXTERNAL_LAB_ERROR('Insurance appears to be malformed, cannot reconcile insurance class name');
  const coverageName = primaryInsuranceName ?? 'Self Pay';
  return coverageName;
};
