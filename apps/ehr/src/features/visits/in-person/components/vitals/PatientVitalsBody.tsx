import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Stack, Typography } from '@mui/material';
import { FC, useCallback } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { UnsavedDraftWarning } from 'src/components/UnsavedDraftWarning';
import { dataTestIds } from 'src/constants/data-test-ids';
import VitalsNotesCard from 'src/features/visits/shared/components/patient-info/VitalsNotesCard';
import VitalsBloodPressureCard from 'src/features/visits/shared/components/vitals/blood-pressure/VitalsBloodPressureCard';
import VitalsBMICard from 'src/features/visits/shared/components/vitals/bmi/VitalsBMICard';
import VitalsHeartbeatCard from 'src/features/visits/shared/components/vitals/heartbeat/VitalsHeartbeatCard';
import VitalsHeightCard from 'src/features/visits/shared/components/vitals/heights/VitalsHeightCard';
import { useVitalsManagement } from 'src/features/visits/shared/components/vitals/hooks/useVitalsManagement';
import VitalsLastMenstrualPeriodCard from 'src/features/visits/shared/components/vitals/last-menstrual-period/VitalsLastMenstrualPeriodCard';
import VitalsOxygenSatCard from 'src/features/visits/shared/components/vitals/oxygen-saturation/VitalsOxygenSatCard';
import VitalsRespirationRateCard from 'src/features/visits/shared/components/vitals/respiration-rate/VitalsRespirationRateCard';
import VitalsTemperaturesCard from 'src/features/visits/shared/components/vitals/temperature/VitalsTemperaturesCard';
import VitalsVisionCard from 'src/features/visits/shared/components/vitals/vision/VitalsVisionCard';
import VitalsWeightsCard from 'src/features/visits/shared/components/vitals/weights/VitalsWeightsCard';
import { useMarkDraftNavigatedAway, useVitalsDraftStore } from 'src/state/draft-data.store';
import { Loader } from '../../../shared/components/Loader';
import { AbnormalVitalsModal } from '../../../shared/components/vitals/AbnormalVitalsModal';
import { useGetAppointmentAccessibility } from '../../../shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from '../../../shared/stores/appointment/appointment.store';

export const PatientVitalsBody: FC = () => {
  const {
    resources: { encounter },
  } = useAppointmentData();

  const encounterId = encounter?.id ?? '';
  const vitals = useVitalsManagement({ encounterId });

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { setDraft, getDraft } = useVitalsDraftStore();
  const vitalsDraft = getDraft(encounterId);

  // Once any vital writes a draft, the store has an entry for that encounterId. When we later call
  // setDraft(...) to clear a single vital, the entry is still there — it just has undefined at that key.
  // So to determine if there is anything in the draft, need to check all values
  const hasVitalsData = !!(
    vitalsDraft.temperature ||
    vitalsDraft.heartbeat ||
    vitalsDraft.respirationRate ||
    vitalsDraft.bloodPressure ||
    vitalsDraft.oxygenSat ||
    vitalsDraft.weight ||
    vitalsDraft.height ||
    vitalsDraft.vision ||
    vitalsDraft.lmp
  );

  const hasVitalsDraft = useCallback(
    (encId: string): boolean => {
      const d = getDraft(encId);
      return !!(
        d.temperature ||
        d.heartbeat ||
        d.respirationRate ||
        d.bloodPressure ||
        d.oxygenSat ||
        d.weight ||
        d.height ||
        d.vision ||
        d.lmp
      );
    },
    [getDraft]
  );

  useMarkDraftNavigatedAway({ encounterId, setDraft, hasDraft: hasVitalsDraft });

  if (vitals.data.isLoading) return <Loader />;

  return (
    <Stack spacing={1}>
      {hasVitalsData && (
        <UnsavedDraftWarning
          message={
            vitalsDraft.hasNavigatedAway
              ? 'Your previously entered data has been restored. Click the clear button on any vital card to discard it.'
              : 'You have vitals in progress. Your draft will be saved.'
          }
          onClearAll={vitals.clearAllDrafts}
        />
      )}
      <Box ref={vitals.refs.temperature}>
        <VitalsTemperaturesCard field={vitals.fields.temperature} />
      </Box>
      <Box ref={vitals.refs.heartbeat}>
        <VitalsHeartbeatCard field={vitals.fields.heartbeat} />
      </Box>
      <Box ref={vitals.refs.respirationRate}>
        <VitalsRespirationRateCard field={vitals.fields.respirationRate} />
      </Box>
      <Box ref={vitals.refs.bloodPressure}>
        <VitalsBloodPressureCard field={vitals.fields.bloodPressure} />
      </Box>
      <Box ref={vitals.refs.oxygenSat}>
        <VitalsOxygenSatCard field={vitals.fields.oxygenSat} />
      </Box>
      <Box ref={vitals.refs.weight}>
        <VitalsWeightsCard field={vitals.fields.weight} />
      </Box>
      <Box ref={vitals.refs.height}>
        <VitalsHeightCard field={vitals.fields.height} />
      </Box>
      <VitalsBMICard
        current={vitals.fields.bmi.current}
        historical={vitals.fields.bmi.historical}
        onDelete={vitals.fields.bmi.delete}
        isWeightRefused={vitals.fields.weight.current[0]?.extraWeightOptions?.includes('patient_refused') ?? false}
      />
      <Box ref={vitals.refs.vision}>
        <VitalsVisionCard field={vitals.fields.vision} />
      </Box>
      <Box ref={vitals.refs.lmp}>
        <VitalsLastMenstrualPeriodCard field={vitals.fields.lmp} />
      </Box>

      {!isReadOnly && (
        <Box
          sx={{
            mt: 2,
            mb: 4,
            pt: 2,
            pb: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoOutlinedIcon sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">
              To save multiple vitals at once, fill in the forms above and click the button "Add All Vitals"
            </Typography>
          </Box>
          <RoundedButton
            onClick={() => vitals.saveAll()}
            disabled={!vitals.canSaveAll || vitals.isSavingAll}
            loading={vitals.isSavingAll}
            variant="contained"
            color="primary"
            sx={{ px: 4, py: 1.5, fontSize: '16px', flexShrink: 0 }}
            data-testid={dataTestIds.vitalsPage.addAllVitalsButton}
          >
            Add All Vitals
          </RoundedButton>
        </Box>
      )}

      <VitalsNotesCard />

      <AbnormalVitalsModal abnormalVitalsValues={vitals.abnormalVitalsValues} />
    </Stack>
  );
};
