import Oystehr from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';
import { SECRETS } from '../data/secrets';

export const ensureM2MPractitionerProfile = async (token: string): Promise<void> => {
  const { FHIR_API, PROJECT_ID, PROJECT_API } = SECRETS;
  const projectApiClient = new Oystehr({
    accessToken: token,
    fhirApiUrl: FHIR_API,
    projectApiUrl: PROJECT_API,
    projectId: PROJECT_ID,
  });

  const practitionerForM2M = await projectApiClient.fhir.create<Practitioner>({
    resourceType: 'Practitioner',
    name: [{ given: ['M2M'], family: 'Client' }],
    birthDate: '1978-01-01',
    telecom: [{ system: 'phone', value: '+11231231234', use: 'mobile' }],
  });

  // ensure this m2m has an associated Practitioner profile
  const m2mResource = await projectApiClient.m2m.me();
  let [m2mProfileType, m2mProfileId] = m2mResource.profile.split('/');
  if (m2mProfileType && m2mProfileType === 'Practitioner' && m2mProfileId) {
    try {
      await projectApiClient.fhir.get<Practitioner>({
        id: m2mProfileId,
        resourceType: 'Practitioner',
      });
    } catch {
      await projectApiClient.m2m.update({
        id: m2mResource.id,
        profile: `Practitioner/${practitionerForM2M.id}`,
      });
    }
  } else {
    await projectApiClient.m2m.update({
      id: m2mResource.id,
      profile: `Practitioner/${practitionerForM2M.id}`,
    });
  }

  [m2mProfileType, m2mProfileId] = (await projectApiClient.m2m.me()).profile.split('/');

  expect(m2mProfileType).toBe('Practitioner');
  expect(m2mProfileId).toBeDefined();

  const m2mPractitioner = await projectApiClient.fhir.get<Practitioner>({
    id: m2mProfileId,
    resourceType: 'Practitioner',
  });
  expect(m2mPractitioner).toBeDefined();
};
