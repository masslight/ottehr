import Oystehr from '@oystehr/sdk';
import { Coverage, Location, Organization, Patient, Practitioner, RelatedPerson, ServiceRequest } from 'fhir/r4b';
import { join } from 'path';
import { PDFPage } from 'pdf-lib';
import { OYSTEHR_RCM_PAYER_ID_SYSTEM } from 'utils/lib/fhir/constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPdf } from '../../src/shared/pdf/pdf-common';
import { PDF_CLIENT_STYLES } from '../../src/shared/pdf/pdf-consts';
import {
  composeRadiologyOrderFormData,
  RadiologyOrderFormData,
  RadiologyOrderFormInput,
  radiologyOrderFormRenderConfig,
} from '../../src/shared/pdf/radiology-order-form-pdf';

const oystehr = new Oystehr({});

const serviceRequest: ServiceRequest = {
  resourceType: 'ServiceRequest',
  id: 'sr-1',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  authoredOn: '2026-04-04T15:45:00.000Z',
  code: { coding: [{ code: '73600-LT', display: 'Ankle, 2 views' }] },
  reasonCode: [{ coding: [{ code: 'S82.92XA', display: 'Fracture of unspecified part of left fibula' }] }],
};

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ given: ['Oliver', 'Nicolas'], family: 'Black' }],
  birthDate: '2009-05-11',
  telecom: [{ system: 'phone', value: '+11234567815' }],
  address: [{ line: ['78 Old Town Road'], city: 'New York', state: 'NY', postalCode: '12345' }],
};

const practitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prac-1',
  name: [{ given: ['Sarah'], family: 'Lion', suffix: ['MD'] }],
};

const location: Location = {
  resourceType: 'Location',
  id: 'loc-1',
  name: 'Ottehr Clinic',
  address: { line: ['78 Old Town Road'], city: 'New York', state: 'NY', postalCode: '12345' },
  telecom: [
    { system: 'phone', value: '(123) 456-7815' },
    { system: 'fax', value: '+10987654321' },
  ],
};

const payer = (payerId: string, name: string): Organization => ({
  resourceType: 'Organization',
  id: `org-${payerId}`,
  name,
  identifier: [{ system: OYSTEHR_RCM_PAYER_ID_SYSTEM, value: payerId }],
});

const coverage = (
  id: string,
  payerId: string,
  options: { planName?: string; subscriber: string; relationship: string; memberId?: string }
): Coverage => ({
  resourceType: 'Coverage',
  id,
  status: 'active',
  beneficiary: { reference: 'Patient/pat-1' },
  payor: [{ reference: `https://rcm-api.zapehr.com/payer/${payerId}` }],
  subscriber: { reference: options.subscriber },
  subscriberId: options.memberId,
  relationship: { coding: [{ code: options.relationship.toLowerCase(), display: options.relationship }] },
  class: [
    {
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'plan' }] },
      value: payerId,
      name: options.planName,
    },
  ],
});

const spouse: RelatedPerson = {
  resourceType: 'RelatedPerson',
  id: 'coverageSubscriber',
  patient: { reference: 'Patient/pat-1' },
  name: [{ given: ['Emma'], family: 'Black' }],
};

const input = (overrides: Partial<RadiologyOrderFormInput> = {}): RadiologyOrderFormInput => ({
  serviceRequest,
  patient,
  practitioner,
  location,
  timezone: 'America/New_York',
  weight: { value: 70, unit: 'kg' },
  coverages: {
    primary: coverage('cov-1', '60054', { subscriber: 'Patient/pat-1', relationship: 'Self', memberId: '12345678' }),
    // a payer that has since dropped out of the payer list still prints under the name it was saved with
    secondary: coverage('cov-2', '99999', {
      planName: 'My Health',
      subscriber: '#coverageSubscriber',
      relationship: 'Spouse',
      memberId: 'MH-555',
    }),
    primarySubscriber: patient as unknown as RelatedPerson,
    secondarySubscriber: spouse,
  },
  insuranceOrgs: [payer('60054', 'Blue Cross')],
  oystehr,
  ...overrides,
});

describe('composeRadiologyOrderFormData', () => {
  it('prints the patient address and both insurances, primary first', () => {
    const { patient: composed } = composeRadiologyOrderFormData(input());

    expect(composed.address).toBe(oystehr.fhir.formatAddress(patient.address![0]));
    expect(composed.insurances).toEqual([
      {
        rank: 'Primary',
        carrier: 'Blue Cross',
        subscriberName: 'Black, Oliver',
        memberId: '12345678',
        relationship: 'Self',
      },
      {
        rank: 'Secondary',
        carrier: 'My Health',
        subscriberName: 'Black, Emma',
        memberId: 'MH-555',
        relationship: 'Spouse',
      },
    ]);
  });

  it('falls back to the member identifier when the coverage has no subscriberId', () => {
    const primary: Coverage = {
      ...coverage('cov-1', '60054', { subscriber: 'Patient/pat-1', relationship: 'Self' }),
      identifier: [{ type: { coding: [{ code: 'MB' }] }, value: 'MB-1' }],
    };
    const { patient: composed } = composeRadiologyOrderFormData(input({ coverages: { primary } }));

    expect(composed.insurances).toEqual([
      { rank: 'Primary', carrier: 'Blue Cross', memberId: 'MB-1', relationship: 'Self' },
    ]);
  });

  it('prints no insurance lines for a patient without coverage', () => {
    expect(composeRadiologyOrderFormData(input({ coverages: {} })).patient.insurances).toEqual([]);
  });

  it('carries the provider credentials and a formatted clinic fax', () => {
    const composed = composeRadiologyOrderFormData(input());

    expect(composed.orderingProvider).toMatchObject({ signatureName: 'Sarah Lion', credentials: 'MD' });
    expect(composed.orderingClinic.fax).toBe('(098) 765-4321');
  });

  it('leaves credentials off for a provider without any', () => {
    const composed = composeRadiologyOrderFormData(
      input({ practitioner: { ...practitioner, name: [{ given: ['Sarah'], family: 'Lion' }] } })
    );

    expect(composed.orderingProvider.credentials).toBeUndefined();
  });
});

