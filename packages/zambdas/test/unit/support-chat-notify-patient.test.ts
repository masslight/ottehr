import Oystehr from '@oystehr/sdk';
import { Location, Organization, Patient } from 'fhir/r4b';
import { BRANDING_CONFIG } from 'utils/lib/ottehr-config/branding';
import { LOCATION_SUPPORT_PHONE_EXTENSION_URL } from 'utils/lib/utils/support-dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendGenericOutreachEmail = vi.fn();

vi.mock('../../src/shared/communication', () => ({
  getEmailClient: () => ({ sendGenericOutreachEmail }),
  sendSmsForPatient: vi.fn(),
}));

vi.mock('../../src/shared/errors', () => ({ sendErrors: vi.fn() }));

import { notifyPatient } from '../../src/shared/support-chat/notify-patient';

const secrets = { ENVIRONMENT: 'test', WEBSITE_URL: 'https://portal', ORGANIZATION_ID: 'org-1' };
const patient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['Sarah'], family: 'Black' }],
  telecom: [{ system: 'email', value: 'sarah@example.com' }],
};
const location: Location = {
  resourceType: 'Location',
  id: 'location-1',
  name: 'Downtown Clinic',
  extension: [{ url: LOCATION_SUPPORT_PHONE_EXTENSION_URL, valueString: '(111) 111-1111' }],
};
const practice: Organization = {
  resourceType: 'Organization',
  id: 'org-1',
  name: 'Good Health Practice',
  telecom: [{ system: 'phone', value: '(222) 222-2222' }],
};

const makeOystehr = (get: () => Promise<Organization>): { oystehr: Oystehr; get: ReturnType<typeof vi.fn> } => {
  const fn = vi.fn(get);
  return { oystehr: { fhir: { get: fn } } as unknown as Oystehr, get: fn };
};

const sentEmail = (): { content: string; 'subject-text': string } => sendGenericOutreachEmail.mock.calls[0][1];

describe('notifyPatient', () => {
  beforeEach(() => {
    sendGenericOutreachEmail.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('uses the location name and phone when the task has a location', async () => {
    const { oystehr, get } = makeOystehr(async () => practice);
    await notifyPatient({ patient, location, secrets, oystehr });

    expect(sentEmail()['subject-text']).toBe('You have a new message from Downtown Clinic');
    expect(sentEmail().content).toContain('(111) 111-1111');
    expect(get).not.toHaveBeenCalled();
  });

  it('uses the practice name and phone when the task has no location', async () => {
    const { oystehr, get } = makeOystehr(async () => practice);
    await notifyPatient({ patient, secrets, oystehr });

    expect(get).toHaveBeenCalledWith({ resourceType: 'Organization', id: 'org-1' });
    expect(sentEmail()['subject-text']).toBe('You have a new message from Good Health Practice');
    expect(sentEmail().content).toContain('(222) 222-2222');
  });

  it('still sends the email when the practice cannot be loaded', async () => {
    const { oystehr } = makeOystehr(async () => {
      throw new Error('gone');
    });
    await notifyPatient({ patient, secrets, oystehr });

    expect(sentEmail()['subject-text']).toBe(`You have a new message from ${BRANDING_CONFIG.projectName}`);
    expect(sentEmail().content).not.toContain('contact us at');
  });

  it('still sends the email when the practice is not configured', async () => {
    const { oystehr, get } = makeOystehr(async () => practice);
    await notifyPatient({ patient, secrets: { ...secrets, ORGANIZATION_ID: undefined } as never, oystehr });

    expect(get).not.toHaveBeenCalled();
    expect(sentEmail()['subject-text']).toBe(`You have a new message from ${BRANDING_CONFIG.projectName}`);
  });
});
