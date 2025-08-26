import Oystehr, { BatchInputPutRequest, User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Patient, Practitioner, Procedure, ServiceRequest } from 'fhir/r4b';
import { ServiceRequest as ServiceRequestR5 } from 'fhir/r5';
import { DateTime } from 'luxon';
import randomstring from 'randomstring';
import {
  CreateRadiologyZambdaOrderInput,
  CreateRadiologyZambdaOrderOutput,
  getSecret,
  RoleType,
  Secrets,
  SecretsKeys,
  userMe,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, fillMeta, wrapHandler, ZambdaInput } from '../../../shared';
import {
  ACCESSION_NUMBER_CODE_SYSTEM,
  ADVAPACS_FHIR_BASE_URL,
  FILLER_ORDER_NUMBER_CODE_SYSTEM,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM_FILLER_ORDER_NUMBER,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM_PLACER_ORDER_NUMBER,
  ORDER_TYPE_CODE_SYSTEM,
  PLACER_ORDER_NUMBER_CODE_SYSTEM,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL,
  SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL,
} from '../shared';
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
  extends Omit<CreateRadiologyZambdaOrderInput, 'encounterId' | 'diagnosisCode' | 'cptCode'> {
  encounter: Encounter;
  diagnosis: ValidatedICD10Code;
  cpt: ValidatedCPTCode;
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
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const validatedInput = await validateInput(unsafeInput, secrets, oystehr);

    const callerUser = await getCallerUserWithAccessToken(validatedInput.callerAccessToken, secrets);
    await accessCheck(callerUser);

    const output = await performEffect(validatedInput, callerUser.profile, secrets, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify({ output }),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
});

const accessCheck = async (callerUser: User): Promise<void> => {
  if (callerUser.profile.indexOf('Practitioner/') === -1) {
    throw new Error('Caller does not have a practitioner profile');
  }
  if (callerUser.roles?.find((role) => role.name === RoleType.Provider) === undefined) {
    throw new Error('Caller does not have provider role');
  }
};

const getCallerUserWithAccessToken = async (token: string, secrets: Secrets): Promise<User> => {
  return userMe(token, secrets);
};

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

  // Create the order in FHIR
  const ourServiceRequest = await writeOurServiceRequest(body, practitionerRelativeReference, oystehr);
  if (!ourServiceRequest.id) {
    throw new Error('Error creating service request, id is missing');
  }

  await writeOurProcedure(ourServiceRequest, secrets, oystehr);

  // Send the order to AdvaPACS
  try {
    await writeAdvaPacsTransaction(ourServiceRequest, ourPractitioner, secrets, oystehr);
  } catch (error) {
    console.error('Error sending order to AdvaPACS: ', error);
    await rollbackOurServiceRequest(ourServiceRequest, oystehr);
  }

  return {
    serviceRequestId: ourServiceRequest.id,
  };
};

const writeOurServiceRequest = (
  validatedBody: EnhancedBody,
  practitionerRelativeReference: string,
  oystehr: Oystehr
): Promise<ServiceRequest> => {
  const { encounter, diagnosis, cpt, stat, clinicalHistory } = validatedBody;
  const now = DateTime.now();

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
    priority: stat ? 'stat' : 'routine',
    code: {
      coding: [cpt],
    },
    orderDetail: [
      {
        coding: [
          {
            system: 'http://dicom.nema.org/resources/ontology/DCM',
            code: 'DX',
          },
        ],
      },
    ],
    reasonCode: [
      {
        coding: [diagnosis],
      },
    ],
    authoredOn: now.toISO(),
    occurrenceDateTime: now.toISO(),
    extension: [
      {
        url: SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL,
        extension: [
          {
            url: SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL,
            extension: [
              {
                url: SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL,
                valueCodeableConcept: {
                  coding: [
                    {
                      system: ADVAPACS_ORDER_DETAIL_MODALITY_CODE_SYSTEM_URL,
                      code: 'modality',
                    },
                  ],
                },
              },
              {
                url: SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL,
                valueString: 'DX',
              },
            ],
          },
        ],
      },
      {
        url: SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL,
        extension: [
          {
            url: SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL,
            extension: [
              {
                url: SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL,
                valueCodeableConcept: {
                  coding: [
                    {
                      system: ADVAPACS_ORDER_DETAIL_MODALITY_CODE_SYSTEM_URL,
                      code: 'clinical-history',
                    },
                  ],
                },
              },
              {
                url: SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL,
                valueString: clinicalHistory,
              },
            ],
          },
        ],
      },
      {
        url: SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL,
        valueDateTime: now.toISO(),
      },
    ],
  };
  return oystehr.fhir.create<ServiceRequest>(serviceRequest);
};

// This Procedure holds the CPT code for billing purposes
const writeOurProcedure = async (
  ourServiceRequest: ServiceRequest,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<void> => {
  const procedureConfig: Procedure = {
    resourceType: 'Procedure',
    status: 'completed',
    subject: ourServiceRequest.subject,
    encounter: ourServiceRequest.encounter,
    performer: ourServiceRequest.performer?.map((performer) => ({
      actor: performer,
    })),
    code: ourServiceRequest.code,
    meta: fillMeta('cpt-code', 'cpt-code'), // This is necessary to get the Assessment part of the chart showing the CPT codes. It is some kind of save-chart-data feature that this meta is used to find and save the CPT codes instead of just looking at the FHIR Procedure resources code values.
  };
  await oystehr.fhir.create<Procedure>(procedureConfig);
};

const writeAdvaPacsTransaction = async (
  ourServiceRequest: ServiceRequest,
  ourPractitioner: Practitioner,
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
        name: ourPatient.name,
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
        name: ourPractitioner.name,
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
                valueString: ourServiceRequest.extension
                  ?.filter((ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL)
                  ?.find((orderDetailExt) => {
                    const parameterExt = orderDetailExt.extension?.find(
                      (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL
                    );
                    const codeExt = parameterExt?.extension?.find(
                      (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL
                    );
                    return codeExt?.valueCodeableConcept?.coding?.[0]?.code === 'modality';
                  })
                  ?.extension?.find((ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL)
                  ?.extension?.find(
                    (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL
                  )?.valueString,
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
                valueString: ourServiceRequest.extension
                  ?.filter((ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL)
                  ?.find((orderDetailExt) => {
                    const parameterExt = orderDetailExt.extension?.find(
                      (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL
                    );
                    const codeExt = parameterExt?.extension?.find(
                      (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL
                    );
                    return codeExt?.valueCodeableConcept?.coding?.[0]?.code === 'clinical-history';
                  })
                  ?.extension?.find((ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL)
                  ?.extension?.find(
                    (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL
                  )?.valueString,
              },
            ],
          },
        ],
        authoredOn: ourServiceRequest.authoredOn,
        occurrenceDateTime: ourServiceRequest.occurrenceDateTime,
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
