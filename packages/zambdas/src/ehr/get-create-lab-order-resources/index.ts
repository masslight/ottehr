import Oystehr, { BatchInputRequest, Bundle } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Coverage, Location, Organization } from 'fhir/r4b';
import {
  CODE_SYSTEM_COVERAGE_CLASS,
  CPTCodeOption,
  CreateLabCoverageInfo,
  EXTERNAL_LAB_ERROR,
  ExternalLabOrderingLocations,
  flattenBundleResources,
  getSecret,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  LAB_ORG_TYPE_CODING,
  LabOrderResourcesRes,
  ModifiedOrderingLocation,
  OrderableItemSearchResult,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API,
  SecretsKeys,
  VALUE_SETS,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types';
import { accountIsPatientBill, sortCoveragesByPriority } from '../shared/labs';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-create-lab-order-resources';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { patientId, search: testItemSearch, secrets, labOrgIdsString } = validatedParameters;
    console.log('search passed', testItemSearch);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const { accounts, coverages, labOrgsGUIDs, orderingLocationDetails } = await getResources(
      oystehr,
      patientId,
      testItemSearch,
      labOrgIdsString
    );

    let coverageInfo: CreateLabCoverageInfo[] | undefined;
    if (patientId) {
      coverageInfo = getCoverageInfo(accounts, coverages);
    }

    let labs: OrderableItemSearchResult[] = [];
    if (testItemSearch) {
      labs = await getLabs(labOrgsGUIDs, testItemSearch, m2mToken);
    }

    // not every instance will have values for this
    let additionalCptCodes: CPTCodeOption[] | undefined = undefined;
    const additionalCptCodeToInclude = VALUE_SETS.externalLabAdditionalCptCodesToAdd;
    if (additionalCptCodeToInclude && additionalCptCodeToInclude.length > 0) {
      additionalCptCodes = additionalCptCodeToInclude.map((coding: any) => {
        const cpt: CPTCodeOption = {
          code: coding.value,
          display: coding.label,
        };
        return cpt;
      });
    }

    const response: LabOrderResourcesRes = {
      coverages: coverageInfo,
      labs,
      additionalCptCodes,
      ...orderingLocationDetails,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('admin-get-create-lab-order-resources', error, ENVIRONMENT);
  }
});

const getResources = async (
  oystehr: Oystehr,
  patientId?: string,
  testItemSearch?: string,
  labOrgIdsString?: string
): Promise<{
  accounts: Account[];
  coverages: Coverage[];
  labOrgsGUIDs: string[];
  orderingLocationDetails: ExternalLabOrderingLocations;
}> => {
  const requests: BatchInputRequest<Coverage | Account | Organization | Location>[] = [];

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

  if (testItemSearch) {
    const organizationSearchRequest: BatchInputRequest<Organization> = {
      method: 'GET',
      url: `/Organization?type=${LAB_ORG_TYPE_CODING.system}|${LAB_ORG_TYPE_CODING.code}${
        labOrgIdsString ? `&_id=${labOrgIdsString}` : ''
      }`,
    };
    requests.push(organizationSearchRequest);
  }

  const orderingLocationsRequest: BatchInputRequest<Location> = {
    method: 'GET',
    url: `/Location?status=active&identifier=${LAB_ACCOUNT_NUMBER_SYSTEM}|`,
  };
  requests.push(orderingLocationsRequest);

  const searchResults: Bundle<Coverage | Account | Organization | Location> = await oystehr.fhir.batch({
    requests,
  });
  const resources = flattenBundleResources<Coverage | Account | Organization | Location>(searchResults);

  const coverages: Coverage[] = [];
  const accounts: Account[] = [];
  const organizations: Organization[] = [];
  const labOrgsGUIDs: string[] = [];
  const orderingLocations: ModifiedOrderingLocation[] = [];
  const orderingLocationIds: string[] = [];

  resources.forEach((resource) => {
    if (resource.resourceType === 'Organization') {
      const fhirOrg = resource as Organization;
      organizations.push(fhirOrg);
      const labGuid = fhirOrg.identifier?.find((id) => id.system === OYSTEHR_LAB_GUID_SYSTEM)?.value;
      if (labGuid) labOrgsGUIDs.push(labGuid);
    }
    if (resource.resourceType === 'Coverage') coverages.push(resource as Coverage);
    if (resource.resourceType === 'Account') {
      // todo labs team - this logic will change when we implement workers comp, but for now
      // we will just ignore those types of accounts to restore functionality
      if (accountIsPatientBill(resource)) {
        accounts.push(resource as Account);
      }
    }
    if (resource.resourceType === 'Location') {
      const loc = resource as Location;
      if (
        loc.id &&
        loc.identifier &&
        loc.name &&
        !loc.extension?.some(
          (ext) =>
            ext.valueCoding?.code === 'vi' &&
            ext.valueCoding?.system === 'http://terminology.hl7.org/CodeSystem/location-physical-type'
        )
      ) {
        orderingLocations.push({
          name: loc.name,
          id: loc.id,
          enabledLabs: loc.identifier
            .filter((id) => id.system === LAB_ACCOUNT_NUMBER_SYSTEM && id.value && id.assigner && id.assigner.reference)
            .map((id) => {
              return {
                accountNumber: id.value!,
                labOrgRef: id.assigner!.reference!,
              };
            }),
        });
        orderingLocationIds.push(loc.id);
      }
    }
  });

  return {
    coverages,
    accounts,
    labOrgsGUIDs,
    orderingLocationDetails: { orderingLocationIds, orderingLocations },
  };
};

