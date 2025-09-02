import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coding, Extension, MedicationAdministration, RelatedPerson } from 'fhir/r4b';
import {
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_NDC,
  getCoding,
  GetImmunizationOrdersRequest,
  GetImmunizationOrdersResponse,
  getMedicationName,
  ImmunizationOrder,
  mapFhirToOrderStatus,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_APPLIANCE_LOCATION_SYSTEM,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  VACCINE_ADMINISTRATION_EMERGENCY_CONTACT_RELATIONSHIP_CODE_SYSTEM,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import {
  CONTAINED_EMERGENCY_CONTACT_ID,
  CVX_CODE_SYSTEM_URL,
  getContainedMedication,
  IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL,
  IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL,
  MVX_CODE_SYSTEM_URL,
  VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
  VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL,
} from '../common';

let m2mToken: string;

const ZAMBDA_NAME = 'get-immunization-orders';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    const response = await getImmunizationOrders(oystehr, validatedParameters);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error creating order: ${JSON.stringify(error.message)}` }),
    };
  }
});

export async function getImmunizationOrders(
  oystehr: Oystehr,
  input: GetImmunizationOrdersRequest
): Promise<GetImmunizationOrdersResponse> {
  const { orderId, patientId, encounterId } = input;
  const params: SearchParam[] = [
    {
      name: '_tag',
      value: 'immunization',
    },
  ];
  if (orderId) {
    params.push({
      name: '_id',
      value: orderId,
    });
  }
  if (patientId) {
    params.push({
      name: 'subject',
      value: 'Patient/' + patientId,
    });
  }
  if (encounterId) {
    params.push({
      name: 'context',
      value: 'Encounter/' + encounterId,
    });
  }
  return {
    orders: (
      await oystehr.fhir.search<MedicationAdministration>({
        resourceType: 'MedicationAdministration',
        params,
      })
    )
      .unbundle()
      .map(mapMedicationAdministrationToImmunizationOrder),
  };
}

export function validateRequestParameters(
  input: ZambdaInput
): GetImmunizationOrdersRequest & Pick<ZambdaInput, 'secrets'> {
  const { orderId, patientId, encounterId } = validateJsonBody(input);

  if (!orderId && !patientId && !encounterId) {
    throw new Error(`orderId or patientId or encounterId must be provided`);
  }

  return {
    orderId,
    patientId,
    encounterId,
    secrets: input.secrets,
  };
}

function mapMedicationAdministrationToImmunizationOrder(
  medicationAdministration: MedicationAdministration
): ImmunizationOrder {
  const status = mapFhirToOrderStatus(medicationAdministration) ?? '';
  const isAdministered = ['administered', 'administered-partly', 'administered-not'].includes(status);
  const medication = getContainedMedication(medicationAdministration);
  const administrationCodesExtensions = (medicationAdministration.extension ?? []).filter(
    (extension) => extension.url === VACCINE_ADMINISTRATION_CODES_EXTENSION_URL
  );
  const emergencyContactReatedPerson = medicationAdministration.contained?.find(
    (resource) => resource.id === CONTAINED_EMERGENCY_CONTACT_ID
  ) as RelatedPerson;
  return {
    id: medicationAdministration.id!,
    status: status,
    reason: medicationAdministration.note?.[0].text,
    details: {
      medication: {
        id:
          medication?.extension?.find((e) => e.url === IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL)?.valueString ??
          '',
        name: getMedicationName(medication) ?? '',
      },
      dose: medicationAdministration.dosage?.dose?.value?.toString() ?? '',
      units: medicationAdministration.dosage?.dose?.unit ?? '',
      orderedProvider: getProvider(medicationAdministration, PRACTITIONER_ORDERED_BY_MEDICATION_CODE),
      orderedDateTime:
        medicationAdministration.extension?.find((e) => e.url === IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL)
          ?.valueDateTime ?? '',
      route: getCoding(medicationAdministration.dosage?.route, MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM)?.code,
      location: getCoding(medicationAdministration.dosage?.site, MEDICATION_APPLIANCE_LOCATION_SYSTEM)?.code,
      instructions: medicationAdministration.dosage?.text,
    },
    administrationDetails:
      isAdministered && medication
        ? {
            lot: medication.batch?.lotNumber ?? '',
            expDate: medication.batch?.expirationDate ?? '',
            mvx: findCoding(administrationCodesExtensions, MVX_CODE_SYSTEM_URL)?.code ?? '',
            cvx: findCoding(administrationCodesExtensions, CVX_CODE_SYSTEM_URL)?.code ?? '',
            cpt: findCoding(administrationCodesExtensions, CODE_SYSTEM_CPT)?.code,
            ndc: findCoding(administrationCodesExtensions, CODE_SYSTEM_NDC)?.code ?? '',
            administeredProvider: getProvider(medicationAdministration, PRACTITIONER_ADMINISTERED_MEDICATION_CODE),
            administeredDateTime: medicationAdministration.effectiveDateTime ?? '',
            visGivenDate: medicationAdministration.extension?.find(
              (e) => e.url === VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL
            )?.valueDate,
            emergencyContact: emergencyContactReatedPerson
              ? {
                  fullName: emergencyContactReatedPerson.name?.[0].text ?? '',
                  mobile: emergencyContactReatedPerson.telecom?.[0].value ?? '',
                  relationship:
                    getCoding(
                      emergencyContactReatedPerson.relationship,
                      VACCINE_ADMINISTRATION_EMERGENCY_CONTACT_RELATIONSHIP_CODE_SYSTEM
                    )?.code ?? '',
                }
              : undefined,
          }
        : undefined,
  };
}

function findCoding(extensions: Extension[], system: string): Coding | undefined {
  for (const extension of extensions) {
    const coding = getCoding(extension.valueCodeableConcept, system);
    if (coding) {
      return coding;
    }
  }
  return undefined;
}

function getProvider(medicationAdministration: MedicationAdministration, code: string): { id: string; name: string } {
  const reference = medicationAdministration.performer?.find(
    (performer) => getCoding(performer.function, MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM)?.code === code
  )?.actor;
  return {
    id: reference?.reference?.split('/')[1] ?? '',
    name: reference?.display ?? '',
  };
}
