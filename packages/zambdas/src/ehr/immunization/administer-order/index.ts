import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  FhirResource,
  Medication,
  MedicationAdministration,
  MedicationStatement,
  Practitioner,
  Procedure,
  Reference,
  RelatedPerson,
} from 'fhir/r4b';
import {
  AdministerImmunizationOrderRequest,
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_NDC,
  codeableConcept,
  createReference,
  CreateUpdateImmunizationOrderResponse,
  CVX_CODE_SYSTEM_URL,
  EMERGENCY_CONTACT_RELATIONSHIPS,
  getFullName,
  getMedicationName,
  getSecret,
  ImmunizationEmergencyContact,
  mapFhirToOrderStatus,
  mapOrderStatusToFhir,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_REASON_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MVX_CODE_SYSTEM_URL,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  SecretsKeys,
  VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
  VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  fillMeta,
  getMyPractitionerId,
  topLevelCatch,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import {
  CONTAINED_EMERGENCY_CONTACT_ID,
  CONTAINED_MEDICATION_ID,
  getContainedMedication,
  updateOrderDetails,
  validateOrderDetails,
} from '../common';

let m2mToken: string;

const ZAMBDA_NAME = 'administer-immunization-order';

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
    console.log('Error: ', JSON.stringify(error.message));
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

async function administerImmunizationOrder(
  oystehr: Oystehr,
  input: AdministerImmunizationOrderRequest,
  userPractitioner: Practitioner
): Promise<CreateUpdateImmunizationOrderResponse> {
  const { orderId, type, reason, details, administrationDetails } = input;
  const medicationAdministration = await oystehr.fhir.get<MedicationAdministration>({
    resourceType: 'MedicationAdministration',
    id: orderId,
  });

  const allowedStatuses = ['in-progress', 'completed', 'stopped'];
  if (!allowedStatuses.includes(medicationAdministration.status)) {
    const currentStatus = mapFhirToOrderStatus(medicationAdministration);
    throw new Error(`Can't administer order in "${currentStatus}" status`);
  }

  await updateOrderDetails(medicationAdministration, details, oystehr);

  medicationAdministration.status = mapOrderStatusToFhir(type);
  medicationAdministration.effectiveDateTime = administrationDetails.administeredDateTime;

  if (reason) {
    medicationAdministration.note = [
      {
        authorString: MEDICATION_ADMINISTRATION_REASON_CODE,
        text: reason,
      },
    ];
  }

  medicationAdministration.performer?.push({
    actor: {
      reference: `Practitioner/${userPractitioner.id}`,
      display: getFullName(userPractitioner),
    },
    function: {
      coding: [
        {
          system: MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
          code: PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
        },
      ],
    },
  });

  if (administrationDetails.emergencyContact) {
    medicationAdministration.contained?.push(
      createEmergencyContactRelatedPerson(medicationAdministration.subject, administrationDetails.emergencyContact)
    );
    medicationAdministration.supportingInformation = [
      {
        reference: '#' + CONTAINED_EMERGENCY_CONTACT_ID,
      },
    ];
  }

  const medication = getContainedMedication(medicationAdministration);
  if (!medication) {
    throw new Error('Contained Medication is missing');
  }

  if (administrationDetails.lot || administrationDetails.expDate) {
    medication.batch = {
      lotNumber: administrationDetails.lot,
      expirationDate: administrationDetails.expDate,
    };
  }

  // Clear existing administration extensions before re-adding to support edits
  medication.extension = (medication.extension ?? []).filter(
    (ext) =>
      ext.url !== VACCINE_ADMINISTRATION_CODES_EXTENSION_URL &&
      ext.url !== VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL
  );

  medication.extension.push({
    url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
    valueCodeableConcept: codeableConcept(administrationDetails.mvx, MVX_CODE_SYSTEM_URL),
  });
  medication.extension?.push({
    url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
    valueCodeableConcept: codeableConcept(administrationDetails.cvx, CVX_CODE_SYSTEM_URL),
  });
  medication.extension?.push({
    url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
    valueCodeableConcept: codeableConcept(administrationDetails.ndc, CODE_SYSTEM_NDC),
  });
  if (administrationDetails.cptCodes && administrationDetails.cptCodes.length > 0) {
    for (const cptCode of administrationDetails.cptCodes) {
      medication.extension?.push({
        url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
        valueCodeableConcept: {
          coding: [{ code: cptCode.code, system: CODE_SYSTEM_CPT, display: cptCode.display }],
        },
      });
    }
  }
  if (administrationDetails.visGivenDate) {
    medication.extension?.push({
      url: VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL,
      valueDate: administrationDetails.visGivenDate,
    });
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
      resource: createMedicationStatement(
        medicationAdministration,
        medication,
        administrationDetails.administeredDateTime,
        userPractitioner
      ),
    });
  }

  console.log('Transaction requests: ', JSON.stringify(transactionRequests));
  const transactionResult = await oystehr.fhir.transaction({ requests: transactionRequests });
  console.log('Transaction result: ', JSON.stringify(transactionResult));

  // Add CPT codes to chart data (assessment) on administration
  if (['administered', 'administered-partly'].includes(input.type)) {
    const cptCodesToAdd = administrationDetails.cptCodes ?? [];
    if (cptCodesToAdd.length > 0) {
      const encounterId = medicationAdministration.context?.reference?.replace('Encounter/', '');
      const patientId = medicationAdministration.subject?.reference?.replace('Patient/', '');
      if (encounterId && patientId) {
        try {
          // Search for existing CPT code Procedures on this encounter
          const existingProcedures = (
            await oystehr.fhir.search<Procedure>({
              resourceType: 'Procedure',
              params: [
                { name: 'encounter', value: `Encounter/${encounterId}` },
                { name: '_tag', value: 'cpt-code' },
              ],
            })
          ).unbundle();
          const existingCodes = existingProcedures.map((p) => p.code?.coding?.[0]?.code).filter(Boolean);
          const newCodes = cptCodesToAdd.filter((c) => !existingCodes.includes(c.code));

          for (const cptCode of newCodes) {
            await oystehr.fhir.create<Procedure>({
              resourceType: 'Procedure',
              subject: { reference: `Patient/${patientId}` },
              encounter: { reference: `Encounter/${encounterId}` },
              status: 'completed',
              code: {
                coding: [{ code: cptCode.code, display: cptCode.display, system: 'http://www.ama-assn.org/go/cpt' }],
              },
              meta: {
                tag: [{ code: 'cpt-code', system: 'https://fhir.zapehr.com/r4/StructureDefinitions/cpt-code' }],
              },
            });
          }
          if (newCodes.length > 0) {
            console.log('Added CPT codes to chart data:', newCodes.map((c) => c.code).join(', '));
          }
        } catch (e) {
          console.error('Failed to add CPT codes to chart data:', e);
        }
      }
    }
  }

  return {
    orderId: medicationAdministration.id!,
  };
}

