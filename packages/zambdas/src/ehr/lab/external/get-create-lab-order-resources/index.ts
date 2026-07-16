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
  isAppointmentWorkersComp,
  isLocationInPerson,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  LAB_LIST_CODE_CODING,
  LAB_ORG_TYPE_CODING,
  LabOrderResourcesRes,
  ModifiedOrderingLocation,
  OrderableItemSearchResult,
  OYSTEHR_LAB_GUID_SYSTEM,
  STATIC_COMPENDIUM_LAB_GUID,
  VALUE_SETS,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler } from '../../../../shared';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { ZambdaInput } from '../../../../shared/types';
import { formatLabListDTOs } from '../../shared/helpers';
import { accountIsPatientBill, accountIsWorkersComp, sortCoveragesByPriority } from '../../shared/labs';
import { getOrderableItems } from '../../shared/orderable-items';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-create-lab-order-resources';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const { accounts, coverages, labGuids, orderingLocationDetails, appointmentIsWorkersComp, labLists } =
    await getResources(oystehr, patientId, encounterId, testItemSearch, labOrgIdsString);

  console.log('labGuids and labOrgIdString', labGuids, labOrgIdsString);

  let coverageInfo: CreateLabCoverageInfo[] | undefined;
  if (patientId) {
    coverageInfo = getCoverageInfo(accounts, coverages);
  }

  let labs: OrderableItemSearchResult[] = [];
  if (testItemSearch) {
    labs = await getOrderableItems(labGuids, { textSearch: testItemSearch }, m2mToken);
  }

  if (selectedLabSet) {
    console.log('searching orderable items for the lab set', selectedLabSet.listName);
    const labRequests = selectedLabSet.labs.map(async (lab) => {
      const labSearchRes = await getOrderableItems([lab.labGuid], { itemCodes: [lab.itemCode] }, m2mToken);

      let staticLabName: string | undefined;
      if (lab.labGuid === STATIC_COMPENDIUM_LAB_GUID) {
        // lab.display is formatted as such: `(code) Test Name / Lab Name`
        // we want "Lab Name" which will always be the last item in array split on '/'
        staticLabName = lab.display?.split('/').pop()?.trim();
      }

      return { labSearchRes, staticLabName };
    });

    const allLabsResults = await Promise.all(labRequests);

    labs = allLabsResults.flatMap((res) => {
      const { labSearchRes, staticLabName } = res;
      if (staticLabName) {
        return labSearchRes.map((oi) => ({
          item: oi.item,
          lab: {
            ...oi.lab,
            labName: staticLabName,
          },
        }));
      } else {
        return labSearchRes;
      }
    });
  }

  let cptCodesToAddPerEncounter: CPTCodeOption[] | undefined = undefined;
  const additionalCptCodes = VALUE_SETS.externalLabCptCodesToAddPerEncounter;
  if (additionalCptCodes && additionalCptCodes.length > 0) {
    cptCodesToAddPerEncounter = additionalCptCodes.map((coding) => {
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
    cptCodesToAddPerEncounter, // the front end will handle deciding if these should be added based on whats already added and if order is psc or not
    appointmentIsWorkersComp,
    ...orderingLocationDetails,
    labSets: formatLabListDTOs(labLists),
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
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
  labGuids: string[];
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
  const labGuids: string[] = [];
  const labOrgRefToLabGuidAndNameMap = new Map<string, { labGuid: string; labName: string }>();
  const orderingLocations: ModifiedOrderingLocation[] = [];
  const orderingLocationIds: string[] = [];
  const encounters: Encounter[] = [];
  const workersCompAccounts: Account[] = [];
  const labLists: List[] = [];
  const appointments: Appointment[] = [];

  // grab the lab orgs first to make associating labGuids later more efficient
  resources
    .filter((res): res is Organization => res.resourceType === 'Organization')
    .forEach((org) => {
      organizations.push(org);
      const labGuid = org.identifier?.find((id) => id.system === OYSTEHR_LAB_GUID_SYSTEM)?.value;
      if (labGuid) {
        labGuids.push(labGuid);
        labOrgRefToLabGuidAndNameMap.set(`Organization/${org.id}`, { labGuid, labName: org.name || '' });
      }
    });

  resources.forEach((resource) => {
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
      // Lab orders are placed at in-person Locations; a dual-mode Location that
      // is also virtual still qualifies as long as it's marked in-person.
      if (loc.id && loc.identifier && loc.name && isLocationInPerson(loc)) {
        orderingLocations.push({
          name: loc.name,
          id: loc.id,
          enabledLabs: loc.identifier
            .filter((id) => id.system === LAB_ACCOUNT_NUMBER_SYSTEM && id.value && id.assigner && id.assigner.reference)
            .map((id) => {
              return {
                accountNumber: id.value!,
                labOrgRef: id.assigner!.reference!,
                ...labOrgRefToLabGuidAndNameMap.get(id.assigner!.reference!),
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
    labGuids,
    orderingLocationDetails: { orderingLocationIds, orderingLocations },
    appointmentIsWorkersComp,
    labLists,
  };
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
      const coverageName = coverage.class?.find((c) =>
        c.type.coding?.find((code) => code.system === CODE_SYSTEM_COVERAGE_CLASS)
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
