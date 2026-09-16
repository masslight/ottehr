import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  FhirResource,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Patient,
  Practitioner,
  Reference,
} from 'fhir/r4b';
import {
  getCptCodesFromMA,
  getCurrentOrderedByProviderId,
  getDosageUnitsAndRouteOfMedication,
  getLocationFromMedicationAdministration,
  getMedicationFromMA,
  getMedicationInteractions,
  getMedicationName,
  getNdcCodeFromMedication,
  getPractitionerIdThatOrderedMedication,
  getProviderIdAndDateMedicationWasAdministered,
  getReasonAndOtherReasonForNotAdministeredOrder,
  mapFhirToOrderStatus,
} from 'utils/lib/fhir/medication-administration';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { isDeletedMedicationOrder } from 'utils/lib/helpers/order-status.helper';
import { MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE } from 'utils/lib/types/api/medication-administration.constants';
import {
  ExtendedMedicationDataForResponse,
  GetMedicationOrdersInput,
  GetMedicationOrdersResponse,
  OrderPackage,
} from 'utils/lib/types/api/medication-administration.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-medication-orders';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  console.log('Created zapToken, fhir and clients.');

  const response = await getMedicationOrders(oystehr, validatedParameters);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function getMedicationOrders(
  oystehr: Oystehr,
  validatedParameters: GetMedicationOrdersInput
): Promise<GetMedicationOrdersResponse> {
  const orderPackages = await getOrderPackages(oystehr, validatedParameters.searchBy);
  const allOrders = orderPackages?.map((pkg) => mapMedicalAdministrationToDTO(pkg)) ?? [];

  const orders = allOrders.filter((med) => !isDeletedMedicationOrder(med));
  const cancelledOrders = allOrders.filter((med) => isDeletedMedicationOrder(med));

  return {
    orders,
    cancelledOrders,
  };
}

export function mapMedicalAdministrationToDTO(orderPackage: OrderPackage): ExtendedMedicationDataForResponse {
  const {
    medicationAdministration,
    providerCreatedOrder,
    providerAdministeredOrder,
    medicationRequest,
    medicationStatement,
  } = orderPackage;

  const medication = getMedicationFromMA(medicationAdministration);
  const dosageUnitsRoute = getDosageUnitsAndRouteOfMedication(medicationAdministration);
  const orderReasons = getReasonAndOtherReasonForNotAdministeredOrder(medicationAdministration);
  const administeredInfo = getProviderIdAndDateMedicationWasAdministered(medicationAdministration);
  const providerCreatedOrderName = providerCreatedOrder ? getFullestAvailableName(providerCreatedOrder) : '';
  const providerAdministeredOrderName = providerAdministeredOrder && getFullestAvailableName(providerAdministeredOrder);

  const currentOrderedByProviderId = getCurrentOrderedByProviderId(medicationAdministration);
  const providerOrderedBy = orderPackage.providerOrderedBy;
  const providerOrderedByName = providerOrderedBy ? getFullestAvailableName(providerOrderedBy) : '';

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
    location: getLocationFromMedicationAdministration(medicationAdministration),
    dateTimeCreated: medicationAdministration.effectiveDateTime ?? '',
    providerCreatedTheOrderId: getPractitionerIdThatOrderedMedication(medicationAdministration) || '',
    providerCreatedTheOrder: providerCreatedOrderName ?? '',

    providerId: currentOrderedByProviderId,
    orderedByProvider: providerOrderedByName,

    // scanning part
    lotNumber: medication?.batch?.lotNumber,
    ndc: medication ? getNdcCodeFromMedication(medication) : undefined,
    expDate: medication?.batch?.expirationDate,

    // administrating
    effectiveDateTime: medicationStatement?.effectiveDateTime, // ISO date with timezone
    administeredProviderId: administeredInfo?.administeredProviderId,
    administeredProvider: providerAdministeredOrderName,

    interactions: getMedicationInteractions(medicationRequest),

    // CPT/HCPCS codes (with optional billing unit data) stored on the MedicationAdministration
    cptCodes: getCptCodesFromMA(medicationAdministration),

    /**
     * @deprecated Use effectiveDateTime instead. This field is kept for backward compatibility.
     */
    dateGiven: administeredInfo?.dateAdministered,

    /**
     * @deprecated Use effectiveDateTime instead. This field is kept for backward compatibility.
     */
    timeGiven: administeredInfo?.timeAdministered,
  };
}

