import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { getApiError, SaveServiceFacilityInput, ServiceFacilityItem } from 'utils';
import { saveBillingServiceFacility } from '../api/api';
import {
  defaultServiceFacilityFormValues,
  ServiceFacilityForm,
  serviceFacilityToSaveInput,
} from '../constants/serviceFacility';
import { useApiClients } from '../hooks/useAppClients';
import { formatFacilityAddress, placeOfServiceLabel } from '../utils/format';
import { AddressFields } from './AddressFields';
import { EditableSection } from './claim/EditableSection';
import { Row } from './Row';
import { ServiceFacilityFields } from './ServiceFacilityFields';

export function ServiceFacilityDetailSection({
  facility,
  onSaved,
}: {
  facility: ServiceFacilityItem;
  onSaved: () => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();

  const handleSave = async (payload: SaveServiceFacilityInput): Promise<string | null> => {
    if (!oystehrZambda) return 'Client not ready';

    try {
      await saveBillingServiceFacility(oystehrZambda, payload);
    } catch (err) {
      return getApiError({
        error: err,
        defaultError: 'Failed to save changes',
      });
    }
    await onSaved();
    return null;
  };

  return <ServiceFacilityDetailForm facility={facility} onSave={handleSave} />;
}

export function ServiceFacilityDetailForm({
  facility,
  onSave,
  onCancel,
  selector,
}: {
  facility: ServiceFacilityItem | null;
  onSave: (payload: SaveServiceFacilityInput) => Promise<string | null>;
  onCancel?: () => void;
  selector?: {
    options: ServiceFacilityItem[];
    selectedOption: ServiceFacilityItem | null;
    onSelectOption: (value: ServiceFacilityItem | null) => void;
    fetchOptions: (value?: string) => void;
  };
}): ReactElement {
  const defaultValues = defaultServiceFacilityFormValues(facility);
  const handleSave = async (data: ServiceFacilityForm): Promise<string | null> => {
    return onSave(serviceFacilityToSaveInput(data, facility?.id));
  };
  return (
    <EditableSection
      title="Service Facility Details"
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
                      NPI: {o.npi} | {formatFacilityAddress(o)}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(p) => (
                <TextField {...p} size="small" label={facility ? 'Replace facility' : 'Choose facility'} />
              )}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              sx={{ maxWidth: 480 }}
            />
          ) : (
            <></>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2.25, maxWidth: 680 }}>
            <ServiceFacilityFields />
            <AddressFields requireFullZip />
          </Box>
        </Box>
      }
    >
      <Row label="Name" value={facility?.name ?? ''} />
      <Row label="NPI" value={facility?.npi ?? ''} />
      <Row label="CLIA Number" value={facility?.clia ?? ''} />
      <Row label="Place of Service" value={placeOfServiceLabel(facility?.posCode)} />
      <Row label="Address" value={formatFacilityAddress(facility)} hideBorder />
    </EditableSection>
  );
}
