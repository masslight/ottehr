// Shared mock data for the telemed-admin stories (not a story: only *.story.tsx files are loaded).
import type { ChargeItemDefinition, Location, Organization } from 'fhir/r4b';
import { CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM } from 'src/rcm/state/employers/employers.api';
import { CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { LOCATION_FORM_EXTENSION_URL, LOCATION_VIRTUAL_CODE } from 'utils/lib/fhir/location';
import { ORG_TYPE_CODE_SYSTEM, ORG_TYPE_PAYER_CODE } from 'utils/lib/types/constants';
import type { FetchMock } from '../../harness/story';

/** Answers `oystehr.zambda.execute({ id })` with `output`. */
export const zambda = (
  id: string,
  output: unknown | ((req: { url: string; method: string; body: any }) => unknown)
): FetchMock => ({
  url: `/${id}/execute`,
  response: (req: { url: string; method: string; body: any }) => ({
    status: 200,
    output: typeof output === 'function' ? (output as (r: typeof req) => unknown)(req) : output,
  }),
});

/**
 * Answers admin-get-quick-picks. The SDK sends its parameters inside a Request object, which the
 * harness fetch mock does not read, so the reply cannot depend on `category`; every story here
 * renders a single category, so one list is enough.
 */
export const quickPicks = (list: unknown[]): FetchMock =>
  zambda('admin-get-quick-picks', { message: 'ok', quickPicks: list });

const procedure = (code: string, display: string, amount: number, modifier?: string): any => ({
  priceComponent: [
    {
      type: 'base',
      code: { coding: [{ system: CPT_CODE_SYSTEM, code, display }] },
      amount: { value: amount, currency: 'USD' },
      ...(modifier ? { extension: [{ url: CPT_MODIFIER_EXTENSION_URL, valueCode: modifier }] } : {}),
    },
  ],
});

export const feeSchedule: ChargeItemDefinition = {
  resourceType: 'ChargeItemDefinition',
  id: 'fs-1',
  meta: { versionId: 'v3' },
  url: 'https://example.org/fee-schedule/fs-1',
  status: 'active',
  title: 'Aetna PPO 2026',
  date: '2026-01-01',
  description: 'Negotiated commercial rates.',
  useContext: [
    {
      code: { system: 'http://terminology.hl7.org/CodeSystem/usage-context-type', code: 'venue' },
      valueReference: { reference: 'Location/loc-1' },
    },
  ],
  propertyGroup: [
    procedure('99203', 'Office or other outpatient visit, new patient, low MDM', 142.5),
    procedure('99213', 'Office or other outpatient visit, established patient, low MDM', 98),
    procedure('99214', 'Office or other outpatient visit, established patient, moderate MDM', 139.25, '25'),
    procedure('87880', 'Strep A assay with optical observation', 21.4),
    procedure('12001', 'Simple repair of superficial wounds, 2.5 cm or less', 176),
  ],
};

export const chargeMaster: ChargeItemDefinition = {
  ...feeSchedule,
  id: 'cm-1',
  url: 'https://example.org/charge-master/cm-1',
  title: 'Standard Charge Master 2026',
  description: 'Billed rates.',
};

export const locations: Location[] = [
  { resourceType: 'Location', id: 'loc-1', status: 'active', name: 'Downtown Urgent Care', description: 'Main clinic' },
  { resourceType: 'Location', id: 'loc-2', status: 'active', name: 'Eastside Clinic', description: 'East campus' },
  { resourceType: 'Location', id: 'loc-3', status: 'active', name: 'Harbor Pediatrics' },
  { resourceType: 'Location', id: 'loc-4', status: 'active', name: 'Northgate Walk-In', description: 'Mall annex' },
  {
    resourceType: 'Location',
    id: 'loc-5',
    status: 'active',
    name: 'Telemed New York',
    address: { state: 'NY' },
    extension: [
      {
        url: LOCATION_FORM_EXTENSION_URL,
        valueCoding: { code: LOCATION_VIRTUAL_CODE, display: 'Virtual' },
      },
    ],
  },
];

const payer = (id: string, name: string, payerId: string): Organization => ({
  resourceType: 'Organization',
  id,
  active: true,
  name,
  type: [{ coding: [{ system: ORG_TYPE_CODE_SYSTEM, code: ORG_TYPE_PAYER_CODE }] }],
  identifier: [
    { type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'XX' }] }, value: payerId },
  ],
});

export const payers: Organization[] = [
  payer('org-1', 'Aetna', '60054'),
  payer('org-2', 'Blue Cross Blue Shield of New York', '00803'),
  payer('org-3', 'Cigna', '62308'),
  payer('org-4', 'Humana', '61101'),
  payer('org-5', 'UnitedHealthcare', '87726'),
];

export const employers: Organization[] = [
  {
    resourceType: 'Organization',
    id: 'emp-1',
    active: true,
    name: 'Acme Logistics',
    identifier: [
      { system: CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM, value: 'a3f1c2d4-5b6e-4f70-8a91-0c2d3e4f5a6b' },
    ],
    address: [{ line: ['200 Dock St', 'Suite 4'], city: 'Brooklyn', state: 'NY', postalCode: '11201' }],
    telecom: [
      { system: 'phone', value: '(718) 555-0142' },
      { system: 'fax', value: '(718) 555-0143' },
      { system: 'email', value: 'hr@acmelogistics.example' },
    ],
  },
  { resourceType: 'Organization', id: 'emp-2', active: true, name: 'Northwind Construction' },
];