async function getOrderPackages(
  oystehr: Oystehr,
  searchBy: GetMedicationOrdersInput['searchBy']
): Promise<OrderPackage[] | undefined> {
  const searchParams = [
    {
      name: '_tag',
      value: MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE,
    },
    {
      name: '_include',
      value: 'MedicationAdministration:subject',
    },
    {
      name: '_include',
      value: 'MedicationAdministration:performer',
    },
    {
      name: '_include',
      value: 'MedicationAdministration:request',
    },
    {
      name: '_revinclude',
      value: 'MedicationStatement:part-of',
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

  const resources = bundle.unbundle() as FhirResource[];

  const medicationAdministrations = resources.filter(
    (res) => res.resourceType === 'MedicationAdministration'
  ) as MedicationAdministration[];

  const medicationStatements = resources.filter(
    (res) => res.resourceType === 'MedicationStatement'
  ) as MedicationStatement[];

  console.log('All practitioners: ', JSON.stringify(resources.filter((res) => res.resourceType === 'Practitioner')));
  console.log('All medication statements: ', JSON.stringify(medicationStatements));
  console.log(
    `All orders: ${resources
      .filter((res) => res.resourceType === 'MedicationAdministration')
      .map((ma) => ma.id)
      .join(',\n')}`
  );

  return medicationAdministrations.map((ma) => buildOrderPackage(ma, resources, medicationStatements));
}

/**
 * Assembles one MedicationAdministration with the related resources its DTO mapper reads. Throws when the
 * patient or the ordering practitioner is missing, as the search-based path always has; callers that pool
 * many encounters (the tracking board) catch per order so one bad order does not drop the rest.
 */
export function buildOrderPackage(
  ma: MedicationAdministration,
  resources: FhirResource[],
  medicationStatements: MedicationStatement[] = resources.filter(
    (res): res is MedicationStatement => res.resourceType === 'MedicationStatement'
  )
): OrderPackage {
  const patient = resources.find((res) => res.id === ma.subject.reference?.replace('Patient/', '')) as Patient;
  if (!patient) throw new Error(`No patient was found for order: ${ma.id}`);

  const idOfProviderCreatedOrder = getPractitionerIdThatOrderedMedication(ma);
  const providerCreatedOrder = resources.find((res) => res.id === idOfProviderCreatedOrder) as Practitioner;
  if (!providerCreatedOrder) throw new Error(`No practitioner was found for order: ${ma.id}`);

  const idOfProviderAdministeredOrder = getProviderIdAndDateMedicationWasAdministered(ma)?.administeredProviderId;
  const providerAdministeredOrder = resources.find((res) => res.id === idOfProviderAdministeredOrder) as Practitioner;

  const idOfProviderOrderedBy = getCurrentOrderedByProviderId(ma);
  const providerOrderedBy = idOfProviderOrderedBy
    ? (resources.find((res) => res.id === idOfProviderOrderedBy) as Practitioner)
    : undefined;

  const medicationRequestId = ma.request?.reference?.split('/')[1];
  const medicationRequest = resources.find(
    (resource) => resource.resourceType === 'MedicationRequest' && resource.id === medicationRequestId
  ) as MedicationRequest;

  const relatedMedicationStatement = medicationStatements.find(
    (ms) => ms.partOf?.some((partOf: Reference) => partOf.reference === `MedicationAdministration/${ma.id}`)
  );

  return {
    medicationAdministration: ma,
    patient,
    providerCreatedOrder,
    providerAdministeredOrder,
    providerOrderedBy,
    medicationRequest,
    medicationStatement: relatedMedicationStatement,
  };
}
