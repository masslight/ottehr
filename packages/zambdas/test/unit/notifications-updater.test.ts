import { ProviderNotificationMethod, ProviderNotificationSettings } from 'utils';
import { describe, expect, it } from 'vitest';
import { getStatusOverridingBusy, READY_OR_UNSIGNED_ENCOUNTER_STATUSES } from '../../src/cron/notifications-updater';

describe('notifications-updater encounter status filter', () => {
  it("includes 'planned' so the cron sees telemed appointments at booking time (OTR-2552)", () => {
    expect(READY_OR_UNSIGNED_ENCOUNTER_STATUSES).toContain('planned');
  });

  it("includes 'arrived' so postponed-communication and de-duplication logic still runs after waiting-room entry", () => {
    expect(READY_OR_UNSIGNED_ENCOUNTER_STATUSES).toContain('arrived');
  });
});

describe('getStatusOverridingBusy (OTR-2583)', () => {
  const settings = (method: ProviderNotificationMethod): ProviderNotificationSettings => ({
    method,
    taskNotificationsEnabled: true,
    telemedNotificationsEnabled: true,
  });

  it("returns 'completed' for phone-only providers so SMS gets triggered", () => {
    expect(getStatusOverridingBusy(settings(ProviderNotificationMethod.phone))).toBe('completed');
  });

  it("returns 'in-progress' for 'phone and computer' providers so the badge still lights up", () => {
    expect(getStatusOverridingBusy(settings(ProviderNotificationMethod['phone and computer']))).toBe('in-progress');
  });

  it("returns 'in-progress' for 'computer' providers so the badge still lights up", () => {
    expect(getStatusOverridingBusy(settings(ProviderNotificationMethod.computer))).toBe('in-progress');
  });
});
