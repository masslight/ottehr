import Oystehr from '@oystehr/sdk';
import { FAX_PACKET_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateFilesDocumentReferences = vi.fn();
vi.mock('utils/lib/fhir/helpers', () => ({
  createFilesDocumentReferences: (...args: unknown[]) => mockCreateFilesDocumentReferences(...args),
}));

import { makeFaxPacketDocumentReference } from '../../src/shared/pdf/make-fax-packet-document-reference';

const baseArgs = {
  oystehr: {} as Oystehr,
  pdfInfo: { title: 'FaxPacket-unique.pdf', uploadURL: 'z3://fax/FaxPacket-unique.pdf' },
  patientId: 'patient-1',
  listResources: [],
};

describe('makeFaxPacketDocumentReference search scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFilesDocumentReferences.mockResolvedValue({
      docRefs: [{ resourceType: 'DocumentReference', id: 'packet-1', status: 'current', content: [] }],
    });
  });

  it('searches only fax packets for patient-level sources', async () => {
    await makeFaxPacketDocumentReference(baseArgs);

    expect(mockCreateFilesDocumentReferences).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: [
          { name: 'subject', value: 'Patient/patient-1' },
          { name: 'type', value: `http://loinc.org|${FAX_PACKET_CODE}` },
        ],
      })
    );
  });

  it('keeps a single-visit packet scoped by encounter', async () => {
    await makeFaxPacketDocumentReference({
      ...baseArgs,
      appointmentId: 'appointment-1',
      encounterId: 'encounter-1',
    });

    expect(mockCreateFilesDocumentReferences).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: [{ name: 'encounter', value: 'Encounter/encounter-1' }],
      })
    );
  });
});
