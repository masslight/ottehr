import { Autocomplete, Box, CircularProgress, Stack, TextField } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { saveFollowup } from 'src/api/api';
import { AccordionCard } from 'src/components/AccordionCard';
import LocationSelect from 'src/components/LocationSelect';
import { useApiClients } from 'src/hooks/useAppClients';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { FOLLOWUP_REASONS, FOLLOWUP_SYSTEMS, FollowupReason, PatientFollowupDetails } from 'utils';
import { useAppointmentData } from '../../../shared/stores/appointment/appointment.store';

interface FormData {
  reason: FollowupReason | null;
  otherReason?: string;
  location: LocationWithWalkinSchedule | undefined;
  message: string;
}

interface FormErrors {
  reason?: string;
  otherReason?: string;
  location?: string;
}

export const FollowUpSummaryCard: React.FC = () => {
  const { oystehrZambda } = useApiClients();
  const {
    encounter,
    resources: { patient },
  } = useAppointmentData();
  const [locations, setLocations] = useState<LocationWithWalkinSchedule[]>([]);

  const [formData, setFormData] = useState<FormData>({
    reason: null,
    otherReason: undefined,
    location: undefined,
    message: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (data: FormData): boolean => {
    const newErrors: FormErrors = {};

    if (!data.reason) {
      newErrors.reason = 'Reason is required';
    }
    if (data.reason === 'Other' && !data.otherReason?.trim()) {
      newErrors.otherReason = 'Other reason is required when "Other" is selected';
    }
    if (!data.location) {
      newErrors.location = 'Location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const { debounce } = useDebounce(1000);
  const debouncedSave = (data: FormData): void => {
    debounce(async () => {
      if (!oystehrZambda || !patient?.id || !encounter?.id) return;

      if (!validateForm(data)) {
        return;
      }

      setIsSaving(true);
      try {
        const encounterDetails: PatientFollowupDetails = {
          encounterId: encounter.id,
          followupType: 'Follow-up Encounter',
          patientId: patient.id,
          reason: data.reason || undefined,
          otherReason: data.reason === 'Other' ? data.otherReason : undefined,
          message: data.message,
          start: encounter.period?.start || new Date().toISOString(),
          location: data.location,
          resolved: false,
          answered: '',
          caller: '',
        };

        await saveFollowup(oystehrZambda, { encounterDetails });
      } catch (error) {
        console.error('Failed to save follow-up details:', error);
        enqueueSnackbar('Failed to save follow-up details', { variant: 'error' });
      } finally {
        setIsSaving(false);
      }
    });
  };

  useEffect(() => {
    if (encounter) {
      const reasonCode = encounter.reasonCode?.[0];
      const reason = reasonCode?.coding?.[0]?.display as FollowupReason;
      const otherReason = reason === 'Other' ? reasonCode?.text : undefined;

      const message = encounter.extension?.find((ext) => ext.url === FOLLOWUP_SYSTEMS.messageUrl)?.valueString || '';

      setFormData((prev) => ({
        ...prev,
        reason,
        otherReason,
        message,
      }));
    }
  }, [encounter]);

  useEffect(() => {
    if (locations.length > 0) {
      const currentLocation = locations.find(
        (location) => location.id === encounter.location?.[0]?.location?.reference?.split('/')[1]
      );
      setFormData((prev) => ({ ...prev, location: currentLocation }));
    }
  }, [encounter, locations]);

  const updateFormData = (fields: Partial<FormData>): void => {
    const newData = { ...formData, ...fields };
    setFormData(newData);

    (Object.keys(fields) as (keyof FormData)[]).forEach((field) => {
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    });

    debouncedSave(newData);
  };

  return (
    <AccordionCard label="Summary" headerItem={isSaving && <CircularProgress size="20px" />}>
      <Stack spacing={2} sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Autocomplete
            options={FOLLOWUP_REASONS}
            onChange={(_, newVal) => {
              const newData: Partial<FormData> = { reason: newVal || null };
              if (newVal !== 'Other') {
                newData.otherReason = undefined;
              }
              updateFormData(newData);
            }}
            size="small"
            sx={{ minWidth: 250 }}
            value={formData.reason}
            renderInput={(params) => (
              <TextField
                placeholder="Select reason"
                name="reason"
                {...params}
                label="Follow-up Reason"
                error={!!errors.reason}
                helperText={errors.reason}
              />
            )}
          />

          {formData.reason === 'Other' && (
            <TextField
              fullWidth
              size="small"
              label="Other reason"
              variant="outlined"
              value={formData.otherReason || ''}
              onChange={(e) => updateFormData({ otherReason: e.target.value })}
              placeholder="Please specify the reason"
              error={!!errors.otherReason}
              helperText={errors.otherReason}
            />
          )}

          <Box sx={{ minWidth: 250 }}>
            <LocationSelect
              location={formData.location}
              setLocation={(location) => updateFormData({ location })}
              updateURL={false}
              renderInputProps={{
                size: 'small',
              }}
              setLocations={setLocations}
            />
          </Box>
        </Box>

        <TextField
          label="Summary"
          multiline
          rows={3}
          value={formData.message}
          onChange={(e) => updateFormData({ message: e.target.value })}
          placeholder="Enter follow-up summary..."
          fullWidth
        />
      </Stack>
    </AccordionCard>
  );
};
