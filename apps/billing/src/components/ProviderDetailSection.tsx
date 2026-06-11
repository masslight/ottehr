import { Autocomplete, Box, FormControlLabel, Switch, TextField } from '@mui/material';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { BillingProviderOption, PractitionerQualificationCodesDisplay } from 'utils';
import { useApiClients } from '../hooks/useAppClients';
import { EditableSection } from './claim/EditableSection';
import { DetailRow } from './DetailRow';
import { Field } from './Field';

// Editable details card for a provider original (Rendering/Billing provider detail pages).
export function ProviderDetailSection({
  provider,
  onSaved,
}: {
  provider: BillingProviderOption;
  onSaved: () => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const isIndividual = provider.kind === 'individual';

  const [firstName, setFirstName] = useState(provider.firstName ?? '');
  const [lastName, setLastName] = useState(provider.lastName ?? '');
  const [orgName, setOrgName] = useState(isIndividual ? '' : provider.name);
  const [npi, setNpi] = useState(provider.npi);
  const [taxonomyCode, setTaxonomyCode] = useState(provider.taxonomyCode ?? '');
  const [licenseType, setLicenseType] = useState(provider.licenseType ?? '');
  const [taxId, setTaxId] = useState(provider.taxId ?? '');
  const [line1, setLine1] = useState(provider.addressParts?.line1 ?? '');
  const [line2, setLine2] = useState(provider.addressParts?.line2 ?? '');
  const [city, setCity] = useState(provider.addressParts?.city ?? '');
  const [state, setState] = useState(provider.addressParts?.state ?? '');
  const [zip, setZip] = useState(provider.addressParts?.postalCode ?? '');
  const [renders, setRenders] = useState(provider.renders);
  const [bills, setBills] = useState(provider.bills);

  const resetFields = useCallback((): void => {
    setFirstName(provider.firstName ?? '');
    setLastName(provider.lastName ?? '');
    setOrgName(provider.kind === 'individual' ? '' : provider.name);
    setNpi(provider.npi);
    setTaxonomyCode(provider.taxonomyCode ?? '');
    setLicenseType(provider.licenseType ?? '');
    setTaxId(provider.taxId ?? '');
    setLine1(provider.addressParts?.line1 ?? '');
    setLine2(provider.addressParts?.line2 ?? '');
    setCity(provider.addressParts?.city ?? '');
    setState(provider.addressParts?.state ?? '');
    setZip(provider.addressParts?.postalCode ?? '');
    setRenders(provider.renders);
    setBills(provider.bills);
  }, [provider]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const handleSave = async (): Promise<string | null> => {
    if (!oystehrZambda) return 'Client not ready';
    if (isIndividual && (!firstName.trim() || !lastName.trim())) return 'First and last name are required';
    if (!isIndividual && !orgName.trim()) return 'Organization name is required';
    if (!renders && !bills) return 'Select at least one role';

    const roles = [...(bills ? ['billing'] : []), ...(renders ? ['rendering'] : [])];
    const address = {
      ...(line1.trim() ? { line1: line1.trim() } : {}),
      ...(line2.trim() ? { line2: line2.trim() } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
      ...(state.trim() ? { state: state.trim() } : {}),
      ...(zip.trim() ? { postalCode: zip.trim() } : {}),
    };
    const payload = {
      kind: provider.kind,
      providerId: provider.id,
      roles,
      ...(isIndividual
        ? {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            ...(licenseType ? { licenseType } : {}),
          }
        : { name: orgName.trim() }),
      ...(npi.trim() ? { npi: npi.trim() } : {}),
      ...(taxonomyCode.trim() ? { taxonomyCode: taxonomyCode.trim() } : {}),
      ...(taxId.trim() ? { taxId: taxId.trim() } : {}),
      ...(Object.keys(address).length ? { address } : {}),
    };

    try {
      await oystehrZambda.zambda.execute({ id: 'update-billing-provider', ...payload });
    } catch (err) {
      return err instanceof Error ? err.message : 'Failed to save changes';
    }
    await onSaved();
    return null;
  };

  const rolesLabel = [provider.renders ? 'Rendering' : '', provider.bills ? 'Billing' : ''].filter(Boolean).join(', ');

  return (
    <EditableSection
      title="Provider Details"
      onSave={handleSave}
      onCancel={resetFields}
      editForm={
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25, maxWidth: 680 }}>
          {isIndividual ? (
            <>
              <Field label="First name">
                <TextField size="small" fullWidth value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </Field>
              <Field label="Last name">
                <TextField size="small" fullWidth value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </Field>
            </>
          ) : (
            <Field label="Organization name">
              <TextField size="small" fullWidth value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </Field>
          )}
          <Field label="NPI">
            <TextField size="small" fullWidth value={npi} onChange={(e) => setNpi(e.target.value)} />
          </Field>
          <Field label="Tax ID">
            <TextField size="small" fullWidth value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </Field>
          {isIndividual && (
            <Field label="License type">
              <Autocomplete
                size="small"
                options={PractitionerQualificationCodesDisplay}
                getOptionLabel={(o) => o.label}
                value={PractitionerQualificationCodesDisplay.find((o) => o.value === licenseType) ?? null}
                onChange={(_, v) => setLicenseType(v?.value ?? '')}
                isOptionEqualToValue={(o, v) => o.value === v.value}
                renderInput={(params) => <TextField {...params} placeholder="Select..." />}
              />
            </Field>
          )}
          <Field label="Taxonomy code">
            <TextField size="small" fullWidth value={taxonomyCode} onChange={(e) => setTaxonomyCode(e.target.value)} />
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
              <TextField
                size="small"
                fullWidth
                value={state}
                onChange={(e) => setState(e.target.value)}
                inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
              />
            </Field>
            <Field label="ZIP">
              <TextField size="small" fullWidth value={zip} onChange={(e) => setZip(e.target.value)} />
            </Field>
          </Box>
          <Box sx={{ gridColumn: '1 / -1', display: 'flex', gap: 4 }}>
            <FormControlLabel
              control={<Switch checked={renders} onChange={(e) => setRenders(e.target.checked)} />}
              label="Renders medical services"
            />
            <FormControlLabel
              control={<Switch checked={bills} onChange={(e) => setBills(e.target.checked)} />}
              label="Bills medical services"
            />
          </Box>
        </Box>
      }
    >
      <DetailRow label="Name" value={provider.name} />
      <DetailRow label="NPI" value={provider.npi} />
      <DetailRow label="Taxonomy Code" value={provider.taxonomyCode ?? ''} />
      {isIndividual && <DetailRow label="License Type" value={provider.licenseType ?? ''} />}
      <DetailRow label="Tax ID / EIN" value={provider.taxId ?? ''} />
      <DetailRow label="Address" value={provider.address ?? ''} />
      <DetailRow label="Roles" value={rolesLabel} />
    </EditableSection>
  );
}
