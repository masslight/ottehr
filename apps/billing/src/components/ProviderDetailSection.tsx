import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { BillingProviderOption, CreateBillingProviderInput, getApiError, UpdateBillingProviderInput } from 'utils';
import { updateBillingProvider } from '../api/api';
import {
  defaultProviderFormValues,
  ProviderForm,
  ProviderRole,
  providerToCreateInput,
  providerToUpdateInput,
} from '../constants/provider';
import { useApiClients } from '../hooks/useAppClients';
import { formatTaxId } from '../utils/format';
import { AddressFields } from './AddressFields';
import { EditableSection } from './claim/EditableSection';
import { ProviderFields } from './ProviderFields';
import { Row } from './Row';

export function ProviderDetailSection({
  provider,
  role,
  onSaved,
}: {
  provider: BillingProviderOption;
  role: ProviderRole;
  onSaved: () => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();

  const handleSave = async (
    payload: CreateBillingProviderInput | UpdateBillingProviderInput
  ): Promise<string | null> => {
    if (!oystehrZambda) return 'Client not ready';
    try {
      if (!('providerId' in payload && payload.providerId)) {
        return 'Could not save provider, no ID provided';
      }
      await updateBillingProvider(oystehrZambda, payload);
    } catch (err) {
      return getApiError({ error: err, defaultError: 'Failed to save changes' });
    }
    await onSaved();
    return null;
  };

  return <ProviderDetailForm provider={provider} role={role} onSave={handleSave} />;
}

export function ProviderDetailForm({
  provider,
  role,
  onSave,
  onCancel,
  selector,
}: {
  provider: BillingProviderOption | null;
  role: ProviderRole;
  onSave: (payload: CreateBillingProviderInput | UpdateBillingProviderInput) => Promise<string | null>;
  onCancel?: () => void;
  selector?: {
    options: BillingProviderOption[];
    selectedOption: BillingProviderOption | null;
    onSelectOption: (value: BillingProviderOption | null) => void;
    fetchOptions: (value?: string) => void;
  };
}): ReactElement {
  const rolesLabel = [provider?.renders ? 'Rendering' : '', provider?.bills ? 'Billing' : '']
    .filter(Boolean)
    .join(', ');
  const defaultValues = defaultProviderFormValues(role, provider);
  const handleSave = async (data: ProviderForm): Promise<string | null> => {
    if (!data.renders && !data.bills) return 'Provider must render or bill';
    return onSave(provider?.id ? providerToUpdateInput(data, provider.id) : providerToCreateInput(data));
  };
  return (
    <EditableSection
      title="Provider Details"
      defaultValues={defaultValues}
      onSave={handleSave}
      onCancel={onCancel}
      editForm={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          {selector ? (
            <Autocomplete
              size="small"
              options={selector.options}
              value={selector.selectedOption}
              onChange={(_, v) => selector.onSelectOption(v)}
              onInputChange={(_, val, reason) => {
                if (reason === 'input') selector.fetchOptions(val || undefined);
              }}
              onOpen={() => selector.fetchOptions()}
              filterOptions={(x) => x}
              getOptionLabel={(o) => o.name}
              renderOption={(props, o) => (
                <Box component="li" {...props} key={o.id}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {o.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      NPI: {o.npi} | TIN: {o.taxId}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(p) => (
                <TextField
                  {...p}
                  size="small"
                  label={provider ? 'Replace billing provider' : 'Choose billing provider'}
                />
              )}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              sx={{ maxWidth: 480 }}
            />
          ) : (
            <></>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2.25, maxWidth: 680 }}>
            <ProviderFields />
            <AddressFields />
          </Box>
        </Box>
      }
    >
      <Row label="Name" value={provider?.name ?? ''} />
      <Row label="NPI" value={provider?.npi ?? ''} />
      <Row label="Taxonomy Code" value={provider?.taxonomyCode ?? ''} />
      {provider?.kind === 'individual' && <Row label="License Type" value={provider?.licenseType ?? ''} />}
      <Row label="Tax ID / EIN" value={formatTaxId(provider?.taxId ?? '')} />
      {provider?.kind === 'organization' && <Row label="Stripe Account ID" value={provider.stripeAccountId ?? ''} />}
      <Row label="Address" value={provider?.address ?? ''} />
      <Row label="Roles" value={rolesLabel} hideBorder />
    </EditableSection>
  );
}
