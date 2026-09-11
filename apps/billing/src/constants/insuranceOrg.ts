import {
  CreateInsuranceOrgInput,
  InsuranceOrgClaimForm,
  InsuranceOrgSubmissionMechanism,
  InsuranceOrgType,
} from 'utils/lib/types/data/billing/insurance-org.schemas';
import {
  InsuranceOrganizationItem,
  InsuranceOrgSubmissionDetails,
} from 'utils/lib/types/data/billing/insurance-org.types';
import { NioContact } from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import { emptyNioAddressForm, formatNioAddress, NioAddressForm, NioContactForm } from './nonInsuranceOrg';

export interface InsuranceOrgSubmissionDetailsForm {
  email: string;
  portalUrl: string;
  portalDetails: string;
  faxNumber: string;
  mailAddress: NioAddressForm;
}

export interface InsuranceOrgForm {
  orgId: string;
  name: string;
  insuranceTypes: InsuranceOrgType[];
  submissionMechanism: '' | InsuranceOrgSubmissionMechanism;
  submissionDetails: InsuranceOrgSubmissionDetailsForm;
  acceptedClaimForm: '' | InsuranceOrgClaimForm;
  note: string;
  contacts: NioContactForm[];
}

function emptySubmissionDetailsForm(): InsuranceOrgSubmissionDetailsForm {
  return { email: '', portalUrl: '', portalDetails: '', faxNumber: '', mailAddress: emptyNioAddressForm() };
}

export function emptyInsuranceOrgForm(): InsuranceOrgForm {
  return {
    orgId: '',
    name: '',
    insuranceTypes: [],
    submissionMechanism: 'email',
    submissionDetails: emptySubmissionDetailsForm(),
    acceptedClaimForm: 'cms-1500',
    note: '',
    contacts: [],
  };
}

function submissionDetailsToForm(details?: InsuranceOrgSubmissionDetails): InsuranceOrgSubmissionDetailsForm {
  return {
    email: details?.email ?? '',
    portalUrl: details?.portalUrl ?? '',
    portalDetails: details?.portalDetails ?? '',
    faxNumber: details?.faxNumber ?? '',
    mailAddress: details?.mailAddress
      ? {
          line1: details.mailAddress.line1 ?? '',
          line2: details.mailAddress.line2 ?? '',
          city: details.mailAddress.city ?? '',
          state: details.mailAddress.state ?? '',
          zip: details.mailAddress.zip ?? '',
        }
      : emptyNioAddressForm(),
  };
}

export function insuranceOrgItemToFormValues(item?: InsuranceOrganizationItem | null): InsuranceOrgForm {
  const form = emptyInsuranceOrgForm();
  if (!item) return form;
  form.orgId = item.orgId;
  form.name = item.name;
  form.insuranceTypes = item.insuranceTypes;
  form.submissionMechanism = item.submissionMechanism ?? '';
  form.submissionDetails = submissionDetailsToForm(item.submissionDetails);
  form.acceptedClaimForm = item.acceptedClaimForm ?? '';
  form.note = item.note ?? '';
  form.contacts = item.contacts.map((contact) => ({
    name: contact.name,
    title: contact.title ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
  }));
  return form;
}

// Only the field(s) relevant to the selected mechanism are submitted, so switching mechanisms in
// the form never leaves stale data from a previously-selected one behind.
function submissionDetailsToInput(form: InsuranceOrgForm): InsuranceOrgSubmissionDetails | undefined {
  const details = form.submissionDetails;
  if (form.submissionMechanism === 'email') {
    return details.email.trim() ? { email: details.email.trim() } : undefined;
  }
  if (form.submissionMechanism === 'portal') {
    const result: InsuranceOrgSubmissionDetails = {
      ...(details.portalUrl.trim() ? { portalUrl: details.portalUrl.trim() } : {}),
      ...(details.portalDetails.trim() ? { portalDetails: details.portalDetails.trim() } : {}),
    };
    return Object.keys(result).length > 0 ? result : undefined;
  }
  if (form.submissionMechanism === 'fax') {
    return details.faxNumber.trim() ? { faxNumber: details.faxNumber.trim() } : undefined;
  }
  if (form.submissionMechanism === 'mail') {
    const mailAddress = addressToInput(details.mailAddress);
    return mailAddress ? { mailAddress } : undefined;
  }
  return undefined;
}

function addressToInput(address: NioAddressForm): InsuranceOrgSubmissionDetails['mailAddress'] {
  const result = {
    ...(address.line1.trim() ? { line1: address.line1.trim() } : {}),
    ...(address.line2.trim() ? { line2: address.line2.trim() } : {}),
    ...(address.city.trim() ? { city: address.city.trim() } : {}),
    ...(address.state ? { state: address.state } : {}),
    ...(address.zip.trim() ? { zip: address.zip.trim() } : {}),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

function contactsToInput(contacts: NioContactForm[]): NioContact[] | undefined {
  const result: NioContact[] = contacts
    .filter((contact) => contact.name.trim())
    .map((contact) => ({
      name: contact.name.trim(),
      ...(contact.title.trim() ? { title: contact.title.trim() } : {}),
      ...(contact.phone.trim() ? { phone: contact.phone.trim() } : {}),
      ...(contact.email.trim() ? { email: contact.email.trim() } : {}),
    }));
  return result.length ? result : undefined;
}

export function insuranceOrgFormToInput(form: InsuranceOrgForm): CreateInsuranceOrgInput {
  const submissionDetails = submissionDetailsToInput(form);
  const contacts = contactsToInput(form.contacts);
  return {
    orgId: form.orgId.trim(),
    name: form.name.trim(),
    insuranceTypes: form.insuranceTypes,
    submissionMechanism: form.submissionMechanism as InsuranceOrgSubmissionMechanism,
    ...(submissionDetails ? { submissionDetails } : {}),
    acceptedClaimForm: form.acceptedClaimForm as InsuranceOrgClaimForm,
    ...(form.note.trim() ? { note: form.note.trim() } : {}),
    ...(contacts ? { contacts } : {}),
  };
}

export function formatInsuranceOrgAddress(address?: InsuranceOrgSubmissionDetails['mailAddress']): string {
  return formatNioAddress(address);
}
