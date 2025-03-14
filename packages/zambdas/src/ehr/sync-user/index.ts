/* eslint-disable @typescript-eslint/no-unused-vars */
import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ContactPoint, Identifier, Practitioner } from 'fhir/r4b';
import {
  FHIR_IDENTIFIER_NPI,
  PractitionerLicense,
  SyncUserResponse,
  allLicensesForPractitioner,
  getPractitionerNPIIdentitifier,
} from 'utils';
import { SecretsKeys, getSecret, Secrets } from 'zambda-utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { makeQualificationForPractitioner } from '../shared/practitioners';
import { ZambdaInput } from 'zambda-utils';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets } = validateRequestParameters(input);
    console.log('Parameters: ' + JSON.stringify(input));

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const m2mOystehrClient = createOystehrClient(m2mtoken, secrets);

    const userToken = input.headers.Authorization.replace('Bearer ', '');
    const userOystehrClient = createOystehrClient(userToken, secrets);

    const response = await performEffect(m2mOystehrClient, userOystehrClient, secrets);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error synchronizing practitioner with remote credentialing authority.' }),
    };
  }
};

async function performEffect(
  m2mOystehrClient: Oystehr,
  userOystehrClient: Oystehr,
  secrets: Secrets | null
): Promise<SyncUserResponse> {
  const [remotePractitioner, localPractitioner] = await Promise.all([
    getRemotePractitionerAndCredentials(userOystehrClient, secrets),
    getLocalEHRPractitioner(userOystehrClient),
  ]);
  if (!remotePractitioner) {
    return {
      message: 'Remote provider licenses and qualifications not found for current practitioner.',
      updated: false,
    };
  }

  // TODO: As it stands, practitioner will never get synchronized with the remote, as we have not
  //       implemented the logic to update the remote authority.
  //       This code will never get called
  //
  //       We will also need to properly handle how data from remote authoirity is reconciled with
  //       the local EHR data that already exists.
  //
  let ehrPractitioner = { ...localPractitioner };
  console.log(`remotePractitioner: ${JSON.stringify(remotePractitioner)}`);
  console.log(`localPractitioner:  ${JSON.stringify(ehrPractitioner)}`);
  ehrPractitioner = updatePractitionerName(ehrPractitioner, remotePractitioner);
  ehrPractitioner.birthDate = remotePractitioner.date_of_birth;
  ehrPractitioner = updatePractitionerPhone(ehrPractitioner, remotePractitioner);
  ehrPractitioner = updatePractitionerPhoto(ehrPractitioner, remotePractitioner);
  ehrPractitioner = updatePractitionerQualification(ehrPractitioner, remotePractitioner);
  ehrPractitioner = updatePractitionerCredentials(ehrPractitioner, remotePractitioner);
  ehrPractitioner = updatePractitionerNPI(ehrPractitioner, remotePractitioner);
  const result = await updatePractitioner(m2mOystehrClient, ehrPractitioner);
  console.log(`Practitioner updated successfully:  ${JSON.stringify(result)}`);
  if (result)
    return {
      message: 'Practitioner credentials have been synchronized with remote credentials authority successfully.',
      updated: true,
    };
  throw new Error('Failed updating practitioner...');
}

interface RemotePractitionerData {
  id: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  date_of_birth?: string;
  primary_phone?: string;
  profession?: string;
  user?: {
    picture?: string;
  };
  photoUrl?: string;
  licenses?: PractitionerLicense[];
  npi?: string;
}