const getLabs = async (
  labOrgsGUIDs: string[],
  search: string,
  m2mToken: string
): Promise<OrderableItemSearchResult[]> => {
  const labIds = labOrgsGUIDs.join(',');
  let cursor = '';
  let totalReturn = 0;
  const items: OrderableItemSearchResult[] = [];

  do {
    const url = `${OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API}?labIds=${labIds}&itemNames=${search}&limit=100&cursor=${cursor}`;
    const orderableItemsSearch = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${m2mToken}`,
      },
    });

    if (!orderableItemsSearch.ok)
      throw EXTERNAL_LAB_ERROR(`Failed to fetch orderable items: ${orderableItemsSearch.status}`);

    console.log(`orderable item search for search term "${search}"`);
    const response = await orderableItemsSearch.json();

    let orderableItemRes = response.orderableItems;
    if (!Array.isArray(orderableItemRes)) {
      console.error(
        `orderableItemRes was not an array. It was: ${JSON.stringify(orderableItemRes)}. Returning no orderable items`
      );
      orderableItemRes = [];
    }
    const itemsToBeReturned = orderableItemRes.length;
    console.log('This is orderableItemRes len', itemsToBeReturned);

    items.push(...(orderableItemRes as OrderableItemSearchResult[]));
    cursor = response?.metadata?.nextCursor || '';
    totalReturn += itemsToBeReturned;
    console.log('totalReturn:', totalReturn);
  } while (cursor && totalReturn <= 100); // capping at 100 so that the zambda doesn't fail. (no one is scrolling through that many anyway)
  // if we hear no complaints about the 100 return (i highly doubt we will) we can simplify this logic by getting rid of the cursor logic
  // and the do while - the first call will only ever return 100 and i suspect thats really all we need

  return items;
};

const getCoverageInfo = (accounts: Account[], coverages: Coverage[]): CreateLabCoverageInfo[] => {
  if (accounts.length !== 1) {
    console.log('accounts.length', accounts.length);
    // there should only be one active account
    throw EXTERNAL_LAB_ERROR(
      'Please update responsible party information - patient must have one active account record to represent a guarantor to external lab orders'
    );
  }
  const patientAccount = accounts[0];
  if (!patientAccount.guarantor) {
    throw EXTERNAL_LAB_ERROR(
      'Please update responsible party information - patient must have an account with a guarantor resource to external lab orders'
    );
  }
  const isSelfPay = !patientAccount.coverage?.length ? true : false;
  const coveragesSortedByPriority = sortCoveragesByPriority(patientAccount, coverages);

  if (!coveragesSortedByPriority && !isSelfPay) {
    throw EXTERNAL_LAB_ERROR(
      'Please update patient payment information - patient must have insurance or have designated self pay to external lab orders'
    );
  }

  if (coveragesSortedByPriority) {
    const coverageInfo = coveragesSortedByPriority.map((coverage, idx) => {
      const coverageName = coverage.class?.find(
        (c) => c.type.coding?.find((code) => code.system === CODE_SYSTEM_COVERAGE_CLASS)
      )?.name;
      const coverageId = coverage.id;
      if (!coverageName || !coverageId) {
        throw EXTERNAL_LAB_ERROR(
          `Insurance appears to be malformed, cannot reconcile insurance class name and/or coverage id: ${coverageName}, ${coverageId}`
        );
      }
      if (idx === 0) {
        return { coverageName, coverageId, isPrimary: true };
      } else {
        return { coverageName, coverageId, isPrimary: false };
      }
    });
    return coverageInfo;
  } else {
    // todo labs this could change when client bill is implemented
    // empty array equates to self pay
    return [];
  }
};
