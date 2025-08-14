import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication, MedicationAdministration, MedicationStatement, Practitioner } from 'fhir/r4b';
import {
  AdministerImmunizationOrderInput,
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_NDC,
  codeableConcept,
  createReference,
  getFullName,
  getMedicationName,
  mapFhirToOrderStatus,
  mapOrderStatusToFhir,
  MEDICATION_DISPENSABLE_DRUG_ID,
  ottehrExtensionUrl,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  fillMeta,
  getMyPractitionerId,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { updateOrderDetails } from '../common';

let m2mToken: string;

const ZAMBDA_NAME = 'administer-immunization-order';
const MVX_CODE_SYSTEM_URL = 'http://hl7.org/fhir/sid/mvx';
const CVX_CODE_SYSTEM_URL = 'http://hl7.org/fhir/sid/cvx';
const VACCINE_ADMINISTRATION_CODES_EXTENSION_URL = ottehrExtensionUrl('vaccine-administration-codes');
const VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL = ottehrExtensionUrl('vaccine-administration-vis_date');

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    const userToken = input.headers.Authorization.replace('Bearer ', '');
    const oystehrCurrentUser = createOystehrClient(userToken, validatedParameters.secrets);
    const userPractitionerId = await getMyPractitionerId(oystehrCurrentUser);
    const userPractitioner = await oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: userPractitionerId,
    });
    const response = await administerImmunizationOrder(oystehr, validatedParameters, userPractitioner);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', error);
    console.log('Stringified error: ', JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error updating order: ${JSON.stringify(error)}` }),
    };
  }
});

async function administerImmunizationOrder(
  oystehr: Oystehr,
  input: AdministerImmunizationOrderInput,
  userPractitioner: Practitioner
): Promise<any> {
  const { orderId, orderDetails, administering } = input;

  const medicationAdministration = await oystehr.fhir.get<MedicationAdministration>({
    resourceType: 'MedicationAdministration',
    id: orderId,
  });

  if (medicationAdministration.status !== 'in-progress') {
    const currentStatus = mapFhirToOrderStatus(medicationAdministration);
    throw new Error(`Can't administer order in "${currentStatus}" status`);
  }

  await updateOrderDetails(medicationAdministration, orderDetails, oystehr);

  medicationAdministration.status = mapOrderStatusToFhir('administered');

  const medication = medicationAdministration.contained?.[0] as Medication;
  medication.batch = {
    lotNumber: administering.lot,
    expirationDate: administering.expDate,
  };
  if (!medication.extension) {
    medication.extension = [];
  }
  medication.extension.push({
    url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
    valueCodeableConcept: codeableConcept(administering.mvx, MVX_CODE_SYSTEM_URL),
  });
  medication.extension.push({
    url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
    valueCodeableConcept: codeableConcept(administering.cvx, CVX_CODE_SYSTEM_URL),
  });
  medication.extension.push({
    url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
    valueCodeableConcept: codeableConcept(administering.ndc, CODE_SYSTEM_NDC),
  });
  if (administering.cpt) {
    medication.extension.push({
      url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
      valueCodeableConcept: codeableConcept(administering.cpt, CODE_SYSTEM_CPT),
    });
  }
  if (administering.visGivenDate) {
    medication.extension.push({
      url: VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL,
      valueDate: administering.visGivenDate,
    });
  }

  const _medicationStatement = createMedicationStatement(
    medicationAdministration,
    administering.administeredDateTime,
    userPractitioner
  );

  // todo update medication administraciton and create medication statement

  // todo save emergency contact as medication administration supporting info

  return {
    id: medicationAdministration.id,
  };
}

export function validateRequestParameters(
  input: ZambdaInput
): AdministerImmunizationOrderInput & Pick<ZambdaInput, 'secrets'> {
  const { orderId, orderDetails, administering, emergencyContact } = validateJsonBody(input);

  const missingFields: string[] = [];
  if (!orderId) missingFields.push('orderId');
  if (!orderDetails.medicationId) missingFields.push('orderDetails.medicationId');
  if (!orderDetails.dose) missingFields.push('orderDetails.dose');
  if (!orderDetails.units) missingFields.push('orderDetails.units');
  if (!orderDetails.orderedProviderId) missingFields.push('orderDetails.orderedProviderId');
  if (!administering.lot) missingFields.push('administering.lot');
  if (!administering.expDate) missingFields.push('administering.expDate');
  if (!administering.mvx) missingFields.push('administering.mvx');
  if (!administering.cvx) missingFields.push('administering.cvx');
  if (!administering.ndc) missingFields.push('administering.ndc');
  if (!administering.administeredDateTime) missingFields.push('administering.administeredDateTime');

  if (missingFields.length > 0) throw new Error(`Missing required fields [${missingFields.join(', ')}]`);

  return {
    orderId,
    orderDetails,
    administering,
    emergencyContact,
    secrets: input.secrets,
  };
}

function createMedicationStatement(
  medicationAdministration: MedicationAdministration,
  administeredDateTime: string,
  userPractitioner: Practitioner
): MedicationStatement {
  const medication = medicationAdministration.contained?.[0] as Medication;
  const drugIdCoding = medication.code?.coding?.find((code) => code.system === MEDICATION_DISPENSABLE_DRUG_ID);
  if (!drugIdCoding) throw new Error(`Can't create MedicationStatement for order, Medication don't have drug id`);
  return {
    resourceType: 'MedicationStatement',
    status: 'active',
    partOf: [createReference(medicationAdministration)],
    medicationCodeableConcept: {
      coding: [{ ...drugIdCoding, display: getMedicationName(medication) }],
    },
    dosage: [
      {
        text: medicationAdministration.dosage?.text,
        doseAndRate: [
          {
            doseQuantity: medicationAdministration.dosage?.dose,
          },
        ],
        route: medicationAdministration.dosage?.route,
        site: medicationAdministration.dosage?.site,
      },
    ],
    subject: medicationAdministration.subject,
    informationSource: {
      ...createReference(userPractitioner),
      display: getFullName(userPractitioner),
    },
    effectiveDateTime: administeredDateTime,
    meta: fillMeta('in-house-medication', 'in-house-medication'), //todo use different meta?
  };
}
