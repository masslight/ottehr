import { SaveServiceFacilityInput, ServiceFacilityItem } from 'utils';

export interface ServiceFacilityForm {
  name: string;
  npi: string;
  clia: string;
  placeOfService: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

export function emptyServiceFacilityForm(): ServiceFacilityForm {
  return {
    name: '',
    npi: '',
    clia: '',
    placeOfService: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
  };
}

export function defaultServiceFacilityFormValues(serviceFacility?: ServiceFacilityItem | null): ServiceFacilityForm {
  if (!serviceFacility) return emptyServiceFacilityForm();
  return {
    name: serviceFacility.name ?? '',
    npi: serviceFacility.npi ?? '',
    clia: serviceFacility.clia ?? '',
    placeOfService: serviceFacility.posCode ?? '',
    line1: serviceFacility.addressLine1 ?? '',
    line2: serviceFacility.addressLine2 ?? '',
    city: serviceFacility.city ?? '',
    state: serviceFacility.state ?? '',
    zip: serviceFacility.zip ?? '',
  };
}

export function serviceFacilityToSaveInput(
  data: ServiceFacilityForm,
  serviceFacilityId?: string
): SaveServiceFacilityInput {
  return {
    facilityId: serviceFacilityId,
    name: data.name.trim(),
    addressLine1: data.line1.trim(),
    ...(data.line2?.trim() ? { addressLine2: data.line2.trim() } : {}),
    city: data.city.trim(),
    state: data.state!,
    zip: data.zip.trim(),
    ...(data.npi?.trim() ? { npi: data.npi.trim() } : {}),
    ...(data.clia?.trim() ? { clia: data.clia.trim() } : {}),
    ...(data.placeOfService ? { posCode: data.placeOfService } : {}),
  };
}