export function validateRequestParameters(
  input: ZambdaInput
): AdministerImmunizationOrderRequest & Pick<ZambdaInput, 'secrets'> {
  const { orderId, type, reason, details, administrationDetails } = validateJsonBody(input);

  const missingFields: string[] = [];
  if (!orderId) missingFields.push('orderId');
  if (!type) missingFields.push('type');
  if (!reason && ['administered-partly', 'administered-not'].includes(type)) {
    missingFields.push('reason');
  }

  missingFields.push(...validateOrderDetails(details));

  if (['administered', 'administered-partly'].includes(type)) {
    if (!administrationDetails?.mvx) missingFields.push('administrationDetails.mvx');
    if (!administrationDetails?.cvx) missingFields.push('administrationDetails.cvx');
    if (!administrationDetails?.ndc) missingFields.push('administrationDetails.ndc');
    if (!administrationDetails?.lot) missingFields.push('administrationDetails.lot');
    if (!administrationDetails?.expDate) missingFields.push('administrationDetails.expDate');
    if (!administrationDetails?.administeredDateTime) missingFields.push('administrationDetails.administeredDateTime');
    if (!administrationDetails?.visGivenDate) {
      missingFields.push('administrationDetails.visGivenDate');
    }
  }

  if (missingFields.length > 0) throw new Error(`Missing required fields [${missingFields.join(', ')}]`);

  return {
    orderId,
    type,
    reason,
    details,
    administrationDetails,
    secrets: input.secrets,
  };
}

function createMedicationStatement(
  medicationAdministration: MedicationAdministration,
  medication: Medication,
  administeredDateTime: string,
  userPractitioner: Practitioner
): MedicationStatement {
  const drugIdCoding = medication.code?.coding?.find((code) => code.system === MEDICATION_DISPENSABLE_DRUG_ID);
  return {
    resourceType: 'MedicationStatement',
    status: 'active',
    partOf: [createReference(medicationAdministration)],
    medicationReference: drugIdCoding ? undefined : { reference: '#' + CONTAINED_MEDICATION_ID },
    medicationCodeableConcept: drugIdCoding
      ? {
          coding: [{ ...drugIdCoding, display: getMedicationName(medication) }],
        }
      : undefined,
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
    meta: fillMeta('immunization', 'immunization'),
    contained: drugIdCoding ? undefined : [medication],
  };
}

function createEmergencyContactRelatedPerson(
  patientReference: Reference,
  emergencyContact: ImmunizationEmergencyContact
): RelatedPerson {
  const relationshipCoding = EMERGENCY_CONTACT_RELATIONSHIPS.find(
    (relationship) => relationship.code === emergencyContact.relationship
  );
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
    relationship: relationshipCoding
      ? [
          {
            coding: [
              {
                system: relationshipCoding.system,
                code: relationshipCoding.code,
                display: relationshipCoding.display,
              },
            ],
          },
        ]
      : undefined,
  };
}
