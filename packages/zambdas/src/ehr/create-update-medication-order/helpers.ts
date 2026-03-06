import Oystehr, { TerminologySearchCptResponse, TerminologySearchHcpcsResponse } from '@oystehr/sdk';
import { Medication, MedicationAdministration } from 'fhir/r4b';
import {
  CPTCodeOption,
  getAllCptCodesFromInHouseMedication,
  getAllHcpcsCodesFromInHouseMedication,
  getDosageUnitsAndRouteOfMedication,
  getLocationCodeFromMedicationAdministration,
  getResourcesFromBatchInlineRequests,
  INVENTORY_MEDICATION_TYPE_CODE,
  MedicationData,
  MedicationOrderStatuses,
  OrderPackage,
  removePrefix,
  searchMedicationLocation,
  searchRouteByCode,
  Secrets,
} from 'utils';
import { createOystehrClient } from '../../shared';
import { createMedicationAdministrationResource } from './fhir-resources-creation';

export function getPerformerId(medicationAdministration: MedicationAdministration): string | undefined {
  return medicationAdministration.performer?.find((perf) => perf.actor.reference)?.actor.reference;
}

export function createMedicationCopy(
  inventoryMedication: Medication,
  orderData: { lotNumber?: string; expDate?: string; manufacturer?: string },
  newStatus?: string
): Medication {
  const resourceCopy = { ...inventoryMedication };
  delete resourceCopy.id;
  delete resourceCopy.meta;
  // deleting identifier with code that indicates that this medication is inventory one
  const typeIdentifierArrId =
    resourceCopy.identifier?.findIndex((idn) => idn.value === INVENTORY_MEDICATION_TYPE_CODE) ?? -1;
  if (typeIdentifierArrId >= 0) resourceCopy.identifier?.splice(typeIdentifierArrId, 1);
  if (newStatus !== MedicationOrderStatuses['administered-not'] && (orderData.lotNumber || orderData.expDate)) {
    resourceCopy.batch = {
      lotNumber: orderData.lotNumber,
      expirationDate: orderData.expDate,
    };
  }
  if (orderData.manufacturer) resourceCopy.manufacturer = { display: orderData.manufacturer };
  return resourceCopy;
}

export async function practitionerIdFromZambdaInput(userToken: string, secrets: Secrets | null): Promise<string> {
  const oystehr = createOystehrClient(userToken, secrets);
  const myPractitionerId = removePrefix('Practitioner/', (await oystehr.user.me()).profile);
  if (!myPractitionerId) throw new Error('No practitioner id was found for token provided');
  return myPractitionerId;
}

export async function getMedicationByName(oystehr: Oystehr, medicationName: string): Promise<Medication> {
  const medications = await getResourcesFromBatchInlineRequests(oystehr, [`Medication?identifier=${medicationName}`]);
  const medication = medications.find((res) => res.resourceType === 'Medication') as Medication;
  if (!medication) throw new Error(`No medication was found with this name: ${medicationName}`);
  return medication;
}

export async function getMedicationById(oystehr: Oystehr, medicationId: string): Promise<Medication> {
  const medication = await oystehr.fhir.get<Medication>({
    resourceType: 'Medication',
    id: medicationId,
  });
  if (!medication) throw new Error(`No medication was found for this id: ${medicationId}`);
  return medication;
}

export function validateProviderAccess(
  orderData: MedicationData,
  newStatus: string,
  orderPkg: OrderPackage,
  practitionerId: string
): void {
  // some strange logic. On 'MAR' screen only those providers that created order can edit and delete it,
  // but on the 'Medication Details' screen nurses and other stuff can change and move order to another status.
  // So when we receive only new data without status change, it means we are on 'MAR' tab.
  // When we receive new data and new status, it means that we are on 'Medication Details' screen so
  // we don't need provider validation because everybody can do it
  if (orderData && !newStatus && getPerformerId(orderPkg.medicationAdministration) !== practitionerId)
    throw new Error(`You can't edit this order, because it was created by another provider`);
}

