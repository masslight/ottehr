import Oystehr from '@oystehr/sdk';
import { Communication } from 'fhir/r4b';

export interface SendLetterFaxInput {
  oystehr: Oystehr;
  media: string;
  patientId: string;
  faxNumber: string;
  organizationId: string;
}

export async function sendLetterFax(input: SendLetterFaxInput): Promise<Communication> {
  const { oystehr, media, patientId, faxNumber, organizationId } = input;
  const { communicationResource } = await oystehr.fax.send({
    media,
    quality: 'standard',
    scaleToLetter: true,
    patient: `Patient/${patientId}`,
    recipientNumber: faxNumber,
    sender: `Organization/${organizationId}`,
  });
  return communicationResource;
}
