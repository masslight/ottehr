import { describe, expect, it } from 'vitest';
import { pathForTarget } from '../../src/features/notifications/ProviderNotifications';

describe('notification bell destinations', () => {
  it("opens a visit referral on the visit's Plan tab, where its Referrals card is, not the visit details page", () => {
    expect(pathForTarget({ type: 'referral', patientId: 'pat-1', appointmentId: 'appt-1' })).toBe(
      '/in-person/appt-1/plan'
    );
  });

  it("opens a referral without a visit on the patient's Referrals tab", () => {
    expect(pathForTarget({ type: 'referral', patientId: 'pat-1' })).toBe('/patient/pat-1?tab=referrals');
  });

  it('keeps the visit details page for other visit notifications and the match page for faxes', () => {
    expect(pathForTarget({ type: 'visit', appointmentId: 'appt-1' })).toBe('/visit/appt-1');
    expect(pathForTarget({ type: 'inboundFax', faxCommunicationId: 'comm-1' })).toBe('/inbound-fax/comm-1/match');
    expect(pathForTarget(undefined)).toBeUndefined();
  });
});
