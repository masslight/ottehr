import { BillingProviderOption, CreateBillingProviderInput, UpdateBillingProviderInput } from 'utils';
import { buildAddressInput } from '../utils/format';

export type ProviderRole = 'billing' | 'rendering';
type ProviderKind = 'individual' | 'organization';

export interface ProviderForm {
  kind: ProviderKind;
  firstName: string;
  lastName: string;
  orgName: string;
  npi: string;
  licenseType: string;
  taxonomyCode: string;
  taxId: string;
  stripeAccountId: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  renders: boolean;
  bills: boolean;
}

export function emptyProviderForm(defaultRole: ProviderRole): ProviderForm {
  return {
    kind: defaultRole === 'rendering' ? 'individual' : 'organization',
    firstName: '',
    lastName: '',
    orgName: '',
    npi: '',
    licenseType: '',
    taxonomyCode: '',
    taxId: '',
    stripeAccountId: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
    renders: defaultRole === 'rendering',
    bills: defaultRole === 'billing',
  };
}

export function defaultProviderFormValues(
  defaultRole: ProviderRole,
  provider?: BillingProviderOption | null
): ProviderForm {
  if (!provider) return emptyProviderForm(defaultRole);
  return {
    kind: provider.kind,
    firstName: provider.firstName ?? '',
    lastName: provider.lastName ?? '',
    orgName: provider.name ?? '',
    npi: provider.npi ?? '',
    licenseType: provider.licenseType ?? '',
    taxonomyCode: provider.taxonomyCode ?? '',
    taxId: provider.taxId ?? '',
    stripeAccountId: provider.stripeAccountId ?? '',
    line1: provider.addressParts?.line1 ?? '',
    line2: provider.addressParts?.line2 ?? '',
    city: provider.addressParts?.city ?? '',
    state: provider.addressParts?.state ?? '',
    zip: provider.addressParts?.postalCode ?? '',
    renders: provider.renders,
    bills: provider.bills,
  };
}

export function providerToCreateInput(data: ProviderForm): CreateBillingProviderInput {
  const roles: ProviderRole[] = [
    ...(data.bills ? (['billing'] as const) : []),
    ...(data.renders ? (['rendering'] as const) : []),
  ];
  const address = buildAddressInput(data.line1, data.line2, data.city, data.state, data.zip);
  const common: Pick<CreateBillingProviderInput, 'roles' | 'npi' | 'taxonomyCode' | 'taxId' | 'address'> = {
    roles,
    ...(data.npi?.trim() ? { npi: data.npi.trim() } : {}),
    ...(data.taxonomyCode?.trim() ? { taxonomyCode: data.taxonomyCode.trim() } : {}),
    ...(data.taxId?.trim() ? { taxId: data.taxId.trim() } : {}),
    ...(address ? { address } : {}),
  };
  let payload: CreateBillingProviderInput;
  if (data.kind === 'individual') {
    payload = {
      kind: data.kind,
      firstName: data.firstName!.trim(),
      lastName: data.lastName!.trim(),
      ...(data.licenseType ? { licenseType: data.licenseType } : {}),
      ...common,
    };
  } else {
    payload = {
      kind: data.kind,
      name: data.orgName!.trim(),
      ...(data.stripeAccountId?.trim() ? { stripeAccountId: data.stripeAccountId.trim() } : {}),
      ...common,
    };
  }
  return payload;
}

export function providerToUpdateInput(data: ProviderForm, providerId: string): UpdateBillingProviderInput {
  const roles = [...(data.bills ? (['billing'] as const) : []), ...(data.renders ? (['rendering'] as const) : [])];
  const address = buildAddressInput(data.line1, data.line2, data.city, data.state, data.zip);
  const common: Pick<
    UpdateBillingProviderInput,
    'providerId' | 'roles' | 'npi' | 'taxonomyCode' | 'taxId' | 'address'
  > = {
    providerId,
    roles,
    ...(data.npi?.trim() ? { npi: data.npi.trim() } : {}),
    ...(data.taxonomyCode?.trim() ? { taxonomyCode: data.taxonomyCode.trim() } : {}),
    ...(data.taxId?.trim() ? { taxId: data.taxId.trim() } : {}),
    ...(address ? { address } : {}),
  };
  let payload: UpdateBillingProviderInput;
  if (data.kind === 'individual') {
    payload = {
      kind: data.kind,
      firstName: data.firstName!.trim(),
      lastName: data.lastName!.trim(),
      ...(data.licenseType ? { licenseType: data.licenseType } : {}),
      ...common,
    };
  } else {
    payload = {
      kind: data.kind,
      name: data.orgName!.trim(),
      ...(data.stripeAccountId?.trim() ? { stripeAccountId: data.stripeAccountId.trim() } : {}),
      ...common,
    };
  }
  return payload;
}
