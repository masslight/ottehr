import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { CreateRadiologyZambdaOrderInput, CreateRadiologyZambdaOrderOutput, RoleType, Secrets } from 'utils';
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

    const output = await performEffect(validatedInput, callerUser.profile, oystehr);

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
  practitionerId: string,
  oystehr: Oystehr
): Promise<CreateRadiologyZambdaOrderOutput> => {
  const { body } = validatedInput;

  // Create the order in FHIR
  const ourServiceRequest = await writeOurServiceRequest(body, practitionerId, oystehr);
  if (!ourServiceRequest.id) {
    throw new Error('Error creating service request, id is missing');
  }

  // Send the order to AdvaPACS
  let advaPacsServiceRequest: ServiceRequest | null = null;
  try {
    advaPacsServiceRequest = await writeAdvaPACSServiceRequest(ourServiceRequest);
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
  practitionerId: string,
  oystehr: Oystehr
): Promise<ServiceRequest> => {
  const { encounter, diagnosis, cpt, stat } = validatedBody;
  const serviceRequest: ServiceRequest = {
    resourceType: 'ServiceRequest',
    status: 'draft',
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
      reference: `Practitioner/${practitionerId}`,
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

const writeAdvaPACSServiceRequest = (ourServiceRequest: ServiceRequest): ServiceRequest => {
  return ourServiceRequest; // TODO: implement the actual AdvaPACS service request
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
