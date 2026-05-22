import { describe, expect, it } from 'vitest';
import { READY_OR_UNSIGNED_ENCOUNTER_STATUSES } from '../../src/cron/notifications-updater';

describe('notifications-updater encounter status filter', () => {
  it("includes 'planned' so the cron sees telemed appointments at booking time (OTR-2552)", () => {
    expect(READY_OR_UNSIGNED_ENCOUNTER_STATUSES).toContain('planned');
  });

  it("includes 'arrived' so postponed-communication and de-duplication logic still runs after waiting-room entry", () => {
    expect(READY_OR_UNSIGNED_ENCOUNTER_STATUSES).toContain('arrived');
  });
});