async function getRemotePractitionerAndCredentials(
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<RemotePractitionerData | undefined> {
  console.log('Preparing search parameters for remote practitioner');
  const myEhrUser = await oystehr.user.me();
  const myEmail = myEhrUser.email?.toLocaleLowerCase();
  console.log(`Preparing search for local practitioner email: ${myEmail}`);

  const clinicianSearchResults: RemotePractitionerData[] = [];

  // TODO: this is where you could handle provider search results
  //       from a remote credentialing authority
  //
  // const searchResults: RemotePractitionerData[] = await searchRemoteCredentialsAuthority(
  //   `/api/v1/org/providers/?search=${myEmail}`,
  //   secrets,
  // );

  console.log(`Response: ${JSON.stringify(clinicianSearchResults)}`);

  if (clinicianSearchResults) {
    const provider = clinicianSearchResults.find((provider: any) => provider.email === myEmail);
    if (provider?.id) {
      // TODO: this is where you could handle provider credentials and licenses
      //       from a remote credentialing authority
      //
      // const licensesResponse = await searchRemoteCredentialsAuthority(
      //   `api/v1/org/licenses/?provider=${provider.id}`,
      //   secrets,
      // );
      // const licenses: PractitionerLicense[] = [];
      // if (licensesResponse) {
      //   licensesResponse?.forEach((license: any) => {
      //     const code = license.certificate_type;
      //     const state = license.state;
      //     if (code && state) licenses.push({ code, state, active: true });
      //   });
      // }

      return undefined;
      // {
      // ...provider,
      // licenses,
      // };
    }
  }
  return undefined;
}

async function getLocalEHRPractitioner(oystehr: Oystehr): Promise<Practitioner> {
  const practitionerId = (await oystehr.user.me()).profile.replace('Practitioner/', '');
  return await oystehr.fhir.get<Practitioner>({
    resourceType: 'Practitioner',
    id: practitionerId,
  });
}

async function searchRemoteCredentialsAuthority(path: string, secrets: Secrets | null): Promise<any> {
  // const url = getSecret(SecretsKeys.REMOT_AUTHORITY_URL, secrets);
  // const apiKey = getSecret(SecretsKeys.REMOT_AUTHORITY_API_KEY, secrets);
  // return await fetch(`{url}{path}`, {
  //   method: 'GET',
  //   headers: {
  //     accept: 'application/json',
  //     'x-api-key': apiKey,
  //   },
  // })
  //   .then((res) => res.json())
  //   .then((res) => res.results)
  //   .catch(console.error);
}

function updatePractitionerName(localClinician: Practitioner, remoteClinician: RemotePractitionerData): Practitioner {
  if (!(remoteClinician.first_name || remoteClinician.middle_name || remoteClinician.last_name)) return localClinician;
  const firstName = remoteClinician.first_name;
  const secondName = remoteClinician.middle_name;
  const lastName = remoteClinician.last_name;
  if (firstName || secondName || lastName) {
    if (!localClinician.name) localClinician.name = [{}];
    const given = [];
    if (!localClinician.name[0].given) {
      if (firstName) given.push(firstName);
      if (secondName) given.push(secondName);
      if (given.length > 0) {
        localClinician.name[0].given = given;
      }
    }
    if (lastName) localClinician.name[0].family = lastName;
  }
  return localClinician;
}

function updatePractitionerPhone(localClinician: Practitioner, remoteClinician: RemotePractitionerData): Practitioner {
  if (!remoteClinician.primary_phone) return localClinician;
  localClinician = findTelecomAndUpdateOrAddNew('phone', localClinician, remoteClinician.primary_phone);
  localClinician = findTelecomAndUpdateOrAddNew('sms', localClinician, remoteClinician.primary_phone);
  return localClinician;
}

function findTelecomAndUpdateOrAddNew(
  system: ContactPoint['system'],
  practitioner: Practitioner,
  newPhone: string
): Practitioner {
  const newPractitioner = { ...practitioner };
  const foundTelecomPhone = newPractitioner.telecom?.find((phone, id) => {
    if (phone.system === system) {
      if (newPractitioner.telecom) newPractitioner.telecom[id].value = newPhone;
      return true;
    }
    return false;
  });
  if (!foundTelecomPhone) {
    const phoneRecord: ContactPoint = {
      system: system,
      value: newPhone,
    };
    if (newPractitioner.telecom) {
      newPractitioner.telecom.push(phoneRecord);
    } else {
      newPractitioner.telecom = [phoneRecord];
    }
  }
  return newPractitioner;
}

function updatePractitionerPhoto(localClinician: Practitioner, remoteClinician: RemotePractitionerData): Practitioner {
  if (!remoteClinician.photoUrl) return localClinician;
  if (localClinician?.photo) {
    if (localClinician.photo[0]) {
      localClinician.photo[0] = { url: remoteClinician.photoUrl };
    }
  } else {
    localClinician.photo = [{ url: remoteClinician.photoUrl }];
  }
  return localClinician;
}

function updatePractitionerQualification(
  localPractitioner: Practitioner,
  remotePractitioner: RemotePractitionerData
): Practitioner {
  if (!remotePractitioner.licenses) return localPractitioner;
  if (localPractitioner.qualification) {
    const existedLicenses = allLicensesForPractitioner(localPractitioner);
    const missingLicenses: PractitionerLicense[] = [];
    remotePractitioner.licenses?.forEach((license) => {
      if (!existedLicenses.find((existed) => existed.state === license.state && existed.code === license.code))
        missingLicenses.push(license);
    });
    missingLicenses?.forEach((license) => {
      localPractitioner.qualification?.push(makeQualificationForPractitioner(license));
    });
  } else {
    localPractitioner.qualification = [];
    remotePractitioner.licenses.forEach((license) =>
      localPractitioner.qualification!.push(makeQualificationForPractitioner(license))
    );
  }
  return localPractitioner;
}

function updatePractitionerNPI(localClinician: Practitioner, remoteClinician: RemotePractitionerData): Practitioner {
  if (!remoteClinician.npi) return localClinician;
  const identifier: Identifier = {
    system: FHIR_IDENTIFIER_NPI,
    value: `${remoteClinician.npi}`,
  };

  if (localClinician.identifier) {
    const foundIdentifier = getPractitionerNPIIdentitifier(localClinician);
    if (foundIdentifier && foundIdentifier.value !== identifier.value) {
      foundIdentifier.value = identifier.value;
    } else if (!foundIdentifier) localClinician.identifier.push(identifier);
  } else {
    localClinician.identifier = [identifier];
  }
  return localClinician;
}

function updatePractitionerCredentials(
  localClinician: Practitioner,
  remoteClinician: RemotePractitionerData
): Practitioner {
  if (!remoteClinician.profession) return localClinician;
  if (!localClinician.name) localClinician.name = [{}];
  if (!localClinician.name[0].suffix?.includes(remoteClinician.profession)) {
    if (!localClinician.name[0].suffix) localClinician.name[0].suffix = [];
    localClinician.name[0].suffix.push(remoteClinician.profession);
  }
  return localClinician;
}

async function updatePractitioner(oystehr: Oystehr, practitioner: Practitioner): Promise<Practitioner> {
  return await oystehr.fhir.update(practitioner);
}
