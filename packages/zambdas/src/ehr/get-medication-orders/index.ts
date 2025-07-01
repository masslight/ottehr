import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { MedicationAdministration, Patient, Practitioner } from 'fhir/r4b';
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
import { createOystehrClient, wrapHandler } from '../../shared';
import { ZambdaInput } from '../../shared';
import { checkOrCreateM2MClientToken } from '../../shared';
import { getMedicationFromMA } from '../create-update-medication-order/helpers';
import { validateRequestParameters } from './validateRequestParameters';
let m2mToken: string;
const ZAMBDA_NAME = 'get-medication-orders';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
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
});

async function performEffect(
  oystehr: Oystehr,
  validatedParameters: GetMedicationOrdersInput
): Promise<GetMedicationOrdersResponse> {
  const orderPackages = await getOrderPackages(oystehr, validatedParameters.searchBy);
  const result = orderPackages?.map((pkg) => mapMedicalAdministrationToDTO(pkg));
  return {
    orders: result ?? [],
  };
}

function mapMedicalAdministrationToDTO(orderPackage: OrderPackage): ExtendedMedicationDataForResponse {
  const { medicationAdministration, providerCreatedOrder, providerAdministeredOrder } = orderPackage;
  const medication = getMedicationFromMA(medicationAdministration);
  const dosageUnitsRoute = getDosageUnitsAndRouteOfMedication(medicationAdministration);
  const orderReasons = getReasonAndOtherReasonForNotAdministeredOrder(medicationAdministration);
  const administeredInfo = getProviderIdAndDateMedicationWasAdministered(medicationAdministration);
  const providerCreatedOrderName = providerCreatedOrder ? getFullestAvailableName(providerCreatedOrder) : '';
  const providerAdministeredOrderName = providerAdministeredOrder && getFullestAvailableName(providerAdministeredOrder);
  return {
    id: medicationAdministration.id ?? '',
    status: mapFhirToOrderStatus(medicationAdministration) ?? 'pending',
    patient: medicationAdministration.subject.reference?.replace('Patient/', '') ?? '',
    encounterId: medicationAdministration.context?.reference?.replace('Encounter/', '') ?? '',
    medicationId: medication?.id,
    medicationName: (medication && getMedicationName(medication)) ?? '',
    dose: dosageUnitsRoute.dose ?? -1,
    route: dosageUnitsRoute.route ?? '',
    units: dosageUnitsRoute.units,
    instructions: medicationAdministration.dosage?.text,
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

async function getOrderPackages(
  oystehr: Oystehr,
  searchBy: GetMedicationOrdersInput['searchBy']
): Promise<OrderPackage[] | undefined> {
  const searchParams = [
    {
      name: '_tag',
      value: MEDICATION_ADMINISTRATION_CSS_RESOURCE_CODE,
    },
    {
      name: '_include',
      value: 'MedicationAdministration:subject',
    },
    {
      name: '_include',
      value: 'MedicationAdministration:performer',
    },
  ];

  if (searchBy.field === 'encounterId') {
    searchParams.push({ name: 'context', value: `Encounter/${searchBy.value}` });
  } else if (searchBy.field === 'encounterIds') {
    const encounterRefs = searchBy.value.map((id) => `Encounter/${id}`).join(',');
    searchParams.push({ name: 'context', value: encounterRefs });
  }

  console.log('searchParams for MedicationAdministration', searchParams);

  const bundle = await oystehr.fhir.search({
    resourceType: 'MedicationAdministration',
    params: searchParams,
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

    resultPackages.push({
      medicationAdministration: ma,
      patient,
      providerCreatedOrder,
      providerAdministeredOrder,
    });
  });

  return resultPackages;
}
