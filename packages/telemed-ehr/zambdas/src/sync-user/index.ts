import { AppClient, FhirClient } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ContactPoint, Identifier, Practitioner } from 'fhir/r4';
import {
  FHIR_IDENTIFIER_NPI,
  PractitionerLicense,
  Secrets,
  SyncUserResponse,
  allLicensesForPractitioner,
  getPractitionerNPIIdentitifier,
} from 'ehr-utils';
import { SecretsKeys, getSecret } from '../shared';
import { checkOrCreateM2MClientToken, createAppClient, createFhirClient } from '../shared/helpers';
import { makeQualificationForPractitioner } from '../shared/practitioners';
import { ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets } = validateRequestParameters(input);
    console.log('Parameters: ' + JSON.stringify(input));

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const fhirClient = createFhirClient(m2mtoken, secrets);
    const appClient = createAppClient(input.headers.Authorization.replace('Bearer ', ''), secrets);

    const response = await performEffect(appClient, fhirClient, secrets);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error synchronizing user' }),
    };
  }
};

async function performEffect(
  appClient: AppClient,
  fhirClient: FhirClient,
  secrets: Secrets | null,
): Promise<SyncUserResponse> {
  return { message: 'Medallion provider not found for current user.', updated: false };

  // const [mPractitioner, ePractitioner] = await Promise.all([
  //   // getMedallionPractitionerAndLicenses(appClient, secrets),
  //   getEhrPractitioner(appClient, fhirClient),
  // ]);
  // if (!mPractitioner) {
  //   // adding CA license for everyone who doesn't have medallion provider account
  //   // ONLY FOR LOWER ENVS
  //   const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  //   if (ePractitioner && ENVIRONMENT !== 'production') {
  //     ePractitioner.qualification ??= [];
  //     const licenses = allLicensesForPractitioner(ePractitioner);
  //     if (licenses.length === 0) {
  //       ePractitioner.qualification.push(makeQualificationForPractitioner({ state: 'CA', code: 'MD', active: true }));
  //     }
  //     await fhirClient.updateResource(ePractitioner);
  //   }
  //   return { message: 'Medallion provider not found for current user.', updated: false };
  // }
  // let ehrPractitioner = { ...ePractitioner };
  // console.log('mPractitioner: ' + JSON.stringify(mPractitioner));
  // console.log('ehrPractitioner: ' + JSON.stringify(ehrPractitioner));
  // ehrPractitioner = updatePractitionerName(ehrPractitioner, mPractitioner);
  // ehrPractitioner.birthDate = mPractitioner.date_of_birth; // may be i should convert it to iso or it's just fine
  // ehrPractitioner = updatePractitionerPhone(ehrPractitioner, mPractitioner);
  // ehrPractitioner = updatePractitionerPhoto(ehrPractitioner, mPractitioner);
  // ehrPractitioner = updatePractitionerQualification(ehrPractitioner, mPractitioner);
  // ehrPractitioner = updatePractitionerCredentials(ehrPractitioner, mPractitioner);
  // ehrPractitioner = updatePractitionerNPI(ehrPractitioner, mPractitioner);
  // const result = await updatePractitioner(fhirClient, ehrPractitioner);
  // console.log('updated practitioner: ' + JSON.stringify(result));
  // if (result) return { message: 'User has been synced successfully.', updated: true };
  // throw new Error('Ehr practitioner update failed');
}

