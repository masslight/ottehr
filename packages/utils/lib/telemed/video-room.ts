export type SelectableVideoParticipant = {
  chimeAttendeeId?: string;
  tileId?: number;
};

export function selectActiveParticipant<T extends SelectableVideoParticipant>(
  participants: T[],
  currentActiveParticipant: T | null
): T | null {
  if (currentActiveParticipant?.chimeAttendeeId) {
    const stillPresent = participants.find(
      (participant) => participant.chimeAttendeeId === currentActiveParticipant.chimeAttendeeId
    );

    if (stillPresent) {
      return stillPresent;
    }
  }

  return participants.find((participant) => participant.tileId != null) ?? participants[0] ?? null;
}
