import { ServiceRequest } from 'fhir/r4b';
import {
  ACCESSION_NUMBER_CODE_SYSTEM,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM,
  HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER,
} from 'utils/lib/fhir/radiology';
import { describe, expect, test } from 'vitest';
import { buildAdvaPacsServiceRequest } from '../../src/ehr/radiology/create-order';

const ADVAPACS_ORDER_DETAIL_SYSTEM = 'http://advapacs.com/fhir/servicerequest-orderdetail-parameter-code';

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

const getParameterValue = (sr: ReturnType<typeof buildAdvaPacsServiceRequest>, code: string): string | undefined =>
  sr.orderDetail?.[0]?.parameter?.find((p) => p.code?.coding?.[0]?.code === code)?.valueString;

describe('buildAdvaPacsServiceRequest - scheduled-procedure-step-id and requested-procedure-id', () => {
  const accession = '2026111214300042';

  test('includes scheduled-procedure-step-id set to the accession number', () => {
    const r5 = buildAdvaPacsServiceRequest(makeServiceRequest(accession), 'pat-1', 'prac-1', undefined);
    expect(getParameterValue(r5, 'scheduled-procedure-step-id')).toBe(accession);
  });

  test('includes requested-procedure-id set to the accession number', () => {
    const r5 = buildAdvaPacsServiceRequest(makeServiceRequest(accession), 'pat-1', 'prac-1', undefined);
    expect(getParameterValue(r5, 'requested-procedure-id')).toBe(accession);
  });

  test('uses the correct AdvaPACS order detail system for both parameters', () => {
    const r5 = buildAdvaPacsServiceRequest(makeServiceRequest(accession), 'pat-1', 'prac-1', undefined);
    const params = r5.orderDetail?.[0]?.parameter ?? [];

    const stepId = params.find((p) => p.code?.coding?.[0]?.code === 'scheduled-procedure-step-id');
    const procId = params.find((p) => p.code?.coding?.[0]?.code === 'requested-procedure-id');

    expect(stepId?.code?.coding?.[0]?.system).toBe(ADVAPACS_ORDER_DETAIL_SYSTEM);
    expect(procId?.code?.coding?.[0]?.system).toBe(ADVAPACS_ORDER_DETAIL_SYSTEM);
  });
});
