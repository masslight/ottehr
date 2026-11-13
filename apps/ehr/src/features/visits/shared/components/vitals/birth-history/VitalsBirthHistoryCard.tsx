import { Box, Button, Grid, Typography } from '@mui/material';
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { JSX, ReactNode, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useBirthHistory, useSaveBirthHistory } from 'src/hooks/useBirthHistory';
import { formatBirthHistorySummary } from 'utils/lib/helpers/vitals/birth-history.helper';
import { BirthHistory } from 'utils/lib/types/api/birth-history.types';
import { DISPLAY_DATE_FORMAT } from 'utils/lib/utils/dateUtils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from '../../../stores/appointment/appointment.store';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { VitalsUnitInputRow } from '../components/VitalsUnitInputRow';
import { VITALS_FORM_BORDER_TRANSITION, VITALS_FORM_ERROR_BORDER } from '../constants';
import { useVitalsUnitInputOrder } from '../hooks/useVitalsUnitInputOrder';
import { PairedMeasureState, useBirthHistoryLocalState } from './useBirthHistoryLocalState';

interface VitalsBirthHistoryCardProps {
  /** Collapsed until staff open it (patients 24 months and older); open otherwise. */
  collapsedByDefault: boolean;
}

/**
 * Birth history: time of birth, gestational age, birth weight / length / head circumference. Saved once per
 * patient (not per visit), so every visit's Vitals screen shows and edits the same record.
 */
const VitalsBirthHistoryCard: React.FC<VitalsBirthHistoryCardProps> = ({ collapsedByDefault }): JSX.Element => {
  const {
    resources: { patient },
  } = useAppointmentData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { data, isLoading } = useBirthHistory(patient?.id);
  const saved = data?.birthHistory;
  const save = useSaveBirthHistory(patient?.id);
  const [toggledCollapsed, setToggledCollapsed] = useState<boolean>();
  const [editing, setEditing] = useState(false);
  // Once saved, the card rests collapsed on its summary line until staff choose Edit.
  const isCollapsed = toggledCollapsed ?? (collapsedByDefault || (!!saved && !editing));

  const summary = saved ? formatBirthHistorySummary(saved) : '';
  const dateOfBirth = patient?.birthDate ? DateTime.fromISO(patient.birthDate).toFormat(DISPLAY_DATE_FORMAT) : '';

  return (
    <AccordionCard
      label={
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" color="primary.dark">
            Birth history
          </Typography>
          {summary && <Typography variant="body2">{summary}</Typography>}
        </Box>
      }
      collapsed={isCollapsed}
      onSwitch={() => setToggledCollapsed(!isCollapsed)}
      dataTestId={dataTestIds.vitalsPage.birthHistoryHeader}
      headerItem={
        saved && !isReadOnly && !editing ? (
          <Button
            size="small"
            variant="text"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
              setToggledCollapsed(false);
            }}
          >
            Edit
          </Button>
        ) : undefined
      }
    >
      {!isLoading && !isReadOnly && (!saved || editing) && (
        <BirthHistoryForm
          key={saved?.resourceId ?? 'new'}
          saved={saved}
          dateOfBirth={dateOfBirth}
          isSaving={save.isPending}
          onSave={(value) =>
            save.mutate(value, {
              onSuccess: () => {
                setEditing(false);
                setToggledCollapsed(undefined);
              },
              onError: () => enqueueSnackbar('Error saving birth history', { variant: 'error' }),
            })
          }
        />
      )}
      {(isReadOnly || (saved && !editing)) && (
        <Typography sx={{ px: 2, py: 1.5 }} color={summary ? 'text.primary' : 'text.secondary'}>
          {summary || 'No birth history recorded'}
        </Typography>
      )}
    </AccordionCard>
  );
};

const Row = ({ label, children }: { label: string; children: ReactNode }): JSX.Element => (
  <Grid container alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
    <Grid item xs={12} sm={4}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Grid>
    <Grid item xs={12} sm={8}>
      {children}
    </Grid>
  </Grid>
);

const BirthHistoryForm = ({
  saved,
  dateOfBirth,
  isSaving,
  onSave,
}: {
  saved?: BirthHistory;
  dateOfBirth: string;
  isSaving: boolean;
  onSave: (value: BirthHistory) => void;
}): JSX.Element => {
  const state = useBirthHistoryLocalState(saved);
  const unitInputOrder = useVitalsUnitInputOrder();
  const value = state.getValue();
  const measureRow = (
    label: string,
    measure: PairedMeasureState,
    metricUnit: string,
    imperialUnit: string
  ): JSX.Element => (
    <Row label={label}>
      <VitalsUnitInputRow
        order={unitInputOrder}
        metricInput={
          <VitalsTextInputFiled
            label={metricUnit}
            value={measure.metricText}
            disabled={isSaving}
            onChange={measure.handleMetricChange}
          />
        }
        imperialInput={
          <VitalsTextInputFiled
            label={imperialUnit}
            value={measure.imperialText}
            disabled={isSaving}
            onChange={measure.handleImperialChange}
          />
        }
      />
    </Row>
  );

  return (
    <Box
      sx={{
        backgroundColor: '#F7F8F9',
        borderRadius: 2,
        m: 2,
        p: 2,
        maxWidth: 720,
        // A value that is not a number gets the red border the other vitals cards use.
        border: value ? 'none' : VITALS_FORM_ERROR_BORDER,
        transition: VITALS_FORM_BORDER_TRANSITION,
      }}
    >
      <Row label="Date of birth">
        <Typography>{dateOfBirth}</Typography>
      </Row>
      <Row label="Time of birth">
        <LocalizationProvider dateAdapter={AdapterLuxon}>
          <TimePicker
            value={state.timeOfBirth}
            onChange={state.setTimeOfBirth}
            disabled={isSaving}
            slotProps={{ textField: { size: 'small', sx: { backgroundColor: 'white', maxWidth: 200 } } }}
          />
        </LocalizationProvider>
      </Row>
      <Row label="Gestational age">
        <Box sx={{ display: 'flex', gap: 1, maxWidth: 300 }}>
          <VitalsTextInputFiled
            label="weeks"
            value={state.weeks}
            disabled={isSaving}
            onChange={(e) => state.setWeeks(e.target.value)}
          />
          <VitalsTextInputFiled
            label="days"
            value={state.days}
            disabled={isSaving}
            onChange={(e) => state.setDays(e.target.value)}
          />
        </Box>
      </Row>
      {measureRow('Birth weight', state.weight, 'kg', 'lbs')}
      {measureRow('Birth length', state.length, 'cm', 'inches')}
      {measureRow('Birth head circumference', state.headCircumference, 'cm', 'inches')}
      <RoundedButton
        size="small"
        color="primary"
        disabled={!value || Object.keys(value).length === 0}
        loading={isSaving}
        onClick={() => value && onSave(value)}
        sx={{ height: '40px', px: 3 }}
        data-testid={dataTestIds.vitalsPage.birthHistorySaveButton}
      >
        Save
      </RoundedButton>
    </Box>
  );
};

export default VitalsBirthHistoryCard;
