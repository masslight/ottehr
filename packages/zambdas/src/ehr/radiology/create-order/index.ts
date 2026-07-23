import Oystehr, { BatchInputPutRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CodeableConcept,
  ContactPoint,
  Encounter,
  Extension,
  HumanName,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  Reference,
  ServiceRequest,
} from 'fhir/r4b';
import { ServiceRequest as ServiceRequestR5 } from 'fhir/r5';
import { DateTime } from 'luxon';
import randomstring from 'randomstring';
import {
  ACCESSION_NUMBER_CODE_SYSTEM,
  ADVAPACS_FHIR_BASE_URL,
  CPTCodeDTO,
  CreateRadiologyZambdaOrderInput,
  CreateRadiologyZambdaOrderOutput,
  FHIR_EXTENSION,
  FILLER_ORDER_NUMBER_CODE_SYSTEM,
  getAdvaPACSLocationForAppointmentOrEncounter,
  getSecret,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM_FILLER_ORDER_NUMBER,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM_PLACER_ORDER_NUMBER,
  ORDER_TYPE_CODE_SYSTEM,
  PLACER_ORDER_NUMBER_CODE_SYSTEM,
  RADIOLOGY_PERFORMING_ORGANIZATION_CONTAINED_ID,
  RadiologyPerformingOrganization,
  RadiologySafetyFlag,
  Secrets,
  SecretsKeys,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL,
  SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL,
  userMe,
} from 'utils';
import {
  assertPractitionerHasNPI,
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  fillMeta,
  makeCPTCodeDTO,
  makeCptModifierExtension,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateInput, validateSecrets } from './validation';

// Types
export interface ValidatedICD10Code {
  code: string;
  display: string;
  system: string;
}

export interface ValidatedCPTCode {
  code: string;
  display: string;
  system: string;
}

export interface ValidatedInput {
  body: EnhancedBody;
  callerAccessToken: string;
}

export interface EnhancedBody
  extends Omit<CreateRadiologyZambdaOrderInput, 'encounterId' | 'diagnosisCodes' | 'cptCode' | 'clinicalHistory'> {
  encounter: Encounter;
  diagnoses: ValidatedICD10Code[];
  cpt: ValidatedCPTCode;
  // Normalized during validation: absent clinical history becomes ''.
  clinicalHistory: string;
}

// Constants
// cSpell:disable-next date format
const DATE_FORMAT = 'yyyyMMddhhmmssuu';
const PERSON_IDENTIFIER_CODE_SYSTEM = 'https://fhir.ottehr.com/Identifier/person-uuid';
const ADVAPACS_ORDER_DETAIL_MODALITY_CODE_SYSTEM_URL =
  'http://advapacs.com/fhir/servicerequest-orderdetail-parameter-code';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'create-radiology-order';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log('Input body and headers', unsafeInput.body, unsafeInput.headers);

  const secrets = validateSecrets(unsafeInput.secrets);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const validatedInput = await validateInput(unsafeInput, oystehr);

  const callerUser = await userMe(validatedInput.callerAccessToken, secrets);

  const output = await performEffect(validatedInput, callerUser.profile, secrets, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(output),
  };
});

