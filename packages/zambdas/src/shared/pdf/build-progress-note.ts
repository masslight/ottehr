import Oystehr from '@oystehr/sdk';
import { Secrets } from 'utils/lib/secrets';
import { assembleProgressNoteInput } from './assemble-progress-note-input';
import { createProgressNotePdfBytes } from './progress-note-pdf';
import { FullAppointmentResourcePackage } from './visit-details-pdf/types';

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
