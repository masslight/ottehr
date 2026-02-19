import Oystehr, { BatchInputRequest, Bundle } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Appointment, Coverage, Encounter, List, Location, Organization } from 'fhir/r4b';
import {
  CODE_SYSTEM_COVERAGE_CLASS,
  CPTCodeOption,
  CreateLabCoverageInfo,
  EXTERNAL_LAB_ERROR,
  ExternalLabOrderingLocations,
  flattenBundleResources,
  getSecret,
  isAppointmentWorkersComp,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  LAB_LIST_CODE_CODING,
  LAB_ORG_TYPE_CODING,
  LabOrderResourcesRes,
  ModifiedOrderingLocation,
  OrderableItemSearchResult,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API,
  SecretsKeys,
  VALUE_SETS,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler } from '../../../../shared';
import { createOystehrClient } from '../../../../shared/helpers';
import { ZambdaInput } from '../../../../shared/types';
import { formatLabListDTOs } from '../../shared/helpers';
import { accountIsPatientBill, accountIsWorkersComp, sortCoveragesByPriority } from '../../shared/labs';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-create-lab-order-resources';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const {
      patientId,
      encounterId,
      search: testItemSearch,
      secrets,
      labOrgIdsString,
      selectedLabSet,
    } = validatedParameters;
    console.log('search passed', testItemSearch);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const { accounts, coverages, labOrgsGUIDs, orderingLocationDetails, appointmentIsWorkersComp, labLists } =
      await getResources(oystehr, patientId, encounterId, testItemSearch, labOrgIdsString);

    let coverageInfo: CreateLabCoverageInfo[] | undefined;
    if (patientId) {
      coverageInfo = getCoverageInfo(accounts, coverages);
    }

    let labs: OrderableItemSearchResult[] = [];
    if (testItemSearch) {
      labs = await getLabs(labOrgsGUIDs, { textSearch: testItemSearch }, m2mToken);
    }

    if (selectedLabSet) {
      console.log('searching orderable items for the lab set', selectedLabSet.listName);
      const labRequests = selectedLabSet.labs.map((lab) => {
        return getLabs([lab.labGuid], { itemCodes: [lab.itemCode] }, m2mToken);
      });
      const allLabsResults = await Promise.all(labRequests);
      labs = allLabsResults.flat();
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
      appointmentIsWorkersComp,
      ...orderingLocationDetails,
      labSets: formatLabListDTOs(labLists),
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
  encounterId?: string,
  testItemSearch?: string,
  labOrgIdsString?: string
): Promise<{
  accounts: Account[];
  coverages: Coverage[];
  labOrgsGUIDs: string[];
  orderingLocationDetails: ExternalLabOrderingLocations;
  appointmentIsWorkersComp: boolean;
  labLists: List[];
}> => {
  const requests: BatchInputRequest<Coverage | Account | Organization | Location | Encounter | Appointment | List>[] =
    [];

  if (patientId) {
    const coverageSearchRequest: BatchInputRequest<Coverage> = {
      method: 'GET',
      url: `/Coverage?patient=Patient/${patientId}&status=active`,
    };
    const accountSearchRequest: BatchInputRequest<Account> = {
      method: 'GET',
      url: `/Account?subject=Patient/${patientId}&status=active`,
    };
    const labListRequest: BatchInputRequest<List> = {
      method: 'GET',
      url: `/List?code=${LAB_LIST_CODE_CODING.external.system}|${LAB_LIST_CODE_CODING.external.code}&status=current`,
    };
    requests.push(coverageSearchRequest, accountSearchRequest, labListRequest);
  }

  if (encounterId) {
    const encounterRequest: BatchInputRequest<Encounter | Appointment> = {
      method: 'GET',
      url: `/Encounter?_id=${encounterId}&_include=Encounter:appointment`,
    };
    requests.push(encounterRequest);
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

  const searchResults: Bundle<Coverage | Account | Organization | Location | Encounter | Appointment | List> =
    await oystehr.fhir.batch({
      requests,
    });
  const resources = flattenBundleResources<
    Coverage | Account | Organization | Location | Encounter | Appointment | List
  >(searchResults);

  const coverages: Coverage[] = [];
  const accounts: Account[] = [];
  const organizations: Organization[] = [];
  const labOrgsGUIDs: string[] = [];
  const orderingLocations: ModifiedOrderingLocation[] = [];
  const orderingLocationIds: string[] = [];
  const encounters: Encounter[] = [];
  const workersCompAccounts: Account[] = [];
  const labLists: List[] = [];
  const appointments: Appointment[] = [];

  resources.forEach((resource) => {
    if (resource.resourceType === 'Organization') {
      const fhirOrg = resource as Organization;
      organizations.push(fhirOrg);
      const labGuid = fhirOrg.identifier?.find((id) => id.system === OYSTEHR_LAB_GUID_SYSTEM)?.value;
      if (labGuid) labOrgsGUIDs.push(labGuid);
    }
    if (resource.resourceType === 'Coverage') coverages.push(resource as Coverage);
    if (resource.resourceType === 'Account' && resource.status === 'active') {
      if (accountIsPatientBill(resource)) {
        accounts.push(resource as Account);
      } else if (accountIsWorkersComp(resource)) {
        workersCompAccounts.push(resource);
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
    if (resource.resourceType === 'Encounter') encounters.push(resource);
    if (resource.resourceType === 'Appointment') appointments.push(resource);
    if (resource.resourceType === 'List') labLists.push(resource);
  });

  const encounter = encounters.find((resource) => resource.id === encounterId);
  const appointmentId = encounter?.appointment?.[0].reference?.replace('Appointment/', '');
  const appointment = appointments.find((resource) => resource.id === appointmentId);
  const appointmentIsWorkersComp = appointment ? isAppointmentWorkersComp(appointment) : false;
  console.log('appointmentIsWorkersComp', appointmentIsWorkersComp);

  // doing some validation that the workers comp account is properly linked to the encounter
  // oystehr labs depends on this account for submitting workers comp labs
  if (appointmentIsWorkersComp) {
    if (workersCompAccounts.length !== 1) {
      console.log(
        `Unexpected number of workers comp account returned for Patient/${patientId}. Accounts found: ${workersCompAccounts.map(
          (account) => account.id
        )}`
      );
    }
  }

  return {
    coverages,
    accounts,
    labOrgsGUIDs,
    orderingLocationDetails: { orderingLocationIds, orderingLocations },
    appointmentIsWorkersComp,
    labLists,
  };
};

type LabSearch = { textSearch: string } | { itemCodes: string[] } | { textSearch: string; itemCodes: string[] };
const getLabs = async (
  labOrgsGUIDs: string[],
  search: LabSearch,
  m2mToken: string
): Promise<OrderableItemSearchResult[]> => {
  const labIds = labOrgsGUIDs.join(',');
  let cursor = '';
  let totalReturn = 0;
  const items: OrderableItemSearchResult[] = [];

  const searchParams = [`labIds=${labIds}`];

  if ('textSearch' in search) searchParams.push(`itemNames=${search.textSearch}`);
  if ('itemCodes' in search) searchParams.push(`itemCodes=${search.itemCodes.join(',')}`);

  console.log('searchParams before join', searchParams);

  do {
    const url = `${OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API}?${searchParams.join('&')}&limit=100&cursor=${cursor}`;
    console.log('check me!', url);
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
