import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Patient, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CreateRadiologyZambdaOrderInput,
  CreateRadiologyZambdaOrderOutput,
  getSecret,
  RoleType,
  Secrets,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, ZambdaInput } from '../../../shared';
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
const DATE_FORMAT = 'YYYYMMDDHHMMSSMS';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const validatedInput = await validateInput(unsafeInput, secrets, oystehr);

    const callerUser = await getCallerUserWithAccessToken(validatedInput.callerAccessToken, secrets);
    await accessCheck(callerUser);

    const output = await performEffect(validatedInput, callerUser.profile, secrets, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify({ body: output }),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

const accessCheck = async (callerUser: User): Promise<void> => {
  if (callerUser.profile.indexOf('Practitioner/') === -1) {
    throw new Error('Caller does not have a practitioner profile');
  }
  if (callerUser.roles?.find((role) => role.name === RoleType.Provider) === undefined) {
    throw new Error('Caller does not have provider role');
  }
};

const getCallerUserWithAccessToken = async (token: string, secrets: Secrets): Promise<User> => {
  const oystehr = createOystehrClient(token, secrets);
  return await oystehr.user.me();
};

const performEffect = async (
  validatedInput: ValidatedInput,
  practitionerRelativeReference: string,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<CreateRadiologyZambdaOrderOutput> => {
  const { body } = validatedInput;

  // Create the order in FHIR
  const ourServiceRequest = await writeOurServiceRequest(body, practitionerRelativeReference, oystehr);
  if (!ourServiceRequest.id) {
    throw new Error('Error creating service request, id is missing');
  }

  // Send the order to AdvaPACS
  let advaPacsServiceRequest: ServiceRequest | null = null;
  try {
    advaPacsServiceRequest = await syncToAdvaPACS(ourServiceRequest, secrets, oystehr);
  } catch (error) {
    console.error('Error sending order to AdvaPACS: ', error);
    // Roll back creation of our service request
    await rollbackOurServiceRequest(ourServiceRequest, oystehr);
  }
  if (!advaPacsServiceRequest) {
    throw new Error('Error creating AdvaPACS service request');
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
  const { encounter, diagnosis, cpt, stat } = validatedBody;
  const serviceRequest: ServiceRequest = {
    resourceType: 'ServiceRequest',
    status: 'active',
    intent: 'order',
    identifier: [
      {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'ACSN',
            },
          ],
        },
        value: DateTime.now().toFormat(DATE_FORMAT),
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
    occurrenceDateTime: new Date().toISOString(),
  };
  return oystehr.fhir.create<ServiceRequest>(serviceRequest);
};

const syncToAdvaPACS = async (
  ourServiceRequest: ServiceRequest,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<ServiceRequest> => {
  try {
    const advapacsClientId = getSecret(SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
    const advapacsClientSecret = getSecret(SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
    const advapacsAuthString = `ID=${advapacsClientId},Secret=${advapacsClientSecret}`;

    const advaPacsPatient = await writeOrGetAdvaPacsPatient(ourServiceRequest, advapacsAuthString, oystehr);

    return await writeAdvaPacsServiceRequest(ourServiceRequest, advaPacsPatient, advapacsAuthString);
  } catch (error) {
    console.log('sync to AdvaPACS error: ', error);
    throw error;
  }
};

const getOurSubject = async (patientRelativeReference: string, oystehr: Oystehr): Promise<Patient> => {
  try {
    return await oystehr.fhir.get<Patient>({
      resourceType: 'Patient',
      id: patientRelativeReference.split('/')[1],
    });
  } catch (error) {
    throw new Error('Error while trying to fetch our subject patient');
  }
};

const writeOrGetAdvaPacsPatient = async (
  ourServiceRequest: ServiceRequest,
  advapacsAuthString: string,
  oystehr: Oystehr
): Promise<Patient> => {
  const ourPatient = await getOurSubject(ourServiceRequest.subject?.reference || '', oystehr);

  // find patient in advapacs
  const advapacsPatientResponse = await fetch(
    `https://usa1.api.integration.advapacs.com/fhir/Patient?identifier=${ourPatient.id}`,
    {
      method: 'GET',
      headers: {
        Authorization: advapacsAuthString,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!advapacsPatientResponse.ok) {
    throw new Error(advapacsPatientResponse.statusText);
  }
  const advaPacsPatientSearchResponse = await advapacsPatientResponse.json();
  let advaPacsPatient: Patient | undefined;

  if (advaPacsPatientSearchResponse.total === 1) {
    console.log('Found patient in AdvaPACS');
    // found exactly one, happy path!
    advaPacsPatient = advaPacsPatientSearchResponse.entry?.[0];
  } else if (advaPacsPatientSearchResponse.total === 0) {
    console.log('No patient found in AdvaPACS, creating it');
    // could not find the patient, create it
    const patientToCreate: Patient = {
      resourceType: 'Patient',
      identifier: [
        {
          // advapacs FHIR does not allow us to specify a code system, but it does accept a bare value.
          // the assumption here is that there will only be one Identifier on these Patient resources in advapacs.
          value: ourPatient.id,
        },
      ],
      name: ourPatient.name,
      birthDate: ourPatient.birthDate,
      gender: ourPatient.gender,
    };
    console.log('alex patient, ', patientToCreate);
    const advapacsResponse = await fetch(`https://usa1.api.integration.advapacs.com/fhir/Patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: advapacsAuthString,
      },
      body: JSON.stringify(patientToCreate),
    });
    if (!advapacsResponse.ok) {
      throw new Error(advapacsResponse.statusText);
    }

    advaPacsPatient = await advapacsResponse.json();
  } else {
    console.log('Multiple patients found in AdvaPACS, could not sync');
    throw new Error('Multiple patients found in AdvaPACS, could not sync');
  }

  if (advaPacsPatient == null) {
    throw new Error('writeOrGetAdvaPacsPatient - AdvaPACS patient is null after search / create flow');
  }

  console.log('AdvaPACS patient: ', JSON.stringify(advaPacsPatient));

  return advaPacsPatient;
};

const writeAdvaPacsServiceRequest = async (
  ourServiceRequest: ServiceRequest,
  advaPacsPatient: Patient,
  advapacsAuthString: string
): Promise<ServiceRequest> => {
  const advaPacsServiceRequest: ServiceRequest = {
    resourceType: 'ServiceRequest',
    status: ourServiceRequest.status,
    identifier: ourServiceRequest.identifier,
    intent: ourServiceRequest.intent,
    subject: {
      reference: `Patient/${advaPacsPatient.id}`,
    },
  };
  const advapacsResponse = await fetch(`https://usa1.api.integration.advapacs.com/fhir/ServiceRequest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: advapacsAuthString,
    },
    body: JSON.stringify(advaPacsServiceRequest),
  });
  if (!advapacsResponse.ok) {
    throw new Error(advapacsResponse.statusText);
  }

  return await advapacsResponse.json();
};

const rollbackOurServiceRequest = async (ourServiceRequest: ServiceRequest, oystehr: Oystehr): Promise<void> => {
  if (!ourServiceRequest.id) {
    throw new Error('rollbackOurServiceRequest: ServiceRequest id is missing');
  }

  await oystehr.fhir.delete<ServiceRequest>({
    resourceType: 'ServiceRequest',
    id: ourServiceRequest.id,
  });
};
