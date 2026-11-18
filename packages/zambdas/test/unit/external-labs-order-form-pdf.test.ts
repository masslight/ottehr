import Oystehr from '@oystehr/sdk';
import { Coverage, Organization, Patient } from 'fhir/r4b';
import { PDFPage } from 'pdf-lib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createExternalLabsOrderFormPdfBytes,
  getInsuranceDetails,
} from '../../src/shared/pdf/external-labs-order-form-pdf';
import { ExternalLabOrderFormData } from '../../src/shared/pdf/types';

const oystehr = new Oystehr({});

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ given: ['Chewy'], family: 'James' }],
  birthDate: '2001-05-01',
  address: [{ line: ['123 Chestnut Avenue'], city: 'Washington', state: 'WA', postalCode: '10001' }],
};

const payor: Organization = { resourceType: 'Organization', id: 'org-1', name: 'Aetna Better Health' };

const selfCoverage: Coverage = {
  resourceType: 'Coverage',
  id: 'cov-self',
  status: 'active',
  beneficiary: { reference: 'Patient/pat-1' },
  payor: [{ reference: 'Organization/org-1' }],
  subscriber: { reference: 'Patient/pat-1' },
  subscriberId: '123456',
  relationship: { coding: [{ code: 'self', display: 'Self' }] },
};

const parentSubscribedCoverage: Coverage = {
  ...selfCoverage,
  id: 'cov-parent',
  subscriber: { reference: '#coverageSubscriber' },
  subscriberId: '654321',
  relationship: { coding: [{ code: 'child', display: 'Child' }] },
  contained: [
    {
      resourceType: 'RelatedPerson',
      id: 'coverageSubscriber',
      patient: { reference: 'Patient/pat-1' },
      name: [{ given: ['Bandit'], family: 'James' }],
      birthDate: '1975-02-14',
      address: [{ line: ['9 Elm Street'], city: 'Seattle', state: 'WA', postalCode: '98101' }],
    },
  ],
};

describe('getInsuranceDetails', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("takes the subscriber's DOB and the patient's relation to them from each coverage", () => {
    const details = getInsuranceDetails(
      [
        { coverage: selfCoverage, payorOrg: payor, coverageRank: 1 },
        { coverage: parentSubscribedCoverage, payorOrg: payor, coverageRank: 2 },
      ],
      patient,
      oystehr
    );

    expect(
      details?.map(({ insuredName, insuredDOB, relationToInsured }) => ({ insuredName, insuredDOB, relationToInsured }))
    ).toEqual([
      { insuredName: 'Chewy James', insuredDOB: '05/01/2001', relationToInsured: 'Self' },
      { insuredName: 'Bandit James', insuredDOB: '02/14/1975', relationToInsured: 'Child' },
    ]);
  });

  it('leaves the subscriber DOB off when the birth date cannot be read', () => {
    const [detail] =
      getInsuranceDetails(
        [{ coverage: selfCoverage, payorOrg: payor, coverageRank: 1 }],
        { ...patient, birthDate: 'unknown' },
        oystehr
      ) ?? [];

    expect(detail.insuredDOB).toBeUndefined();
  });
});

describe('external labs order form PDF', () => {
  const data: ExternalLabOrderFormData = {
    locationName: 'Ottehr',
    accountNumber: '12345',
    orderNumber: 'XEPV01TPKZ975MHPN3',
    providerName: 'Daniel Cohen, MD',
    providerNPI: '8244141619',
    patientFirstName: 'Chewy',
    patientMiddleName: undefined,
    patientLastName: 'James',
    patientSex: 'male',
    patientDOB: '05/01/2001',
    patientId: '1123',
    patientAddress: '123 Chestnut Avenue, Washington, WA, 10001',
    patientPhone: '(289) 686-6347',
    todayDate: '11/13/2026 01:36 PM EST',
    orderSubmitDate: '11/13/2026 01:36 PM EST',
    dateIncludedInFileName: '2026-11-13',
    orderPriority: 'routine',
    isManualOrder: false,
    isPscOrder: true,
    labOrganizationName: 'AutoLab',
    billClass: 'Third-Party Bill (T)',
    testDetails: [],
    isWorkersCompOrder: false,
    insuranceDetails: [
      {
        insuranceRank: 1,
        insuranceName: 'Aetna Better Health',
        insuranceSubNum: '123456',
        insuredName: 'Bandit James',
        insuredDOB: '02/14/1975',
        relationToInsured: 'Child',
        insuredAddress: '9 Elm Street, Seattle, WA, 98101',
      },
    ],
  };

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the subscriber fields in the order of the design', async () => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    await createExternalLabsOrderFormPdfBytes(data);
    const drawn = drawText.mock.calls.map(([text, options]) => ({ text: text.trim(), y: options?.y ?? 0 }));
    const y = (text: string): number => {
      const line = drawn.find((entry) => entry.text === text);
      expect(line, `"${text}" was not drawn`).toBeDefined();
      return line!.y;
    };

    const labels = [
      'Bill Class:',
      'Primary Insurance Name:',
      'Subscriber Number:',
      'Subscriber Name:',
      'Subscriber DOB:',
      'Relation to Subscriber:',
      'Address:',
    ];
    const heights = labels.map(y);
    expect(heights).toEqual([...heights].sort((a, b) => b - a));
    expect(new Set(heights).size).toBe(labels.length);
    expect(drawn.map((entry) => entry.text)).toEqual(expect.arrayContaining(['02/14/1975', 'Child']));
    expect(drawn.map((entry) => entry.text)).not.toContain('Insured Name:');
  });
});
