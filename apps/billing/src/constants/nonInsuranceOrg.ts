import { BillingPayerOption } from 'utils/lib/types/data/billing/billing.types';
import {
  CreateNonInsuranceOrgInput,
  NIO_COVERAGE_CATEGORIES,
  NioAddress,
  NioContact,
  NioCoverageCategory,
  NioCoverageInput,
  NioSubmission,
  NioSubmissionMechanism,
  NioWcBillingMode,
} from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import { NioCoverageDetail, NonInsuranceOrganizationItem } from 'utils/lib/types/data/billing/non-insurance-org.types';

export interface NioAddressForm {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

export interface NioSubmissionForm {
  preferredMechanism: '' | NioSubmissionMechanism;
  email: string;
  fax: string;
  portalNotes: string;
  mailAddress: NioAddressForm;
}

export interface NioContactForm {
  name: string;
  title: string;
  phone: string;
  email: string;
}

// One entry per category; `enabled` mirrors the category's checkbox. The mode-specific fields
// (billingMode/payerId for workers comp, name for other) are simply unused by the other categories.
export interface NioCoverageForm {
  enabled: boolean;
  billingMode: NioWcBillingMode;
  payerId: string;
  // Seeds PayerSelect's initialOptions on edit so a stored payer renders its label pre-search.
  payerOption: BillingPayerOption | null;
  sameAsOrgAddress: boolean;
  name: string;
  submission: NioSubmissionForm;
}

export interface NonInsuranceOrgForm {
  name: string;
  employer: boolean;
  address: NioAddressForm;
  contacts: NioContactForm[];
  covers: Record<NioCoverageCategory, NioCoverageForm>;
}

export function emptyNioAddressForm(): NioAddressForm {
  return { line1: '', line2: '', city: '', state: '', zip: '' };
}

function emptySubmissionForm(): NioSubmissionForm {
  return { preferredMechanism: '', email: '', fax: '', portalNotes: '', mailAddress: emptyNioAddressForm() };
}

export function emptyNioContactForm(): NioContactForm {
  return { name: '', title: '', phone: '', email: '' };
}

function emptyCoverageForm(): NioCoverageForm {
  return {
    enabled: false,
    billingMode: 'direct',
    payerId: '',
    payerOption: null,
    sameAsOrgAddress: false,
    name: '',
    submission: emptySubmissionForm(),
  };
}

export function emptyNonInsuranceOrgForm(): NonInsuranceOrgForm {
  return {
    name: '',
    employer: false,
    address: emptyNioAddressForm(),
    contacts: [],
    covers: {
      'workers-comp': emptyCoverageForm(),
      'occupational-medicine': emptyCoverageForm(),
      other: emptyCoverageForm(),
    },
  };
}

function addressToForm(address?: NioAddress): NioAddressForm {
  return {
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    zip: address?.zip ?? '',
  };
}

function addressToInput(address: NioAddressForm): NioAddress | undefined {
  const result: NioAddress = {
    ...(address.line1.trim() ? { line1: address.line1.trim() } : {}),
    ...(address.line2.trim() ? { line2: address.line2.trim() } : {}),
    ...(address.city.trim() ? { city: address.city.trim() } : {}),
    ...(address.state ? { state: address.state } : {}),
    ...(address.zip.trim() ? { zip: address.zip.trim() } : {}),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

function submissionToForm(submission?: NioSubmission): NioSubmissionForm {
  return {
    preferredMechanism: submission?.preferredMechanism ?? '',
    email: submission?.email ?? '',
    fax: submission?.fax ?? '',
    portalNotes: submission?.portalNotes ?? '',
    mailAddress: addressToForm(submission?.mailAddress),
  };
}

function submissionToInput(submission: NioSubmissionForm, mailOverride?: NioAddress): NioSubmission | undefined {
  const mailAddress = mailOverride ?? addressToInput(submission.mailAddress);
  const result: NioSubmission = {
    ...(submission.preferredMechanism ? { preferredMechanism: submission.preferredMechanism } : {}),
    ...(submission.email.trim() ? { email: submission.email.trim() } : {}),
    ...(submission.fax.trim() ? { fax: submission.fax.trim() } : {}),
    ...(submission.portalNotes.trim() ? { portalNotes: submission.portalNotes.trim() } : {}),
    ...(mailAddress ? { mailAddress } : {}),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

export function nioItemToFormValues(item?: NonInsuranceOrganizationItem | null): NonInsuranceOrgForm {
  const form = emptyNonInsuranceOrgForm();
  if (!item) return form;
  form.name = item.name;
  form.employer = item.employer;
  form.address = addressToForm(item.address);
  form.contacts = item.contacts.map((contact) => ({
    name: contact.name,
    title: contact.title ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
  }));
  for (const coverage of item.covers) {
    const entry = form.covers[coverage.category];
    entry.enabled = true;
    entry.submission = submissionToForm(coverage.submission);
    if (coverage.category === 'workers-comp') {
      entry.billingMode = coverage.billingMode;
      entry.payerId = coverage.payer?.id ?? '';
      entry.payerOption = coverage.payer ?? null;
    } else if (coverage.category === 'other') {
      entry.name = coverage.name ?? '';
    }
  }
  return form;
}

export function nioFormToInput(form: NonInsuranceOrgForm): CreateNonInsuranceOrgInput {
  const orgAddress = addressToInput(form.address);

  const contacts: NioContact[] = form.contacts
    .filter((contact) => contact.name.trim())
    .map((contact) => ({
      name: contact.name.trim(),
      ...(contact.title.trim() ? { title: contact.title.trim() } : {}),
      ...(contact.phone.trim() ? { phone: contact.phone.trim() } : {}),
      ...(contact.email.trim() ? { email: contact.email.trim() } : {}),
    }));

  const covers: NioCoverageInput[] = [];
  for (const category of NIO_COVERAGE_CATEGORIES) {
    const entry = form.covers[category];
    if (!entry.enabled) continue;
    if (category === 'workers-comp') {
      if (entry.billingMode === 'insurance') {
        covers.push({ category, billingMode: 'insurance', ...(entry.payerId ? { payerId: entry.payerId } : {}) });
      } else {
        const submission = submissionToInput(entry.submission, entry.sameAsOrgAddress ? orgAddress : undefined);
        covers.push({ category, billingMode: 'direct', ...(submission ? { submission } : {}) });
      }
    } else {
      const submission = submissionToInput(entry.submission);
      covers.push({
        category,
        ...(category === 'other' && entry.name.trim() ? { name: entry.name.trim() } : {}),
        ...(submission ? { submission } : {}),
      });
    }
  }

  return {
    name: form.name.trim(),
    employer: form.employer,
    ...(orgAddress ? { address: orgAddress } : {}),
    ...(contacts.length ? { contacts } : {}),
    ...(covers.length ? { covers } : {}),
  };
}

export function formatNioAddress(address?: NioAddress): string {
  if (!address) return '';
  const cityStateZip = [address.city, [address.state, address.zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  return [address.line1, address.line2, cityStateZip].filter(Boolean).join(', ');
}

const MECHANISM_LABELS: Record<NioSubmissionMechanism, string> = {
  email: 'Email',
  portal: 'Portal',
  fax: 'Fax',
  mail: 'Mail',
};

export function nioCoverageSummary(coverage: NioCoverageDetail): string {
  const parts: string[] = [];
  if (coverage.category === 'workers-comp') {
    if (coverage.billingMode === 'insurance') {
      parts.push('Bill Insurance');
      const payerLabel = coverage.payer?.name || coverage.payer?.payerId;
      if (payerLabel) parts.push(payerLabel);
    } else {
      parts.push('Bill Directly');
    }
  } else if (coverage.category === 'other' && coverage.name) {
    parts.push(coverage.name);
  }
  const mechanism = coverage.submission?.preferredMechanism;
  if (mechanism) parts.push(`prefers ${MECHANISM_LABELS[mechanism]}`);
  return parts.join(' · ') || 'Covered';
}