describe('radiology order form PDF', () => {
  const fromPackageRoot = (paths: Record<string, string> | undefined): Record<string, string> | undefined =>
    paths && Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, join(__dirname, '..', '..', path)]));

  const { initialPage } = PDF_CLIENT_STYLES;
  const PAGE_RIGHT_BOUND = initialPage.width - (initialPage.pageMargins.right ?? 0);

  type DrawnText = { text: string; x: number; y: number };

  const render = async (data: RadiologyOrderFormData): Promise<DrawnText[]> => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    drawText.mockClear();
    await renderPdf(
      data,
      {
        ...radiologyOrderFormRenderConfig,
        assetPaths: {
          fonts: fromPackageRoot(radiologyOrderFormRenderConfig.assetPaths.fonts),
          icons: fromPackageRoot(radiologyOrderFormRenderConfig.assetPaths.icons),
        },
      },
      ''
    );
    return drawText.mock.calls.map(([text, options]) => {
      const x = options?.x ?? 0;
      const width = options?.font?.widthOfTextAtSize(text, options.size ?? 0) ?? 0;
      expect(x + width, `"${text}" runs past the right margin`).toBeLessThanOrEqual(PAGE_RIGHT_BOUND + 0.5);
      // wrapped lines are drawn with a trailing space
      return { text: text.trimEnd(), x, y: options?.y ?? 0 };
    });
  };

  const find = (drawn: DrawnText[], text: string): DrawnText => {
    const match = drawn.find((line) => line.text === text);
    expect(match, `"${text}" was not drawn`).toBeDefined();
    return match!;
  };

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws the new fields where the design puts them', async () => {
    const drawn = await render(composeRadiologyOrderFormData(input()));
    const text = drawn.map((line) => line.text).join(' ');

    // From column: the fax-back line follows the clinic phone, and the old "Fax:" label is gone
    const phone = find(drawn, 'Phone: (123) 456-7815');
    const faxLabel = find(drawn, 'Please fax results to:');
    const faxNumber = find(drawn, '(098) 765-4321');
    expect(faxLabel.y).toBeLessThan(phone.y);
    expect(faxNumber.y).toBeLessThan(faxLabel.y);
    expect(faxLabel.x).toBe(phone.x);
    expect(text).not.toContain('Fax: (098) 765-4321');

    expect(text).toContain(`Address: ${oystehr.fhir.formatAddress(patient.address![0])}`);
    expect(text).toContain('Primary Insurance');
    expect(text).toContain('Blue Cross     Subscriber: Black, Oliver     ID: 12345678     Relation: Self');
    expect(text).toContain('Secondary Insurance');
    expect(text).toContain('My Health     Subscriber: Black, Emma     ID: MH-555     Relation: Spouse');

    // the credentials follow the cursive signature on its baseline
    const signature = find(drawn, 'Sarah Lion');
    const credentials = find(drawn, ', MD');
    expect(credentials.y).toBe(signature.y);
    expect(credentials.x).toBeGreaterThan(signature.x);
  });

  it('renders the form for a patient with no insurance, address or clinic fax', async () => {
    const drawn = await render(
      composeRadiologyOrderFormData(
        input({
          coverages: {},
          patient: { ...patient, address: undefined },
          location: { ...location, telecom: [{ system: 'phone', value: '(123) 456-7815' }] },
        })
      )
    );
    const text = drawn.map((line) => line.text).join(' ');

    expect(text).not.toContain('Insurance');
    expect(text).not.toContain('Address:');
    expect(text).not.toContain('Please fax results to:');
    expect(text).toContain('Sarah Lion');
  });

  it('wraps a long insurance line between its fields, never inside one', async () => {
    const longCarrier = 'ANTHEM BLUE CROSS AND BLUE SHIELD HEALTH PLAN OF NEW YORK';
    const drawn = await render(
      composeRadiologyOrderFormData(
        input({ insuranceOrgs: [payer('60054', longCarrier)], coverages: { primary: input().coverages.primary } })
      )
    );
    const label = find(drawn, 'Primary Insurance');
    const orderedY = drawn.find((line) => line.text.startsWith('Ordered'))!.y;
    // the value lines sit right of the label, from its row down to the order section
    const insuranceLines = drawn.filter((line) => line.x > label.x && line.y <= label.y && line.y > orderedY);

    expect(insuranceLines.length).toBeGreaterThan(1);
    expect(insuranceLines.map((line) => line.text)).toContainEqual(expect.stringContaining('ID: 12345678'));
    insuranceLines.forEach((line) => expect(line.text).not.toMatch(/(Subscriber|ID|Relation):$/));
  });
});
