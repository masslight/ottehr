import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coding, Extension, MedicationAdministration, RelatedPerson } from 'fhir/r4b';
import {
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_NDC,
  getCoding,
  GetImmunizationOrdersInput,
  getMedicationName,
  ImmunizationOrder,
  mapFhirToOrderStatus,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_APPLIANCE_LOCATION_SYSTEM,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
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
  IMMUNIZATION_ORDER_CREATED_DATE_EXTENSION_URL,
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
    console.log('Error: ', error);
    console.log('Stringified error: ', JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error creating order: ${JSON.stringify(error)}` }),
    };
  }
});

async function getImmunizationOrders(
  oystehr: Oystehr,
  input: GetImmunizationOrdersInput
): Promise<ImmunizationOrder[]> {
  const { orderId, patientId } = input;
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
  return (
    await oystehr.fhir.search<MedicationAdministration>({
      resourceType: 'MedicationAdministration',
      params,
    })
  )
    .unbundle()
    .map(mapMedicationAdministrationToImmunizationOrder);
}

export function validateRequestParameters(
  input: ZambdaInput
): GetImmunizationOrdersInput & Pick<ZambdaInput, 'secrets'> {
  const { orderId, patientId } = validateJsonBody(input);

  return {
    orderId,
    patientId,
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
        id: medication?.id ?? '',
        name: medication ? getMedicationName(medication) ?? '' : '',
      },
      dose: medicationAdministration.dosage?.dose?.value?.toString() ?? '',
      units: medicationAdministration.dosage?.dose?.unit ?? '',
      orderedProvider: getProvider(medicationAdministration, PRACTITIONER_ORDERED_BY_MEDICATION_CODE),
      orderedDateTime:
        getDateExtensionValue(medicationAdministration, IMMUNIZATION_ORDER_CREATED_DATE_EXTENSION_URL) ?? '',
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
            visGivenDate: getDateExtensionValue(
              medicationAdministration,
              VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL
            ),
            emergencyContact: emergencyContactReatedPerson
              ? {
                  fullName: emergencyContactReatedPerson.name?.[0].text ?? '',
                  mobile: emergencyContactReatedPerson.telecom?.[0].value ?? '',
                  relationship: '', //todo
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

function getDateExtensionValue(
  medicationAdministration: MedicationAdministration,
  extensionUrl: string
): string | undefined {
  return medicationAdministration.extension?.find((e) => e.url === extensionUrl)?.valueDate;
}
