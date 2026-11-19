import { Autocomplete, Box, CircularProgress, Skeleton, Stack, TextField, Typography, useTheme } from '@mui/material';
import { FC, useEffect, useMemo, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import {
  isScheduledFollowupEncounter,
  SCHEDULED_FOLLOWUP_OTHER_REASON,
  SCHEDULED_FOLLOWUP_REASONS,
} from 'utils/lib/fhir/encounter';
import { getCoding } from 'utils/lib/fhir/helpers';
import { useChartSection } from './shared/hooks/useChartSection';
import { useDebounceNotesField } from './shared/hooks/useDebounceNotesField';
import { useReasonForVisitOptions } from './shared/hooks/useReasonForVisitOptions';
import { useAppointmentData, useSaveChartData } from './shared/stores/appointment/appointment.store';

export const ReasonForVisitField: FC = () => {
  const saveChartData = useSaveChartData();
  const { appointment, encounter } = useAppointmentData();
  const isScheduledFollowUp = encounter ? isScheduledFollowupEncounter(encounter) : false;

  const [reasonForVisit, setReasonForVisit] = useState<string>('');
  // Scheduled follow-ups pick from a fixed list; "Other" is stored as this free text.
  const [otherReason, setOtherReason] = useState<string>('');
  const { data: chartFields, isFetched: isChartFieldsFetched, setSectionData } = useChartSection('encounterNotes');

  // Service-category options resolve via the shared hook (covers admin-managed FHIR categories);
  // scheduled follow-ups use the fixed reason list instead.
  const serviceCategory = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
  const serviceCategoryRfvOptions = useReasonForVisitOptions(serviceCategory || 'urgent-care');
  const rfvOptions = useMemo(
    () =>
      isScheduledFollowUp
        ? SCHEDULED_FOLLOWUP_REASONS.map((reason) => ({ value: reason, label: reason }))
        : serviceCategoryRfvOptions,
    [isScheduledFollowUp, serviceCategoryRfvOptions]
  );

  // Keyed on the stored text, so saves of other fields in the section don't reset an unsaved selection.
  const storedReasonText = chartFields?.reasonForVisit?.text ?? '';
  useEffect(() => {
    if (!isChartFieldsFetched) return;
    // A stored reason outside the fixed follow-up list is a free-text "Other".
    const isOtherStored =
      isScheduledFollowUp && !!storedReasonText && !SCHEDULED_FOLLOWUP_REASONS.includes(storedReasonText as never);
    setReasonForVisit(isOtherStored ? SCHEDULED_FOLLOWUP_OTHER_REASON : storedReasonText);
    setOtherReason(isOtherStored ? storedReasonText : '');
  }, [storedReasonText, isChartFieldsFetched, isScheduledFollowUp]);

  const isOtherReason = isScheduledFollowUp && reasonForVisit === SCHEDULED_FOLLOWUP_OTHER_REASON;
  // Free-text "Other" reason: debounced save (with cache sync / dedup) like other chart note fields.
  const { onValueChange: onOtherReasonChange, isLoading: isOtherReasonSaving } =
    useDebounceNotesField('reasonForVisit');

  const handleOtherReasonChange = (value: string): void => {
    setOtherReason(value);
    onOtherReasonChange(value);
  };

  // String options: MUI resets the typed text whenever the value's object identity changes.
  const reasonLabels = useMemo(() => new Map(rfvOptions.map((opt) => [opt.value, opt.label])), [rfvOptions]);
  // Defer binding the value until its options resolve, so a saved value not yet in the loaded
  // catalog doesn't trigger MUI's out-of-range warning; it snaps in once options arrive.
  const safeValue = reasonLabels.has(reasonForVisit) ? reasonForVisit : null;

  return (
    <Stack spacing={2}>
      <Autocomplete<string, false, boolean, false>
        data-testid={dataTestIds.addPatientPage.reasonForVisitDropdown}
        id="reason-for-visit-select"
        fullWidth
        disableClearable
        autoHighlight
        options={[...reasonLabels.keys()]}
        getOptionKey={(value) => value}
        getOptionLabel={(value) => reasonLabels.get(value) ?? value}
        value={safeValue}
        disabled={chartFields === undefined || saveChartData.isPending}
        renderInput={(params) => <TextField {...params} label="Reason for today's visit" />}
        onChange={(_event, value) => {
          if (!value) return;
          setReasonForVisit(value);
          // "Other" is persisted only once the free text is entered.
          if (isScheduledFollowUp && value === SCHEDULED_FOLLOWUP_OTHER_REASON) {
            return;
          }
          setOtherReason('');
          // Keep the cached section current so another field's save to it doesn't restore the old value here.
          // The save response doesn't echo reasonForVisit (it lives on the Encounter), so the cache keeps this.
          const previousReason = chartFields?.reasonForVisit;
          setSectionData({ reasonForVisit: { ...previousReason, text: value } });
          saveChartData.mutate(
            { reasonForVisit: { text: value } },
            { onError: () => setSectionData({ reasonForVisit: previousReason }) }
          );
        }}
      />

      {isOtherReason && (
        <TextField
          fullWidth
          label="Other reason"
          id="reason-for-visit-other-text"
          value={otherReason}
          onChange={(e) => handleOtherReasonChange(e.target.value)}
          InputProps={{
            endAdornment: isOtherReasonSaving && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size="20px" />
              </Box>
            ),
          }}
        />
      )}
    </Stack>
  );
};

type ReasonForVisitSource = 'patient' | 'intake';

const LABEL_BY_SOURCE: Record<ReasonForVisitSource, string> = {
  patient: "Reason for today's visit selected by patient",
  intake: "Reason for today's visit verified on intake",
};

interface ReasonForVisitFieldReadOnlyProps {
  valueSource?: ReasonForVisitSource;
}

export const ReasonForVisitFieldReadOnly: FC<ReasonForVisitFieldReadOnlyProps> = ({ valueSource = 'patient' }) => {
  const theme = useTheme();
  const { isAppointmentLoading, appointment, encounter } = useAppointmentData();

  const label = LABEL_BY_SOURCE[valueSource];

  const valueSelectors: Record<ReasonForVisitSource, string> = {
    patient: appointment?.description ?? '',
    intake: encounter?.extension?.find((e) => e.url === 'reason-for-visit')?.valueString ?? '',
  };
  const value = valueSelectors[valueSource];

  return (
    <Box>
      <Typography variant="subtitle2" color={theme.palette.primary.dark}>
        {label}
      </Typography>
      {isAppointmentLoading ? (
        <Skeleton width="100%">
          <Typography>.</Typography>
        </Skeleton>
      ) : (
        <Typography variant="body2" data-testid={dataTestIds.telemedEhrFlow.hpiReasonForVisit}>
          {value}
        </Typography>
      )}
    </Box>
  );
};
