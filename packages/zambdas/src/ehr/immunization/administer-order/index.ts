import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  FhirResource,
  Medication,
  MedicationAdministration,
  MedicationStatement,
  Practitioner,
  Reference,
  RelatedPerson,
} from 'fhir/r4b';
import {
  AdministerImmunizationOrderInput,
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_NDC,
  codeableConcept,
  createReference,
  getFullName,
  getMedicationName,
  ImmunizationEmergencyContact,
  mapFhirToOrderStatus,
  mapOrderStatusToFhir,
  MEDICATION_ADMINISTRATION_REASON_CODE,
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
const CONTAINED_EMERGENCY_CONTACT_ID = 'emergencyContact';

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
  const medicationAdministration = await oystehr.fhir.get<MedicationAdministration>({
    resourceType: 'MedicationAdministration',
    id: input.orderId,
  });

  if (medicationAdministration.status !== 'in-progress') {
    const currentStatus = mapFhirToOrderStatus(medicationAdministration);
    throw new Error(`Can't administer order in "${currentStatus}" status`);
  }

  await updateOrderDetails(medicationAdministration, input.orderDetails, oystehr);

  medicationAdministration.status = mapOrderStatusToFhir(input.type);

  if (input.reason) {
    medicationAdministration.note = [
      {
        authorString: MEDICATION_ADMINISTRATION_REASON_CODE,
        text: input.reason,
      },
    ];
  }

  const medication = medicationAdministration.contained?.[0] as Medication;
  medication.batch = {
    lotNumber: input.lot,
    expirationDate: input.expDate,
  };
  if (!medication.extension) {
    medication.extension = [];
  }
  medication.extension.push({
    url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
    valueCodeableConcept: codeableConcept(input.mvx, MVX_CODE_SYSTEM_URL),
  });
  medication.extension.push({
    url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
    valueCodeableConcept: codeableConcept(input.cvx, CVX_CODE_SYSTEM_URL),
  });
  medication.extension.push({
    url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
    valueCodeableConcept: codeableConcept(input.ndc, CODE_SYSTEM_NDC),
  });
  if (input.cpt) {
    medication.extension.push({
      url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
      valueCodeableConcept: codeableConcept(input.cpt, CODE_SYSTEM_CPT),
    });
  }
  if (input.visGivenDate) {
    medication.extension.push({
      url: VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL,
      valueDate: input.visGivenDate,
    });
  }

  if (input.emergencyContact) {
    medicationAdministration.contained?.push(
      createEmergencyContactRelatedPerson(medicationAdministration.subject, input.emergencyContact)
    );
    medicationAdministration.supportingInformation = [
      {
        reference: '#' + CONTAINED_EMERGENCY_CONTACT_ID,
      },
    ];
  }

  const transactionRequests: BatchInputRequest<FhirResource>[] = [
    {
      method: 'PUT',
      url: `/MedicationAdministration/${medicationAdministration.id}`,
      resource: medicationAdministration,
    },
  ];

  if (['administered', 'administered-partly'].includes(input.type)) {
    transactionRequests.push({
      method: 'POST',
      url: `/MedicationStatement`,
      resource: createMedicationStatement(medicationAdministration, input.administeredDateTime, userPractitioner),
    });
  }

  console.log('Transaction requests: ', JSON.stringify(transactionRequests));
  const transactionResult = await oystehr.fhir.transaction({ requests: transactionRequests });
  console.log('Transaction result: ', JSON.stringify(transactionResult));

  return {
    message: 'Order was administered',
    id: medicationAdministration.id,
  };
}

export function validateRequestParameters(
  input: ZambdaInput
): AdministerImmunizationOrderInput & Pick<ZambdaInput, 'secrets'> {
  const {
    orderId,
    orderDetails,
    type,
    reason,
    lot,
    expDate,
    mvx,
    cvx,
    cpt,
    ndc,
    administeredDateTime,
    visGivenDate,
    emergencyContact,
  } = validateJsonBody(input);

  const missingFields: string[] = [];
  if (!orderId) missingFields.push('orderId');
  if (!orderDetails.medicationId) missingFields.push('orderDetails.medicationId');
  if (!orderDetails.dose) missingFields.push('orderDetails.dose');
  if (!orderDetails.units) missingFields.push('orderDetails.units');
  if (!orderDetails.orderedProviderId) missingFields.push('orderDetails.orderedProviderId');
  if (!type) missingFields.push('type');
  if (!reason && ['administered-partly', 'administered-not'].includes(type)) {
    missingFields.push('reason');
  }
  if (!lot) missingFields.push('lot');
  if (!expDate) missingFields.push('expDate');
  if (!mvx) missingFields.push('mvx');
  if (!cvx) missingFields.push('cvx');
  if (!ndc) missingFields.push('ndc');
  if (!administeredDateTime) missingFields.push('administeredDateTime');
  if (!visGivenDate && ['administered', 'administered-partly'].includes(type)) {
    missingFields.push('visGivenDate');
  }

  if (missingFields.length > 0) throw new Error(`Missing required fields [${missingFields.join(', ')}]`);

  return {
    orderId,
    orderDetails,
    type,
    reason,
    lot,
    expDate,
    mvx,
    cvx,
    cpt,
    ndc,
    administeredDateTime,
    visGivenDate,
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

function createEmergencyContactRelatedPerson(
  patientReference: Reference,
  emergencyContact: ImmunizationEmergencyContact
): RelatedPerson {
  return {
    resourceType: 'RelatedPerson',
    id: CONTAINED_EMERGENCY_CONTACT_ID,
    patient: patientReference,
    name: [
      {
        text: emergencyContact.fullName,
      },
    ],
    telecom: [
      {
        system: 'phone',
        use: 'mobile',
        value: emergencyContact.mobile,
      },
    ],
    relationship: [{}], //todo
  };
}
