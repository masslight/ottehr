import Oystehr from '@oystehr/sdk';
import { Medication, MedicationAdministration } from 'fhir/r4b';
import {
  getDosageUnitsAndRouteOfMedication,
  getLocationCodeFromMedicationAdministration,
  getResourcesFromBatchInlineRequests,
  INVENTORY_MEDICATION_TYPE_CODE,
  MedicationData,
  OrderPackage,
  removePrefix,
  searchMedicationLocation,
  searchRouteByCode,
  Secrets,
} from 'utils';
import { createOystehrClient, ZambdaInput } from '../../shared';
import { createMedicationAdministrationResource } from './fhir-resources-creation';

export function getPerformerId(medicationAdministration: MedicationAdministration): string | undefined {
  return medicationAdministration.performer?.find((perf) => perf.actor.reference)?.actor.reference;
}

export function createMedicationCopy(inventoryMedication: Medication, orderData: MedicationData): Medication {
  const resourceCopy = { ...inventoryMedication };
  delete resourceCopy.id;
  delete resourceCopy.meta;
  // deleting identifier with code that indicates that this medication is inventory one
  const typeIdentifierArrId =
    resourceCopy.identifier?.findIndex((idn) => idn.value === INVENTORY_MEDICATION_TYPE_CODE) ?? -1;
  if (typeIdentifierArrId >= 0) resourceCopy.identifier?.splice(typeIdentifierArrId, 1);
  if (orderData.lotNumber || orderData.expDate) {
    resourceCopy.batch = {
      lotNumber: orderData.lotNumber,
      expirationDate: orderData.expDate,
    };
  }
  if (orderData.manufacturer) resourceCopy.manufacturer = { display: orderData.manufacturer };
  return resourceCopy;
}

export async function practitionerIdFromZambdaInput(input: ZambdaInput, secrets: Secrets | null): Promise<string> {
  const userToken = input.headers.Authorization.replace('Bearer ', '');
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

export function getMedicationFromMA(medicationAdministration: MedicationAdministration): Medication | undefined {
  return medicationAdministration.contained?.find((res) => res.resourceType === 'Medication') as Medication;
}
