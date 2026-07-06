import { Autocomplete, Box, TextField } from '@mui/material';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import {
  AllStates,
  CMS_PLACE_OF_SERVICE_CODES,
  getApiError,
  SaveServiceFacilityInput,
  ServiceFacilityItem,
} from 'utils';
import { saveBillingServiceFacility } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { formatFacilityAddress, placeOfServiceLabel } from '../utils/format';
import { validateServiceFacilityFields } from '../utils/validation';
import { EditableSection } from './claim/EditableSection';
import { DetailRow } from './DetailRow';
import { Field } from './Field';
import { ZipInput } from './input/ZipInput';

export function ServiceFacilityDetailSection({
  facility,
  onSaved,
}: {
  facility: ServiceFacilityItem;
  onSaved: () => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [name, setName] = useState(facility.name);
  const [line1, setLine1] = useState(facility.addressLine1);
  const [line2, setLine2] = useState(facility.addressLine2);
  const [city, setCity] = useState(facility.city);
  const [state, setState] = useState(facility.state);
  const [zip, setZip] = useState(facility.zip);
  const [npi, setNpi] = useState(facility.npi);
  const [clia, setClia] = useState(facility.clia);
  const [posCode, setPosCode] = useState(facility.posCode);

  const resetFields = useCallback((): void => {
    setName(facility.name);
    setLine1(facility.addressLine1);
    setLine2(facility.addressLine2);
    setCity(facility.city);
    setState(facility.state);
    setZip(facility.zip);
    setNpi(facility.npi);
    setClia(facility.clia);
    setPosCode(facility.posCode);
  }, [facility]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const handleSave = async (): Promise<string | null> => {
    if (!oystehrZambda) return 'Client not ready';
    if (!name.trim() || !line1.trim() || !city.trim() || !state || !zip.trim()) {
      return 'Name, address line 1, city, state, and ZIP are required';
    }
    const validationError = validateServiceFacilityFields({ npi, clia, zip });
    if (validationError) return validationError;

    // exists = set, clear:
    //   npi/clia/posCode: null
    //   line2: exclude
    //   others: empty string
    const payload: SaveServiceFacilityInput = {
      facilityId: facility.id,
      name: name.trim(),
      addressLine1: line1.trim(),
      ...(line2.trim() ? { addressLine2: line2.trim() } : {}),
      city: city.trim(),
      state,
      zip: zip.trim(),
      npi: npi.trim() || null,
      clia: clia.trim() || null,
      posCode: posCode || null,
    };

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

  return (
    <EditableSection
      title="Service Facility Details"
      onSave={handleSave}
      onCancel={resetFields}
      editForm={
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25, maxWidth: 680 }}>
          <Field label="Name">
            <TextField size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="NPI">
            <TextField size="small" fullWidth value={npi} onChange={(e) => setNpi(e.target.value)} />
          </Field>
          <Field label="CLIA Number">
            <TextField size="small" fullWidth value={clia} onChange={(e) => setClia(e.target.value)} />
          </Field>
          <Field label="Place of Service">
            <Autocomplete
              size="small"
              options={CMS_PLACE_OF_SERVICE_CODES}
              getOptionLabel={(o) => `${o.code} - ${o.display}`}
              value={CMS_PLACE_OF_SERVICE_CODES.find((o) => o.code === posCode) ?? null}
              onChange={(_, v) => setPosCode(v?.code ?? '')}
              isOptionEqualToValue={(o, v) => o.code === v.code}
              renderInput={(params) => <TextField {...params} placeholder="Select..." />}
            />
          </Field>
          <Field label="Address line 1">
            <TextField size="small" fullWidth value={line1} onChange={(e) => setLine1(e.target.value)} />
          </Field>
          <Field label="Address line 2">
            <TextField size="small" fullWidth value={line2} onChange={(e) => setLine2(e.target.value)} />
          </Field>
          <Field label="City">
            <TextField size="small" fullWidth value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Field label="State">
              <Autocomplete
                size="small"
                options={AllStates}
                getOptionLabel={(o) => o.value}
                value={AllStates.find((o) => o.value === state) ?? null}
                onChange={(_, v) => setState(v?.value ?? '')}
                isOptionEqualToValue={(o, v) => o.value === v.value}
                renderInput={(params) => <TextField {...params} placeholder="Select..." />}
              />
            </Field>
            <Field label="Zip">
              <ZipInput value={zip} onChange={setZip} />
            </Field>
          </Box>
        </Box>
      }
    >
      <DetailRow label="Name" value={facility.name} />
      <DetailRow label="NPI" value={facility.npi} />
      <DetailRow label="CLIA Number" value={facility.clia} />
      <DetailRow label="Place of Service" value={placeOfServiceLabel(facility.posCode)} />
      <DetailRow label="Address" value={formatFacilityAddress(facility)} />
    </EditableSection>
  );
}
