import { standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import {
  CreateCustomInsuranceOrgInput,
  CustomInsuranceOrgClaimForm,
  CustomInsuranceOrgSubmissionMechanism,
  CustomInsuranceOrgType,
} from 'utils/lib/types/data/billing/custom-insurance-org.schemas';
import {
  CustomInsuranceOrgItem,
  CustomInsuranceOrgSubmissionDetails,
} from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { NioContact } from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import { emptyNioAddressForm, formatNioAddress, NioAddressForm, NioContactForm } from './nonInsuranceOrg';

export interface CustomInsuranceOrgSubmissionDetailsForm {
  email: string;
  portalUrl: string;
  portalDetails: string;
  faxNumber: string;
  mailAddress: NioAddressForm;
}

export interface CustomInsuranceOrgForm {
  orgId: string;
  name: string;
  insuranceTypes: CustomInsuranceOrgType[];
  submissionMechanism: CustomInsuranceOrgSubmissionMechanism;
  submissionDetails: CustomInsuranceOrgSubmissionDetailsForm;
  acceptedClaimForm: CustomInsuranceOrgClaimForm;
  note: string;
  contacts: NioContactForm[];
}

function emptySubmissionDetailsForm(): CustomInsuranceOrgSubmissionDetailsForm {
  return { email: '', portalUrl: '', portalDetails: '', faxNumber: '', mailAddress: emptyNioAddressForm() };
}

export function emptyCustomInsuranceOrgForm(): CustomInsuranceOrgForm {
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

function submissionDetailsToForm(
  details?: CustomInsuranceOrgSubmissionDetails
): CustomInsuranceOrgSubmissionDetailsForm {
  return {
    email: details?.email ?? '',
    portalUrl: details?.portalUrl ?? '',
    portalDetails: details?.portalDetails ?? '',
    faxNumber: standardizePhoneNumber(details?.faxNumber) ?? details?.faxNumber ?? '',
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

export function customInsuranceOrgItemToFormValues(item?: CustomInsuranceOrgItem | null): CustomInsuranceOrgForm {
  const form = emptyCustomInsuranceOrgForm();
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
    phone: standardizePhoneNumber(contact.phone) ?? contact.phone ?? '',
    email: contact.email ?? '',
  }));
  return form;
}

// Only the field(s) relevant to the selected mechanism are submitted, so switching mechanisms in
// the form never leaves stale data from a previously-selected one behind.
function submissionDetailsToInput(form: CustomInsuranceOrgForm): CustomInsuranceOrgSubmissionDetails | undefined {
  const details = form.submissionDetails;
  if (form.submissionMechanism === 'email') {
    return details.email.trim() ? { email: details.email.trim() } : undefined;
  }
  if (form.submissionMechanism === 'portal') {
    const result: CustomInsuranceOrgSubmissionDetails = {
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

function addressToInput(address: NioAddressForm): CustomInsuranceOrgSubmissionDetails['mailAddress'] {
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

export function customInsuranceOrgFormToInput(form: CustomInsuranceOrgForm): CreateCustomInsuranceOrgInput {
  const submissionDetails = submissionDetailsToInput(form);
  const contacts = contactsToInput(form.contacts);
  return {
    orgId: form.orgId.trim(),
    name: form.name.trim(),
    insuranceTypes: form.insuranceTypes,
    submissionMechanism: form.submissionMechanism,
    ...(submissionDetails ? { submissionDetails } : {}),
    acceptedClaimForm: form.acceptedClaimForm,
    ...(form.note.trim() ? { note: form.note.trim() } : {}),
    ...(contacts ? { contacts } : {}),
  };
}

export function formatInsuranceOrgAddress(address?: CustomInsuranceOrgSubmissionDetails['mailAddress']): string {
  return formatNioAddress(address);
}