interface MedallionPractitionerData {
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

// async function getMedallionPractitionerAndLicenses(
//   appClient: AppClient,
//   secrets: Secrets | null,
// ): Promise<MedallionPractitionerData | undefined> {
//   console.log(`Getting "me" user`);
//   const myEhrUser = await appClient.getMe();
//   const myEmail = myEhrUser.email.toLocaleLowerCase();
//   console.log(`User email: ${myEmail}`);

//   console.log(`Searching medallion for providers with same email`);
//   const medallionProviders: MedallionPractitionerData[] = await getFromMedallion(
//     `https://app.medallion.co/api/v1/org/providers/?search=${myEmail}`,
//     secrets,
//   );

//   console.log(`Response: ${JSON.stringify(medallionProviders)}`);
//   if (medallionProviders) {
//     const provider = medallionProviders.find((provider: any) => provider.email === myEmail);
//     if (provider?.id) {
//       const licensesResponse = await getFromMedallion(
//         `https://app.medallion.co/api/v1/org/licenses/?provider=${provider.id}`,
//         secrets,
//       );
//       const licenses: PractitionerLicense[] = [];
//       if (licensesResponse) {
//         licensesResponse?.forEach((license: any) => {
//           const code = license.certificate_type;
//           const state = license.state;
//           if (code && state) licenses.push({ code, state, active: true });
//         });
//       }

//       return {
//         ...provider,
//         licenses,
//       };
//     }
//   }
//   return undefined;
// }

async function getEhrPractitioner(appClient: AppClient, fhirClient: FhirClient): Promise<Practitioner> {
  const practitionerId = (await appClient.getMe()).profile.replace('Practitioner/', '');
  return await fhirClient.readResource<Practitioner>({
    resourceType: 'Practitioner',
    resourceId: practitionerId,
  });
}

// async function getFromMedallion(path: string, secrets: Secrets | null): Promise<any> {
//   const apiKey = getSecret(SecretsKeys.MEDALLION_API_KEY, secrets);
//   return await fetch(path, {
//     method: 'GET',
//     headers: {
//       accept: 'application/json',
//       'x-api-key': apiKey,
//     },
//   })
//     .then((res) => res.json())
//     .then((res) => res.results)
//     .catch(console.error);
// }

function updatePractitionerName(ePractitioner: Practitioner, mPractitioner: MedallionPractitionerData): Practitioner {
  if (!(mPractitioner.first_name || mPractitioner.middle_name || mPractitioner.last_name)) return ePractitioner;
  const firstName = mPractitioner.first_name;
  const secondName = mPractitioner.middle_name;
  const lastName = mPractitioner.last_name;
  if (firstName || secondName || lastName) {
    if (!ePractitioner.name) ePractitioner.name = [{}];
    const given = [];
    if (!ePractitioner.name[0].given) {
      if (firstName) given.push(firstName);
      if (secondName) given.push(secondName);
      if (given.length > 0) {
        ePractitioner.name[0].given = given;
      }
    }

    if (lastName) ePractitioner.name[0].family = lastName;
  }
  return ePractitioner;
}

function updatePractitionerPhone(ePractitioner: Practitioner, mPractitioner: MedallionPractitionerData): Practitioner {
  if (!mPractitioner.primary_phone) return ePractitioner;
  ePractitioner = findTelecomAndUpdateOrAddNew('phone', ePractitioner, mPractitioner.primary_phone);
  ePractitioner = findTelecomAndUpdateOrAddNew('sms', ePractitioner, mPractitioner.primary_phone);
  return ePractitioner;
}

function findTelecomAndUpdateOrAddNew(
  system: ContactPoint['system'],
  practitioner: Practitioner,
  newPhone: string,
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

function updatePractitionerPhoto(ePractitioner: Practitioner, mPractitioner: MedallionPractitionerData): Practitioner {
  if (!mPractitioner.photoUrl) return ePractitioner;
  if (ePractitioner?.photo) {
    if (ePractitioner.photo[0]) {
      ePractitioner.photo[0] = { url: mPractitioner.photoUrl };
    }
  } else {
    ePractitioner.photo = [{ url: mPractitioner.photoUrl }];
  }
  return ePractitioner;
}

function updatePractitionerQualification(
  ePractitioner: Practitioner,
  mPractitioner: MedallionPractitionerData,
): Practitioner {
  if (!mPractitioner.licenses) return ePractitioner;
  if (ePractitioner.qualification) {
    const existedLicenses = allLicensesForPractitioner(ePractitioner);
    const missingLicenses: PractitionerLicense[] = [];
    mPractitioner.licenses?.forEach((license) => {
      if (!existedLicenses.find((existed) => existed.state === license.state && existed.code === license.code))
        missingLicenses.push(license);
    });
    missingLicenses?.forEach((license) => {
      ePractitioner.qualification?.push(makeQualificationForPractitioner(license));
    });
  } else {
    ePractitioner.qualification = [];
    mPractitioner.licenses.forEach((license) =>
      ePractitioner.qualification!.push(makeQualificationForPractitioner(license)),
    );
  }
  return ePractitioner;
}

function updatePractitionerNPI(ePractitioner: Practitioner, mPractitioner: MedallionPractitionerData): Practitioner {
  if (!mPractitioner.npi) return ePractitioner;
  const identifier: Identifier = {
    system: FHIR_IDENTIFIER_NPI,
    value: `${mPractitioner.npi}`,
  };

  if (ePractitioner.identifier) {
    const foundIdentifier = getPractitionerNPIIdentitifier(ePractitioner);
    if (foundIdentifier && foundIdentifier.value !== identifier.value) {
      foundIdentifier.value = identifier.value;
    } else if (!foundIdentifier) ePractitioner.identifier.push(identifier);
  } else {
    ePractitioner.identifier = [identifier];
  }
  return ePractitioner;
}

function updatePractitionerCredentials(
  ePractitioner: Practitioner,
  mPractitioner: MedallionPractitionerData,
): Practitioner {
  if (!mPractitioner.profession) return ePractitioner;
  if (!ePractitioner.name) ePractitioner.name = [{}];
  if (!ePractitioner.name[0].suffix?.includes(mPractitioner.profession)) {
    if (!ePractitioner.name[0].suffix) ePractitioner.name[0].suffix = [];
    ePractitioner.name[0].suffix.push(mPractitioner.profession);
  }
  return ePractitioner;
}

async function updatePractitioner(fhirClient: FhirClient, practitioner: Practitioner): Promise<Practitioner> {
  return await fhirClient.updateResource(practitioner);
}
