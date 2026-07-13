import {
  BillingCoverageOption,
  BillingInsuranceType,
  BillingSubscriberRelationship,
  CreateBillingCoverageInput,
  UpdateBillingCoverageInput,
} from 'utils';
import { buildAddressInput } from '../utils/format';

export interface CoverageForm {
  payerId: string | null;
  memberId: string | null;
  insuranceType: BillingInsuranceType | null;
  planType: string | null;
  relationship: BillingSubscriberRelationship | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  dob: string | null;
  gender: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export function emptyCoverageForm(insuranceType: BillingInsuranceType = 'primary'): CoverageForm {
  return {
    payerId: null,
    memberId: null,
    insuranceType,
    planType: null,
    relationship: 'Self',
    firstName: null,
    middleName: null,
    lastName: null,
    dob: null,
    gender: null,
    line1: null,
    line2: null,
    city: null,
    state: null,
    zip: null,
  };
}

// Prefill a form from an existing coverage. The payer autocomplete starts empty (placeholder shows the
// current payer); a payer is only re-pointed when the user explicitly picks one.
export function defaultCoverageFormValues(option?: BillingCoverageOption): CoverageForm {
  const ph = option?.policyHolder;
  const addr = ph?.addressParts;
  return {
    payerId: option?.payorId ?? null,
    memberId: option?.memberId ?? option?.subscriberId ?? null,
    insuranceType: option?.insuranceType ?? 'primary',
    planType: option?.planType ?? null,
    relationship: option?.relationship || 'Self',
    firstName: ph?.firstName ?? null,
    middleName: ph?.middleName ?? null,
    lastName: ph?.lastName ?? null,
    dob: ph?.dob ?? null,
    gender: ph?.gender || null,
    line1: addr?.line1 ?? null,
    line2: addr?.line2 ?? null,
    city: addr?.city ?? null,
    state: addr?.state ?? null,
    zip: addr?.postalCode ?? null,
  };
}

export function coverageToCreateInput(data: CoverageForm, patientId: string): CreateBillingCoverageInput {
  const address = buildAddressInput(data.line1, data.line2, data.city, data.state, data.zip);
  return {
    patientId,
    payerId: data.payerId!,
    memberId: data.memberId!.trim(),
    insuranceType: data.insuranceType!,
    planType: data.planType!,
    relationship: data.relationship!,
    ...(data.relationship !== 'Self'
      ? {
          firstName: data.firstName?.trim(),
          ...(data.middleName?.trim() ? { middleName: data.middleName.trim() } : {}),
          lastName: data.lastName?.trim(),
          dob: data.dob,
          gender: data.gender,
          ...(address ? { address } : {}),
        }
      : {}),
  };
}

export function coverageToUpdateInput(data: CoverageForm, coverageId: string): UpdateBillingCoverageInput {
  const address = buildAddressInput(data.line1, data.line2, data.city, data.state, data.zip);
  return {
    coverageId,
    payerId: data.payerId!,
    memberId: data.memberId!.trim(),
    insuranceType: data.insuranceType!,
    planType: data.planType!,
    relationship: data.relationship!,
    ...(data.relationship !== 'Self'
      ? {
          firstName: data.firstName?.trim(),
          ...(data.middleName?.trim() ? { middleName: data.middleName.trim() } : {}),
          lastName: data.lastName?.trim(),
          dob: data.dob,
          gender: data.gender,
          ...(address ? { address } : {}),
        }
      : {}),
  };
}