export function updateMedicationAdministrationData(data: {
  orderData: MedicationData;
  orderResources: OrderPackage;
  administeredProviderId?: string;
  orderedByProviderId?: string;
  medicationResource: Medication;
}): MedicationAdministration {
  const { orderResources, orderData, administeredProviderId, orderedByProviderId, medicationResource } = data;
  const routeCode = orderData.route
    ? orderData.route
    : getDosageUnitsAndRouteOfMedication(orderResources.medicationAdministration).route;
  const routeCoding = searchRouteByCode(routeCode!);
  if (orderData.route && !routeCoding) throw new Error(`No route found with code provided: ${orderData.route}`);
  const locationCode = orderData.location
    ? orderData.location
    : getLocationCodeFromMedicationAdministration(orderResources.medicationAdministration);
  const locationCoding = locationCode ? searchMedicationLocation(locationCode) : undefined;
  if (orderData.location && !locationCoding)
    throw new Error(`No location found with code provided: ${orderData.location}`);

  if (!routeCoding) throw new Error(`No medication appliance route was found for code: ${routeCode}`);
  const newMA = createMedicationAdministrationResource({
    orderData,
    status: orderResources.medicationAdministration.status,
    route: routeCoding,
    location: locationCoding,
    existedMA: orderResources.medicationAdministration,
    administeredProviderId,
    orderedByProviderId,
    medicationResource,
  });
  newMA.id = orderResources.medicationAdministration.id;
  return newMA;
}

export async function getCptHcpcsCodesToAddToChartData(
  oystehr: Oystehr,
  medication: Medication,
  chartDataCptCodes: string[]
): Promise<CPTCodeOption[]> {
  const cptMedicationCodes = getAllCptCodesFromInHouseMedication(medication);
  const hcpcsMedicationCodes = getAllHcpcsCodesFromInHouseMedication(medication);

  const filteredCptCodesToAdd = new Set(
    cptMedicationCodes?.filter((codeToAdd) => !chartDataCptCodes?.includes(codeToAdd))
  );
  const filteredHcpcsCodesToAdd = new Set(
    hcpcsMedicationCodes?.filter((codeToAdd) => !chartDataCptCodes?.includes(codeToAdd))
  );

  const cptTerminologyPromises: Promise<TerminologySearchCptResponse>[] = [];
  const hcpcsTerminologyPromises: Promise<TerminologySearchHcpcsResponse>[] = [];
  filteredCptCodesToAdd?.forEach((codeToAdd) => {
    cptTerminologyPromises.push(
      oystehr.terminology.searchCpt({ searchType: 'code', strictMatch: true, query: codeToAdd })
    );
  });
  filteredHcpcsCodesToAdd?.forEach((codeToAdd) => {
    hcpcsTerminologyPromises.push(
      oystehr.terminology.searchHcpcs({ searchType: 'code', strictMatch: true, query: codeToAdd })
    );
  });
  const cptTerminologyCodes = (await Promise.all(cptTerminologyPromises)).flatMap((terminology) => terminology.codes);
  const hcpcsTerminologyCodes = (await Promise.all(hcpcsTerminologyPromises)).flatMap(
    (terminology) => terminology.codes
  );
  const terminologyCodesMerged = [...cptTerminologyCodes, ...hcpcsTerminologyCodes];

  const codesOptionsToAdd: CPTCodeOption[] = [];

  [...filteredCptCodesToAdd, ...filteredHcpcsCodesToAdd].forEach((codeToAdd) => {
    const terminologyResponse = terminologyCodesMerged.find((terminology) => terminology.code === codeToAdd);
    if (terminologyResponse) codesOptionsToAdd.push({ code: codeToAdd, display: terminologyResponse.display });
  });

  return codesOptionsToAdd;
}

export function getEncounterIdFromMA(medicationAdministration: MedicationAdministration): string | undefined {
  const maContext = medicationAdministration.context?.reference;
  if (maContext?.includes('Encounter/')) return maContext?.replace('Encounter/', '');
  return undefined;
}
