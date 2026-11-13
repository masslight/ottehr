import { ServiceRequest } from 'fhir/r4b';
import {
  ACCESSION_NUMBER_CODE_SYSTEM,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER,
} from 'utils/lib/fhir/radiology';
import { describe, expect, test } from 'vitest';
import { buildAdvaPacsServiceRequest } from '../../src/ehr/radiology/create-order';

const makeServiceRequest = (accessionNumber: string): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/pat-1' },
  requester: { reference: 'Practitioner/prac-1' },
  code: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '71045', display: 'X-ray of chest, 1 view' }] },
  identifier: [
    {
      type: {
        coding: [{ system: HL7_IDENTIFIER_TYPE_CODE_SYSTEM, code: HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER }],
      },
      system: ACCESSION_NUMBER_CODE_SYSTEM,
      value: accessionNumber,
    },
  ],
});

describe('buildAdvaPacsServiceRequest - scheduled-procedure-step-id and requested-procedure-id', () => {
  const accession = '2026111214300042';

  test('includes Scheduled Procedure Step ID as an identifier set to the accession number', () => {
    const r5 = buildAdvaPacsServiceRequest(makeServiceRequest(accession), 'pat-1', 'prac-1', undefined);
    const spsId = r5.identifier?.find((id: any) => id.type?.text === 'Scheduled Procedure Step ID');
    expect(spsId).toBeDefined();
    expect(spsId!.value).toBe(accession);
  });

  test('includes Requested Procedure ID as an identifier set to the accession number', () => {
    const r5 = buildAdvaPacsServiceRequest(makeServiceRequest(accession), 'pat-1', 'prac-1', undefined);
    const rpId = r5.identifier?.find((id: any) => id.type?.text === 'Requested Procedure ID');
    expect(rpId).toBeDefined();
    expect(rpId!.value).toBe(accession);
  });

  test('does not include scheduled-procedure-step-id or requested-procedure-id in orderDetail', () => {
    const r5 = buildAdvaPacsServiceRequest(makeServiceRequest(accession), 'pat-1', 'prac-1', undefined);
    const params = r5.orderDetail?.[0]?.parameter ?? [];
    const spsParam = params.find((p) => p.code?.coding?.[0]?.code === 'scheduled-procedure-step-id');
    const rpParam = params.find((p) => p.code?.coding?.[0]?.code === 'requested-procedure-id');
    expect(spsParam).toBeUndefined();
    expect(rpParam).toBeUndefined();
  });
});