const performEffect = async (
  validatedInput: ValidatedInput,
  practitionerRelativeReference: string,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<CreateRadiologyZambdaOrderOutput> => {
  const { body } = validatedInput;

  // Grab the practitioner
  const ourPractitioner = await oystehr.fhir.get<Practitioner>({
    resourceType: 'Practitioner',
    id: practitionerRelativeReference.split('/')[1],
  });

  // Ordering imaging is an NPI-gated action — block callers without an NPI (e.g. Clinician role).
  assertPractitionerHasNPI(ourPractitioner);

  // Create the order in FHIR
  const ourServiceRequest = await writeOurServiceRequest(body, practitionerRelativeReference, oystehr);
  if (!ourServiceRequest.id) {
    throw new Error('Error creating service request, id is missing');
  }

  const { cptCodeDTO, procedure } = await writeOurProcedure(ourServiceRequest, body, secrets, oystehr);
  const cptCodesSaved = cptCodeDTO ? [cptCodeDTO] : undefined;

  // External (print-only) orders are documented locally and printed/faxed — never transmitted to AdvaPACS.
  if (!body.external) {
    // Grab advapacs location id from schedule owner extension if any
    const advaPACSLocationId = await getAdvaPACSLocationForAppointmentOrEncounter(
      { encounterId: body.encounter.id },
      oystehr
    );

    // Send the order to AdvaPACS
    try {
      await writeAdvaPacsTransaction(ourServiceRequest, ourPractitioner, advaPACSLocationId, secrets, oystehr);
    } catch (error) {
      captureException(error);
      console.error('Error sending order to AdvaPACS: ', error);
      await rollbackOurServiceRequest(ourServiceRequest, oystehr);
      await rollbackOurProcedure(procedure, oystehr);
      // The order no longer exists — surface the failure instead of returning its id as a success.
      throw error;
    }
  }

  return {
    serviceRequestId: ourServiceRequest.id,
    cptCodesSaved,
  };
};

// Validated fields needed to build the mutable content of a radiology ServiceRequest.
// Shared by create-order and update-order so both stay consistent.
export interface RadiologyOrderContentInput {
  diagnoses: ValidatedICD10Code[];
  cpt: ValidatedCPTCode;
  lateralityModifier?: { display: string; code: string };
  stat: boolean;
  clinicalHistory: string;
  studyName?: string;
  consentObtained: boolean;
  external?: boolean;
  performingOrganization?: RadiologyPerformingOrganization;
  timeWindow?: string;
  safetyFlags?: RadiologySafetyFlag[];
}

export interface RadiologyOrderContent {
  code: CodeableConcept;
  priority: 'routine' | 'stat';
  reasonCode: CodeableConcept[];
  orderDetail: CodeableConcept[];
  contained?: Organization[];
  performer?: Reference[];
  /** all managed extensions except the requested-time extension (which is set once at create time) */
  contentExtensions: Extension[];
}

// AdvaPACS-oriented order-detail parameters, stored as nested pre-release extensions.
const makeOrderDetailExtension = (code: string, valueString: string): Extension => ({
  url: SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL,
  extension: [
    {
      url: SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL,
      extension: [
        {
          url: SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL,
          valueCodeableConcept: {
            coding: [{ system: ADVAPACS_ORDER_DETAIL_MODALITY_CODE_SYSTEM_URL, code }],
          },
        },
        {
          url: SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL,
          valueString,
        },
      ],
    },
  ],
});

export const buildRadiologyOrderContent = (input: RadiologyOrderContentInput): RadiologyOrderContent => {
  const {
    diagnoses,
    cpt,
    lateralityModifier,
    stat,
    clinicalHistory,
    studyName,
    consentObtained,
    external,
    performingOrganization,
    timeWindow,
    safetyFlags,
  } = input;

  const srCodeCoding = lateralityModifier
    ? {
        code: `${cpt.code}-${lateralityModifier.code}`,
        display: `${cpt.display} - ${lateralityModifier.display}`,
        system: cpt.system,
      }
    : cpt;

  const contentExtensions: Extension[] = [makeOrderDetailExtension('modality', 'DX')];
  if (clinicalHistory) {
    contentExtensions.push(makeOrderDetailExtension('clinical-history', clinicalHistory));
  }
  contentExtensions.push(
    makeOrderDetailExtension('requested-procedure-description', studyName ?? srCodeCoding.display)
  );
  contentExtensions.push({ url: FHIR_EXTENSION.ServiceRequest.consentObtained.url, valueBoolean: consentObtained });

  if (external) {
    contentExtensions.push({ url: FHIR_EXTENSION.ServiceRequest.externalRadiologyOrder.url, valueBoolean: true });
    if (timeWindow) {
      contentExtensions.push({ url: FHIR_EXTENSION.ServiceRequest.radiologyTimeWindow.url, valueString: timeWindow });
    }
    (safetyFlags ?? []).forEach((flag) => {
      contentExtensions.push({ url: FHIR_EXTENSION.ServiceRequest.radiologySafetyFlag.url, valueCode: flag });
    });
  }

  // Free-text performing organization is stored as a contained resource referenced by `performer`.
  let performingOrg: Organization | undefined;
  if (external && performingOrganization) {
    const telecom: ContactPoint[] = [];
    if (performingOrganization.phone) {
      telecom.push({ system: 'phone', value: performingOrganization.phone });
    }
    if (performingOrganization.fax) {
      telecom.push({ system: 'fax', value: performingOrganization.fax });
    }
    performingOrg = {
      resourceType: 'Organization',
      id: RADIOLOGY_PERFORMING_ORGANIZATION_CONTAINED_ID,
      name: performingOrganization.name,
      address: performingOrganization.address ? [{ text: performingOrganization.address }] : undefined,
      telecom: telecom.length > 0 ? telecom : undefined,
    };
  }

  return {
    code: { coding: [srCodeCoding] },
    priority: stat ? 'stat' : 'routine',
    reasonCode: diagnoses.map((diagnosis) => ({ coding: [diagnosis] })),
    orderDetail: [{ coding: [{ system: 'http://dicom.nema.org/resources/ontology/DCM', code: 'DX' }] }],
    contained: performingOrg ? [performingOrg] : undefined,
    performer: performingOrg ? [{ reference: `#${RADIOLOGY_PERFORMING_ORGANIZATION_CONTAINED_ID}` }] : undefined,
    contentExtensions,
  };
};

const writeOurServiceRequest = (
  validatedBody: EnhancedBody,
  practitionerRelativeReference: string,
  oystehr: Oystehr
): Promise<ServiceRequest> => {
  const { encounter } = validatedBody;
  const now = DateTime.now();

  const content = buildRadiologyOrderContent(validatedBody);

  const fillerAndPlacerOrderNumber = randomstring.generate({
    length: 22,
    charset: 'alphanumeric',
    capitalization: 'uppercase',
  });

  const serviceRequest: ServiceRequest = {
    resourceType: 'ServiceRequest',
    meta: {
      tag: [
        {
          system: ORDER_TYPE_CODE_SYSTEM,
          code: 'radiology',
        },
      ],
    },
    status: 'active',
    intent: 'order',
    identifier: [
      {
        type: {
          coding: [
            {
              system: HL7_IDENTIFIER_TYPE_CODE_SYSTEM,
              code: HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER,
            },
          ],
        },
        system: ACCESSION_NUMBER_CODE_SYSTEM,
        value: now.toFormat(DATE_FORMAT),
      },
      {
        type: {
          coding: [
            {
              system: HL7_IDENTIFIER_TYPE_CODE_SYSTEM,
              code: HL7_IDENTIFIER_TYPE_CODE_SYSTEM_PLACER_ORDER_NUMBER,
            },
          ],
        },
        system: PLACER_ORDER_NUMBER_CODE_SYSTEM,
        value: fillerAndPlacerOrderNumber,
      },
      {
        type: {
          coding: [
            {
              system: HL7_IDENTIFIER_TYPE_CODE_SYSTEM,
              code: HL7_IDENTIFIER_TYPE_CODE_SYSTEM_FILLER_ORDER_NUMBER,
            },
          ],
        },
        system: FILLER_ORDER_NUMBER_CODE_SYSTEM,
        value: fillerAndPlacerOrderNumber,
      },
    ],
    category: [
      {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '363679005',
            display: 'Imaging',
          },
        ],
      },
    ],
    subject: {
      reference: encounter.subject?.reference,
    },
    encounter: {
      reference: `Encounter/${encounter.id}`,
    },
    requester: {
      reference: practitionerRelativeReference,
    },
    priority: content.priority,
    code: content.code,
    orderDetail: content.orderDetail,
    reasonCode: content.reasonCode,
    authoredOn: now.toISO(),
    occurrenceDateTime: now.toISO(),
    contained: content.contained,
    performer: content.performer,
    extension: [
      ...content.contentExtensions,
      { url: SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL, valueDateTime: now.toISO() },
    ],
  };

  return oystehr.fhir.create<ServiceRequest>(serviceRequest);
};

