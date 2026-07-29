import {
  BillingCoverageOption,
  BillingInsuranceType,
  BillingSubscriberRelationship,
  ClaimDetailResponse,
  CreateBillingCoverageInput,
  GenderOption,
  UpdateBillingCoverageInput,
} from 'utils';
import { buildAddressInput } from '../utils/format';

export interface CoverageForm {
  payerId: string;
  memberId: string;
  insuranceType: BillingInsuranceType;
  planType: string;
  relationship: BillingSubscriberRelationship;
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string;
  gender: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

export function emptyCoverageForm(insuranceType: BillingInsuranceType = 'primary'): CoverageForm {
  return {
    payerId: '',
    memberId: '',
    insuranceType,
    planType: '',
    relationship: 'Self',
    firstName: '',
    middleName: '',
    lastName: '',
    dob: '',
    gender: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
  };
}

function isBillingCoverageOption(
  dataSource?: BillingCoverageOption | ClaimDetailResponse | null
): dataSource is BillingCoverageOption {
  return !!dataSource && Object.hasOwn(dataSource, 'insuranceType');
}

// Prefill a form from an existing coverage. The payer autocomplete starts empty (placeholder shows the
// current payer); a payer is only re-pointed when the user explicitly picks one.
export function defaultCoverageFormValues(
  dataSource?: BillingCoverageOption | ClaimDetailResponse | null
): CoverageForm {
  const ph = dataSource?.policyHolder;
  const addr = ph?.addressParts;
  if (isBillingCoverageOption(dataSource)) {
    return {
      payerId: dataSource?.payorId ?? '',
      memberId: dataSource?.memberId ?? dataSource?.subscriberId ?? '',
      insuranceType: dataSource?.insuranceType ?? 'primary',
      planType: dataSource?.planType ?? '',
      relationship: dataSource?.relationship || 'Self',
      firstName: ph?.firstName ?? '',
      middleName: ph?.middleName ?? '',
      lastName: ph?.lastName ?? '',
      dob: ph?.dob ?? '',
      gender: ph?.gender || '',
      line1: addr?.line1 ?? '',
      line2: addr?.line2 ?? '',
      city: addr?.city ?? '',
      state: addr?.state ?? '',
      zip: addr?.postalCode ?? '',
    };
  }
  return {
    payerId: dataSource?.payerId ?? '',
    memberId: dataSource?.memberId ?? dataSource?.subscriberId ?? '',
    insuranceType: 'primary',
    planType: dataSource?.planType ?? '',
    relationship: dataSource?.relationship || 'Self',
    firstName: ph?.firstName ?? '',
    middleName: ph?.middleName ?? '',
    lastName: ph?.lastName ?? '',
    dob: ph?.dob ?? '',
    gender: ph?.gender || '',
    line1: addr?.line1 ?? '',
    line2: addr?.line2 ?? '',
    city: addr?.city ?? '',
    state: addr?.state ?? '',
    zip: addr?.postalCode ?? '',
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
          policyHolder: {
            firstName: data.firstName?.trim(),
            ...(data.middleName?.trim() ? { middleName: data.middleName.trim() } : {}),
            lastName: data.lastName?.trim(),
            dob: data.dob,
            gender: data.gender as GenderOption,
            ...(address ? { address } : {}),
          },
        }
      : {}),
  };
}
