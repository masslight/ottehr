import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication, MedicationAdministration, Patient, Practitioner } from 'fhir/r4b';
import {
  ExtendedMedicationDataForResponse,
  getDosageUnitsAndRouteOfMedication,
  getFullestAvailableName,
  getLocationCodeFromMedicationAdministration,
  getMedicationName,
  GetMedicationOrdersInput,
  GetMedicationOrdersResponse,
  getPractitionerIdThatOrderedMedication,
  getProviderIdAndDateMedicationWasAdministered,
  getReasonAndOtherReasonForNotAdministeredOrder,
  mapFhirToOrderStatus,
  MEDICATION_ADMINISTRATION_CSS_RESOURCE_CODE,
  OrderPackage,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';
import { validateRequestParameters } from './validateRequestParameters';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mtoken, validatedParameters.secrets);
    console.log('Created zapToken, fhir and clients.');

    const response = await performEffect(oystehr, validatedParameters);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', error);
    console.log('Stringified error: ', JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error getting orders: ${error}` }),
    };
  }
};

async function performEffect(
  oystehr: Oystehr,
  validatedParameters: GetMedicationOrdersInput
): Promise<GetMedicationOrdersResponse> {
  const orderPackages = await getOrderPackages(oystehr, validatedParameters.encounterId);
  const result = orderPackages?.map((pkg) => mapMedicalAdministrationToDTO(pkg));
  return {
    orders: result ?? [],
  };
}

function mapMedicalAdministrationToDTO(orderPackage: OrderPackage): ExtendedMedicationDataForResponse {
  const { medicationAdministration, medication, providerCreatedOrder, providerAdministeredOrder } = orderPackage;
  const dosageUnitsRoute = getDosageUnitsAndRouteOfMedication(medicationAdministration);
  const orderReasons = getReasonAndOtherReasonForNotAdministeredOrder(medicationAdministration);
  const administeredInfo = getProviderIdAndDateMedicationWasAdministered(medicationAdministration);
  const providerCreatedOrderName = providerCreatedOrder ? getFullestAvailableName(providerCreatedOrder) : '';
  const providerAdministeredOrderName = providerAdministeredOrder && getFullestAvailableName(providerAdministeredOrder);
  return {
    id: medicationAdministration.id ?? '',
    status: mapFhirToOrderStatus(medicationAdministration) ?? 'pending',
    patient: medicationAdministration.subject.reference?.replace('Patient/', '') ?? '',
    encounter: medicationAdministration.context?.reference?.replace('Encounter/', '') ?? '',
    medicationId: medication?.id ?? '',
    medicationName: (medication && getMedicationName(medication)) ?? '',
    dose: dosageUnitsRoute.dose ?? -1,
    route: dosageUnitsRoute.route ?? '',
    units: dosageUnitsRoute.units,
    instructions: medicationAdministration.dosage?.text ?? '',
    reason: orderReasons.reason,
    otherReason: orderReasons.otherReason,
    associatedDx: medicationAdministration.reasonReference
      ?.find((res) => res.reference)
      ?.reference?.replace('Condition/', ''),
    manufacturer: medication?.manufacturer?.display,
    location: getLocationCodeFromMedicationAdministration(medicationAdministration),
    dateTimeCreated: medicationAdministration.effectiveDateTime ?? '',
    providerCreatedTheOrderId: getPractitionerIdThatOrderedMedication(medicationAdministration) || '',
    providerCreatedTheOrder: providerCreatedOrderName ?? '',

    // scanning part
    lotNumber: medication?.batch?.lotNumber,
    expDate: medication?.batch?.expirationDate,

    // administrating
    dateGiven: administeredInfo?.dateAdministered,
    timeGiven: administeredInfo?.timeAdministered,
    administeredProviderId: administeredInfo?.administeredProviderId,
    administeredProvider: providerAdministeredOrderName,
  };
}

async function getOrderPackages(oystehr: Oystehr, encounterId: string): Promise<OrderPackage[] | undefined> {
  const bundle = await oystehr.fhir.search({
    resourceType: 'MedicationAdministration',
    params: [
      {
        name: 'context',
        value: encounterId,
      },
      {
        name: '_tag',
        value: MEDICATION_ADMINISTRATION_CSS_RESOURCE_CODE,
      },
      {
        name: '_include',
        value: 'MedicationAdministration:medication',
      },
      {
        name: '_include',
        value: 'MedicationAdministration:subject',
      },
      {
        name: '_include',
        value: 'MedicationAdministration:performer',
      },
    ],
  });
  const resources = bundle.unbundle();
  const medicationAdministrations = resources.filter(
    (res) => res.resourceType === 'MedicationAdministration'
  ) as MedicationAdministration[];

  console.log('All practitioners: ', JSON.stringify(resources.filter((res) => res.resourceType === 'Practitioner')));
  console.log(
    `All orders: ${resources
      .filter((res) => res.resourceType === 'MedicationAdministration')
      .map((ma) => ma.id)
      .join(',\n')}`
  );
  const resultPackages: OrderPackage[] = [];
  medicationAdministrations.forEach((ma) => {
    const patient = resources.find((res) => res.id === ma.subject.reference?.replace('Patient/', '')) as Patient;
    if (!patient) throw new Error(`No patient was found for order: ${ma.id}`);

    const idOfProviderCreatedOrder = getPractitionerIdThatOrderedMedication(ma);
    const providerCreatedOrder = resources.find((res) => res.id === idOfProviderCreatedOrder) as Practitioner;
    if (!providerCreatedOrder) throw new Error(`No practitioner was found for order: ${ma.id}`);

    const idOfProviderAdministeredOrder = getProviderIdAndDateMedicationWasAdministered(ma)?.administeredProviderId;
    const providerAdministeredOrder = resources.find((res) => res.id === idOfProviderAdministeredOrder) as Practitioner;

    const medication = resources.find(
      (res) => res.id === ma.medicationReference?.reference?.replace('Medication/', '')
    ) as Medication;

    resultPackages.push({
      medicationAdministration: ma,
      patient,
      medication,
      providerCreatedOrder,
      providerAdministeredOrder,
    });
  });

  return resultPackages;
}