// This Procedure holds the CPT code for billing purposes
const writeOurProcedure = async (
  ourServiceRequest: ServiceRequest,
  validatedBody: EnhancedBody,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<{ cptCodeDTO: CPTCodeDTO | undefined; procedure: Procedure }> => {
  const { cpt, lateralityModifier } = validatedBody;

  const modifierExtension = lateralityModifier ? { extension: [makeCptModifierExtension([lateralityModifier])] } : {};

  const procedureCode = {
    coding: [
      {
        ...cpt,
        ...modifierExtension,
      },
    ],
  };

  const procedureConfig: Procedure = {
    resourceType: 'Procedure',
    status: 'completed',
    subject: ourServiceRequest.subject,
    encounter: ourServiceRequest.encounter,
    // Ties this billing Procedure to its order so update-order can keep the CPT in sync on edit.
    basedOn: [{ reference: `ServiceRequest/${ourServiceRequest.id}` }],
    // ServiceRequest.performer, when present, references the contained external performing Organization —
    // not a valid actor for this billing Procedure — so it is intentionally not copied here.
    code: procedureCode,
    meta: fillMeta('cpt-code', 'cpt-code'), // This is necessary to get the Assessment part of the chart showing the CPT codes. It is some kind of save-chart-data feature that this meta is used to find and save the CPT codes instead of just looking at the FHIR Procedure resources code values.
  };

  const fhirProcedure = await oystehr.fhir.create<Procedure>(procedureConfig);
  console.log(`cpt code procedure successfully created: Procedure/${fhirProcedure.id}`);

  const cptCodeDTO = makeCPTCodeDTO(fhirProcedure);

  return { cptCodeDTO, procedure: fhirProcedure };
};

const getOrderDetailValue = (serviceRequest: ServiceRequest, code: string): string | undefined =>
  serviceRequest.extension
    ?.filter((ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL)
    ?.find((orderDetailExt) => {
      const parameterExt = orderDetailExt.extension?.find(
        (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL
      );
      const codeExt = parameterExt?.extension?.find(
        (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL
      );
      return codeExt?.valueCodeableConcept?.coding?.[0]?.code === code;
    })
    ?.extension?.find((ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL)
    ?.extension?.find((ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL)
    ?.valueString;

const writeAdvaPacsTransaction = async (
  ourServiceRequest: ServiceRequest,
  ourPractitioner: Practitioner,
  advaPACSLocationId: string | undefined,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<void> => {
  try {
    const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
    const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
    const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;

    const ourPatient = await getOurSubject(ourServiceRequest.subject?.reference || '', oystehr);
    const ourPatientId = ourPatient.id;
    const ourRequestingPractitionerId = ourServiceRequest.requester?.reference?.split('/')[1];

    // Advapacs supports only a single name: send first official if there is one otherwise grab the first
    const bestNameToSendForActor = (resource: Patient | Practitioner): HumanName[] | undefined => {
      let nameToSend: HumanName[] | undefined = resource.name;
      if (resource.name && resource.name.length > 0) {
        const officialName = resource.name.find((name) => name.use === 'official');
        nameToSend = officialName ? [officialName] : [resource.name[0]];
      }
      return nameToSend;
    };

    const patientToCreate: BatchInputPutRequest<Patient> = {
      method: 'PUT',
      url: `Patient?identifier=${PERSON_IDENTIFIER_CODE_SYSTEM}|${ourPatientId}`,
      resource: {
        resourceType: 'Patient',
        identifier: [
          {
            system: PERSON_IDENTIFIER_CODE_SYSTEM,
            value: ourPatientId,
          },
        ],
        name: bestNameToSendForActor(ourPatient),
        birthDate: ourPatient.birthDate,
        gender: ourPatient.gender,
      },
    };

    const requestingPractitionerToCreate: BatchInputPutRequest<Practitioner> = {
      method: 'PUT',
      url: `Practitioner?identifier=${PERSON_IDENTIFIER_CODE_SYSTEM}|${ourRequestingPractitionerId}`,
      resource: {
        resourceType: 'Practitioner',
        identifier: [
          {
            system: PERSON_IDENTIFIER_CODE_SYSTEM,
            value: ourRequestingPractitionerId,
          },
        ],
        name: bestNameToSendForActor(ourPractitioner),
        birthDate: ourPractitioner.birthDate,
        gender: ourPractitioner.gender,
      },
    };

    const serviceRequestToCreate: BatchInputPutRequest<ServiceRequestR5> = {
      method: 'PUT',
      url: `ServiceRequest?identifier=${ACCESSION_NUMBER_CODE_SYSTEM}|${ourServiceRequest.identifier?.[0].value}`,
      resource: {
        resourceType: 'ServiceRequest',
        status: ourServiceRequest.status,
        identifier: ourServiceRequest.identifier as any, // Identifier is the same in R4B and R5 so this is safe
        intent: ourServiceRequest.intent,
        subject: {
          identifier: {
            system: PERSON_IDENTIFIER_CODE_SYSTEM,
            value: ourPatientId,
          },
        },
        requester: {
          identifier: {
            system: PERSON_IDENTIFIER_CODE_SYSTEM,
            value: ourRequestingPractitionerId,
          },
        },
        code: {
          concept: ourServiceRequest.code as any, // CodeableConcept is the same in R4B and R5 so this is safe
        },
        orderDetail: [
          // we build R5 orderDetail from extensions we store in our R4B SR.orderDetail
          {
            parameter: [
              {
                code: {
                  coding: [
                    {
                      system: ADVAPACS_ORDER_DETAIL_MODALITY_CODE_SYSTEM_URL,
                      code: 'modality',
                    },
                  ],
                },
                valueString: getOrderDetailValue(ourServiceRequest, 'modality'),
              },
              {
                code: {
                  coding: [
                    {
                      system: ADVAPACS_ORDER_DETAIL_MODALITY_CODE_SYSTEM_URL,
                      code: 'clinical-history',
                    },
                  ],
                },
                valueString: getOrderDetailValue(ourServiceRequest, 'clinical-history'),
              },
              {
                code: {
                  coding: [
                    {
                      system: ADVAPACS_ORDER_DETAIL_MODALITY_CODE_SYSTEM_URL,
                      code: 'requested-procedure-description',
                    },
                  ],
                },
                valueString: getOrderDetailValue(ourServiceRequest, 'requested-procedure-description'),
              },
            ],
          },
        ],
        authoredOn: ourServiceRequest.authoredOn,
        occurrenceDateTime: ourServiceRequest.occurrenceDateTime,
        location: advaPACSLocationId
          ? [
              {
                reference: {
                  reference: `Location/${advaPACSLocationId}`,
                },
              },
            ]
          : undefined,
      },
    };

    const advaPacsTransactionRequest = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [patientToCreate, requestingPractitionerToCreate, serviceRequestToCreate].map((request) => {
        return {
          resource: {
            ...request.resource,
          },
          request: {
            method: request.method,
            url: request.url,
          },
        };
      }),
    };

    console.log(JSON.stringify(advaPacsTransactionRequest));

    const advapacsResponse = await fetch(ADVAPACS_FHIR_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json',
        Authorization: advapacsAuthString,
      },
      body: JSON.stringify(advaPacsTransactionRequest),
    });
    if (!advapacsResponse.ok) {
      throw new Error(
        `advapacs transaction errored out with statusCode ${advapacsResponse.status}, status text ${
          advapacsResponse.statusText
        }, and body ${JSON.stringify(await advapacsResponse.json(), null, 2)}`
      );
    }

    // TODO need to check out the response bundle for any reason?
    // await advapacsResponse.json();
  } catch (error) {
    console.log('write transaction to advapacs error: ', error);
    throw error;
  }
};

const getOurSubject = async (patientRelativeReference: string, oystehr: Oystehr): Promise<Patient> => {
  try {
    return await oystehr.fhir.get<Patient>({
      resourceType: 'Patient',
      id: patientRelativeReference.split('/')[1],
    });
  } catch {
    throw new Error('Error while trying to fetch our subject patient');
  }
};

const rollbackOurServiceRequest = async (ourServiceRequest: ServiceRequest, oystehr: Oystehr): Promise<void> => {
  console.log('rolling back our service request');

  if (!ourServiceRequest.id) {
    throw new Error('rollbackOurServiceRequest: ServiceRequest id is missing');
  }

  await oystehr.fhir.delete<ServiceRequest>({
    resourceType: 'ServiceRequest',
    id: ourServiceRequest.id,
  });
};

const rollbackOurProcedure = async (procedure: Procedure, oystehr: Oystehr): Promise<void> => {
  console.log('rolling back our cpt code procedure');

  if (!procedure.id) {
    throw new Error('rollbackOurProcedure: Procedure id is missing');
  }

  await oystehr.fhir.delete<Procedure>({
    resourceType: 'Procedure',
    id: procedure.id,
  });
};
