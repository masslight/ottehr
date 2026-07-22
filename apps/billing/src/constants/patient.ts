import { CreateBillingPatientInput, GenderOption, PatientDetailResponse, UpdateBillingPatientInput } from 'utils';
import { buildAddressInput } from '../utils/format';

export interface PatientForm {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

export function emptyPatientForm(): PatientForm {
  return {
    firstName: '',
    lastName: '',
    dob: '',
    gender: '',
    phone: '',
    email: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
  };
}

export function defaultPatientFormValues(patient?: PatientDetailResponse | null): PatientForm {
  if (!patient) return emptyPatientForm();
  return {
    firstName: patient.firstName ?? '',
    lastName: patient.lastName ?? '',
    dob: patient.dob ?? '',
    gender: patient.gender ?? '',
    phone: patient.phone ?? '',
    email: patient.email ?? '',
    line1: patient.addressParts.line1 ?? '',
    line2: patient.addressParts.line2 ?? '',
    city: patient.addressParts.city ?? '',
    state: patient.addressParts.state ?? '',
    zip: patient.addressParts.postalCode ?? '',
  };
}

export function patientToCreateInput(data: PatientForm): CreateBillingPatientInput {
  const address = buildAddressInput(data.line1, data.line2, data.city, data.state, data.zip);
  return {
    firstName: data.firstName!.trim(),
    lastName: data.lastName!.trim(),
    ...(data.dob ? { dob: data.dob } : {}),
    ...(data.gender ? { gender: data.gender as GenderOption } : {}),
    ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
    ...(data.email?.trim() ? { email: data.email.trim() } : {}),
    ...(address ? { address } : {}),
  };
}

export function patientToUpdateInput(data: PatientForm, patientId: string): UpdateBillingPatientInput {
  const address = buildAddressInput(data.line1, data.line2, data.city, data.state, data.zip);
  return {
    patientId,
    firstName: data.firstName!.trim(),
    lastName: data.lastName!.trim(),
    ...(data.dob ? { dob: data.dob } : {}),
    ...(data.gender ? { gender: data.gender as GenderOption } : {}),
    ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
    ...(data.email?.trim() ? { email: data.email.trim() } : {}),
    ...(address ? { address } : {}),
  };
}
