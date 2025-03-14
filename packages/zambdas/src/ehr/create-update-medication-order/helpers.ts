import Oystehr from '@oystehr/sdk';
import { Medication, MedicationAdministration } from 'fhir/r4b';
import {
  getDosageUnitsAndRouteOfMedication,
  getLocationCodeFromMedicationAdministration,
  getMedicationName,
  getResourcesFromBatchInlineRequests,
  INVENTORY_MEDICATION_TYPE_CODE,
  MedicationData,
  OrderPackage,
  removePrefix,
  searchMedicationLocation,
  searchRouteByCode,
} from 'utils';
import { Secrets } from 'zambda-utils';
import { createOystehrClient } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';
import { createMedicationAdministrationResource } from './fhir-recources-creation';
import { ExtendedMedicationData } from './index';

export function getPerformerId(medicationAdministration: MedicationAdministration): string | undefined {
  return medicationAdministration.performer?.find((perf) => perf.actor.reference)?.actor.reference;
}

export async function updateMedicationCopyForOrder(
  oystehr: Oystehr,
  inventoryMedication: Medication,
  existedMedicationId: string,
  orderData: MedicationData
): Promise<Medication> {
  const medicationCopy = createMedicationCopy(inventoryMedication, orderData);
  medicationCopy.id = existedMedicationId;
  return oystehr.fhir.update(medicationCopy);
}

export function createMedicationCopy(inventoryMedication: Medication, orderData: MedicationData): Medication {
  const resourceCopy = { ...inventoryMedication };
  delete resourceCopy.id;
  // deleting identifier with code that indicates that this medication is inventory one
  const typeIdentifierArrId = resourceCopy.identifier?.findIndex((idn) => idn.value === INVENTORY_MEDICATION_TYPE_CODE);
  if (typeIdentifierArrId && typeIdentifierArrId >= 0) resourceCopy.identifier?.splice(typeIdentifierArrId, 1);
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
  const myPractId = removePrefix('Practitioner/', (await oystehr.user.me()).profile);
  if (!myPractId) throw new Error('No practitioner id was found for token provided');
  return myPractId;
}

export async function createOrRecreateMedicationForOrder(
  oystehr: Oystehr,
  orderPkg: OrderPackage,
  inputMedication: Medication,
  orderData: MedicationData
): Promise<Medication | undefined> {
  let medicationCopy: Medication | undefined;
  console.log(`Medication found: ${inputMedication.id}, existed medication in resource: ${orderPkg.medication?.id}`);
  if (!orderPkg.medication) {
    console.log('Creating inputMedication copy for this particular order');
    medicationCopy = createMedicationCopy(inputMedication, orderData);
    medicationCopy = await oystehr.fhir.create(medicationCopy);
    console.log(`Created copy: ${medicationCopy.id}`);
  } else if (getMedicationName(inputMedication) !== getMedicationName(orderPkg.medication)) {
    console.log('Updating inputMedication resource copy for this order');
    medicationCopy = await updateMedicationCopyForOrder(oystehr, inputMedication, orderPkg.medication.id!, orderData);
    console.log(`Updated resource with id: ${medicationCopy.id}`);
  } else {
    console.log(`Medications are identical, update just existed medication`);
    medicationCopy = await updateMedicationCopyForOrder(
      oystehr,
      orderPkg.medication,
      orderPkg.medication.id!,
      orderData
    );
    medicationCopy = orderPkg.medication;
  }
  return medicationCopy;
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

export async function updateMedicationAdministrationData(
  oystehr: Oystehr,
  data: ExtendedMedicationData,
  pkg: OrderPackage
): Promise<MedicationAdministration> {
  const routeCode = data.route ? data.route : getDosageUnitsAndRouteOfMedication(pkg.medicationAdministration).route;
  const routeCoding = searchRouteByCode(routeCode!);
  if (data.route && !routeCoding) throw new Error(`No route found with code provided: ${data.route}`);
  const locationCode = data.location
    ? data.location
    : getLocationCodeFromMedicationAdministration(pkg.medicationAdministration);
  const locationCoding = locationCode ? searchMedicationLocation(locationCode) : undefined;
  if (data.location && !locationCoding) throw new Error(`No location found with code provided: ${data.location}`);

  if (!routeCoding) throw new Error(`No medication appliance route was found for code: ${routeCode}`);
  const newMA = createMedicationAdministrationResource(
    data,
    pkg.medicationAdministration.status,
    routeCoding,
    locationCoding,
    pkg.medicationAdministration
  );
  newMA.id = pkg.medicationAdministration.id;
  return oystehr.fhir.update(newMA);
}
