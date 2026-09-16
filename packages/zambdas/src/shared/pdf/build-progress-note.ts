import Oystehr from '@oystehr/sdk';
import { Secrets } from 'utils/lib/secrets';
import { assembleProgressNoteInput } from './assemble-progress-note-input';
import { createProgressNotePdfBytes } from './progress-note-pdf';
import { FullAppointmentResourcePackage } from './visit-details-pdf/types';

/**
 * Regenerates the visit/progress note PDF for a visit and returns its bytes, without uploading
 * anything or creating/superseding the canonical `75498-6` DocumentReference.
 *
 * Used wherever the note is needed before it has been signed — the outbound fax packet and the
 * print-at-discharge endpoint. The chart-data assembly is shared with the visit-note subscription
 * (`assembleProgressNoteInput`), so a note produced here matches the one persisted after signing.
 */
export async function buildProgressNoteBytes(args: {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  visitResources: FullAppointmentResourcePackage;
  signed: boolean;
}): Promise<Uint8Array> {
  const { oystehr, token, secrets, visitResources, signed } = args;
  const input = await assembleProgressNoteInput(oystehr, token, visitResources, { signed });
  return createProgressNotePdfBytes(input, secrets, token);
}
