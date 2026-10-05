// UI-only prototype: NIO organization type + notes live in localStorage (keyed by NIO id) until
// the backend supports them. The API keeps receiving employer = (type === 'employer').

import { NonInsuranceOrganizationItem } from 'utils/lib/types/data/billing/non-insurance-org.types';

export type NioOrgType =
  | 'employer'
  | 'third-party-administrator'
  | 'medical-clearance-organization'
  | 'document-requestor'
  | 'other';

export const NIO_ORG_TYPES: NioOrgType[] = [
  'employer',
  'third-party-administrator',
  'medical-clearance-organization',
  'document-requestor',
  'other',
];

export const NIO_ORG_TYPE_LABELS: Record<NioOrgType, string> = {
  employer: 'Employer',
  'third-party-administrator': 'Third Party Administrator',
  'medical-clearance-organization': 'Medical Clearance Organization',
  'document-requestor': 'Document Requestor',
  other: 'Other',
};

export interface NioDocPricing {
  perClaim: number;
  perPage: number;
  perDocument: number;
}

export interface NioExtras {
  type: NioOrgType;
  notes: string;
  // Document Requestor only; amounts are additive per invoiced claim.
  pricing?: NioDocPricing;
}

const STORAGE_KEY = 'billing.nioPrototypeExtras';

function loadAll(): Record<string, NioExtras> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as Record<string, NioExtras>) : {};
  } catch {
    return {};
  }
}

export function loadNioExtras(nioId: string): NioExtras | null {
  return loadAll()[nioId] ?? null;
}

export function saveNioExtras(nioId: string, extras: NioExtras): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadAll(), [nioId]: extras }));
  } catch {
    // ignore storage errors (private browsing / quota)
  }
}

// --- UI-only sample data: document-requestor NIOs shown alongside real API rows ---------------

export const isDemoNioId = (id: string): boolean => id.startsWith('demo-nio-');

export const DEMO_NIOS: NonInsuranceOrganizationItem[] = [
  {
    id: 'demo-nio-lawfirm',
    name: 'Harrington & Lowe LLP',
    employer: false,
    active: true,
    address: { line1: '900 Congress Avenue, 14th Floor', city: 'Austin', state: 'TX', zip: '78701' },
    contacts: [{ name: 'Dana Whitfield', title: 'Records Paralegal' }],
    covers: [],
  },
  {
    id: 'demo-nio-underwriter',
    name: 'Meridian Life Underwriting',
    employer: false,
    active: true,
    address: { line1: '415 Lakeview Drive', city: 'Chicago', state: 'IL', zip: '60601' },
    contacts: [{ name: 'Paul Ngata', title: 'APS Coordinator' }],
    covers: [],
  },
];

const DEMO_NIO_EXTRAS: Record<string, NioExtras> = {
  'demo-nio-lawfirm': {
    type: 'document-requestor',
    notes: 'Law firm — medical records requests for personal injury cases.',
    pricing: { perClaim: 25, perDocument: 10, perPage: 0.5 },
  },
  'demo-nio-underwriter': {
    type: 'document-requestor',
    notes: 'Life insurance underwriting — APS record pulls.',
    pricing: { perClaim: 15, perDocument: 5, perPage: 0.25 },
  },
};

// Idempotent: fills in missing demo extras without clobbering user edits.
export function seedDemoNioExtras(): void {
  for (const [id, extras] of Object.entries(DEMO_NIO_EXTRAS)) {
    if (!loadNioExtras(id)) saveNioExtras(id, extras);
  }
}
