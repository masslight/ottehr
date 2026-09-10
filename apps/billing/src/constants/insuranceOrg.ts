import {
  CreateInsuranceOrgInput,
  InsuranceOrgClaimForm,
  InsuranceOrgSubmissionMechanism,
  InsuranceOrgType,
} from 'utils/lib/types/data/billing/insurance-org.schemas';
import { InsuranceOrganizationItem } from 'utils/lib/types/data/billing/insurance-org.types';

export interface InsuranceOrgForm {
  orgId: string;
  name: string;
  insuranceTypes: InsuranceOrgType[];
  submissionMechanism: '' | InsuranceOrgSubmissionMechanism;
  acceptedClaimForm: '' | InsuranceOrgClaimForm;
  note: string;
}

export function emptyInsuranceOrgForm(): InsuranceOrgForm {
  return {
    orgId: '',
    name: '',
    insuranceTypes: [],
    submissionMechanism: '',
    acceptedClaimForm: '',
    note: '',
  };
}

export function insuranceOrgItemToFormValues(item?: InsuranceOrganizationItem | null): InsuranceOrgForm {
  const form = emptyInsuranceOrgForm();
  if (!item) return form;
  form.orgId = item.orgId;
  form.name = item.name;
  form.insuranceTypes = item.insuranceTypes;
  form.submissionMechanism = item.submissionMechanism ?? '';
  form.acceptedClaimForm = item.acceptedClaimForm ?? '';
  form.note = item.note ?? '';
  return form;
}

export function insuranceOrgFormToInput(form: InsuranceOrgForm): CreateInsuranceOrgInput {
  return {
    orgId: form.orgId.trim(),
    name: form.name.trim(),
    insuranceTypes: form.insuranceTypes,
    submissionMechanism: form.submissionMechanism as InsuranceOrgSubmissionMechanism,
    acceptedClaimForm: form.acceptedClaimForm as InsuranceOrgClaimForm,
    ...(form.note.trim() ? { note: form.note.trim() } : {}),
  };
}
