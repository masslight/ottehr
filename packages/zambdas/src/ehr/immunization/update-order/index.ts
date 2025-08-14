import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication, MedicationAdministration } from 'fhir/r4b';
import {
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_NDC,
  codeableConcept,
  mapFhirToOrderStatus,
  mapOrderStatusToFhir,
  MEDICATION_ADMINISTRATION_REASON_CODE,
  ottehrExtensionUrl,
  UpdateImmunizationOrderInput,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { updateOrderDetails } from '../common';

let m2mToken: string;

const ZAMBDA_NAME = 'create-immunization-order';
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
    const response = await updateImmunizationOrder(oystehr, validatedParameters, userPractitionerId);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', error);
    console.log('Stringified error: ', JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error creating/updating order: ${JSON.stringify(error)}` }),
    };
  }
});

async function updateImmunizationOrder(
  oystehr: Oystehr,
  input: UpdateImmunizationOrderInput,
  _userPractitionerId: string
): Promise<any> {
  const { orderId, orderDetails, administering } = input; // todo emergencyContact
  const medicationAdministration = await oystehr.fhir.get<MedicationAdministration>({
    resourceType: 'MedicationAdministration',
    id: orderId,
  });

  if (orderDetails) {
    await updateOrderDetails(medicationAdministration, orderDetails, oystehr);
  }

  if (administering) {
    if (medicationAdministration.status !== 'in-progress') {
      const currentStatus = mapFhirToOrderStatus(medicationAdministration);
      throw new Error(
        `Can't change status to "${administering.status}" as current status is not "pending" but "${currentStatus}"`
      );
    }
    medicationAdministration.status = mapOrderStatusToFhir(administering.status);
    if (administering.reason) {
      medicationAdministration.note = [
        {
          authorString: MEDICATION_ADMINISTRATION_REASON_CODE,
          text: administering.reason,
        },
      ];
    }
    // todo create MedicationStatement

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
  }

  return {
    id: medicationAdministration.id,
  };
}

export function validateRequestParameters(
  input: ZambdaInput
): UpdateImmunizationOrderInput & Pick<ZambdaInput, 'secrets'> {
  const { orderId, orderDetails, administering, emergencyContact } = validateJsonBody(input);

  const missingFields: string[] = [];
  if (!orderId) missingFields.push('orderId');
  if (orderDetails) {
    if (!orderDetails.medicationId) missingFields.push('orderDetails.medicationId');
    if (!orderDetails.dose) missingFields.push('orderDetails.dose');
    if (!orderDetails.units) missingFields.push('orderDetails.units');
    if (!orderDetails.orderedProviderId) missingFields.push('orderDetails.orderedProviderId');
  }
  if (administering) {
    if (!administering.status) missingFields.push('administering.status');
    if (!administering.lot) missingFields.push('administering.lot');
    if (!administering.expDate) missingFields.push('administering.expDate');
    if (!administering.mvx) missingFields.push('administering.mvx');
    if (!administering.cvx) missingFields.push('administering.cvx');
    if (!administering.ndc) missingFields.push('administering.ndc');
    if (!administering.administeredDateTime) missingFields.push('administering.administeredDateTime');
    if (!administering.reason && ['administered-partly', 'administered-not'].includes(administering.status)) {
      missingFields.push('administering.reason');
    }
    if (!['administered', 'administered-partly', 'administered-not'].includes(administering.status)) {
      throw new Error(`Unexpected status value "${administering.status}"`);
    }
  }

  if (missingFields.length > 0) throw new Error(`Missing required fields [${missingFields.join(', ')}]`);

  return {
    orderId,
    orderDetails,
    administering,
    emergencyContact,
    secrets: input.secrets,
  };
}
