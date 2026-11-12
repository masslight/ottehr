import Oystehr from '@oystehr/sdk';
import { Communication } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { sendLetterFax } from '../../src/shared/send-letter-fax';

describe('sendLetterFax', () => {
  it('sends the media scaled to Letter size and returns the Communication', async () => {
    const communication: Communication = {
      resourceType: 'Communication',
      id: 'comm-1',
      status: 'in-progress',
    };
    const mockFaxSend = vi.fn().mockResolvedValue({
      communicationResource: communication,
    });
    const oystehr = {
      fax: {
        send: mockFaxSend,
      },
    } as unknown as Oystehr;

    const result = await sendLetterFax({
      oystehr,
      media: 'https://z3.example/order-form.pdf',
      patientId: 'patient-1',
      faxNumber: '+12125551234',
      organizationId: 'org-1',
    });

    expect(mockFaxSend).toHaveBeenCalledWith({
      media: 'https://z3.example/order-form.pdf',
      quality: 'standard',
      scaleToLetter: true,
      patient: 'Patient/patient-1',
      recipientNumber: '+12125551234',
      sender: 'Organization/org-1',
    });
    expect(result).toBe(communication);
  });
});
