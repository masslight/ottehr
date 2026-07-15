import { describe, expect, test } from 'vitest';
import { SelectableVideoParticipant, selectActiveParticipant } from './video-room';

describe('selectActiveParticipant', () => {
  const participant = (chimeAttendeeId: string, tileId?: number): SelectableVideoParticipant => ({
    chimeAttendeeId,
    tileId,
  });

  test('preserves the current active participant when a third participant joins', () => {
    const active = participant('patient', 1);
    const participants = [active, participant('invitee'), participant('provider', 3)];

    expect(selectActiveParticipant(participants, active)).toEqual(active);
  });

  test('selects the next participant with video when the active participant leaves', () => {
    const participants = [participant('invitee'), participant('provider', 3)];

    expect(selectActiveParticipant(participants, participant('patient', 1))).toEqual(participant('provider', 3));
  });

  test('falls back to the first participant if none have video tiles', () => {
    const invitee = participant('invitee');

    expect(selectActiveParticipant([invitee, participant('provider')], null)).toEqual(invitee);
  });
});
