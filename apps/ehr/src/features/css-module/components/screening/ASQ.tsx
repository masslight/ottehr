import { Alert, FormControl, Grid, MenuItem, Paper, Select, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ASQKeys, ASQObservationDTO, ASQ_FIELD, ObservationDTO, asqLabels } from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../telemed';
import { useZapEHRAPIClient } from '../../../../telemed/hooks/useOystehrAPIClient';
import { CSSModal } from '../CSSModal';

const isASQObservationDTO = (obs: ObservationDTO): obs is ASQObservationDTO => {
  return obs.field === ASQ_FIELD;
};

export const ASQ: React.FC = () => {
  const theme = useTheme();
  const apiClient = useZapEHRAPIClient();
  const { chartData, updateObservation, encounter, isChartDataLoading } = getSelectors(useAppointmentStore, [
    'chartData',
    'updateObservation',
    'encounter',
    'isChartDataLoading',
  ]);

  const [asqValue, setAsqValue] = useState<ASQKeys | ''>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempAsqValue, setTempAsqValue] = useState<ASQKeys | ''>('');

  // used for highlight select in the UI
  const [asqError, setAsqError] = useState<string>('');

  // used for scroll on error
  const asqRef = useRef<HTMLDivElement>(null);

  const currentASQObs = useMemo(() => chartData?.observations?.find((obs) => isASQObservationDTO(obs)), [chartData]);

  useEffect(() => {
    if (currentASQObs?.value) {
      setAsqValue(currentASQObs.value as ASQKeys);
    }
  }, [currentASQObs]);

  const handleSaveObservation = async (observation: ASQObservationDTO): Promise<void> => {
    setIsUpdating(true);

    try {
      const result = await apiClient?.saveChartData?.({
        encounterId: encounter?.id || '',
        observations: [observation],
      });

      if (result?.chartData?.observations?.[0]) {
        updateObservation(result.chartData.observations[0]);
      }
    } catch (error) {
      enqueueSnackbar('An error occurred while saving the information. Please try again.', {
        variant: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleASQChange = (value: ASQKeys): void => {
    if (value === ASQKeys.Positive) {
      setTempAsqValue(value);
      setIsModalOpen(true);
    } else {
      setAsqValue(value);
      void handleSaveObservation(
        (currentASQObs
          ? { ...currentASQObs, value: value as ASQKeys }
          : {
              field: ASQ_FIELD,
              value,
            }) as ASQObservationDTO
      );
    }
  };

  const handleModalClose = (): void => {
    setIsModalOpen(false);
    setTempAsqValue('');
  };

  const handleModalConfirm = (): void => {
    setAsqValue(tempAsqValue);
    void handleSaveObservation(
      currentASQObs
        ? ({ ...currentASQObs, value: tempAsqValue } as ASQObservationDTO)
        : ({ field: ASQ_FIELD, value: tempAsqValue } as ASQObservationDTO)
    );
    setIsModalOpen(false);
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }}>
      <Grid container>
        <Grid item xs={6}>
          <FormControl fullWidth sx={{ mb: 2 }} ref={asqRef}>
            <Typography
              sx={{
                color: theme.palette.primary.dark,
                mb: 1,
                fontWeight: 'bold',
              }}
            >
              ASQ
            </Typography>
            <Select
              value={asqValue}
              onChange={(e) => {
                handleASQChange(e.target.value as ASQKeys);
                setAsqError('');
              }}
              displayEmpty
              disabled={isUpdating || isChartDataLoading}
              renderValue={(selected) => (selected ? asqLabels[selected] : 'Select an option')}
              error={!!asqError}
            >
              <MenuItem value="">
                <em>Select an option</em>
              </MenuItem>
              {Object.values(ASQKeys).map((key) => (
                <MenuItem key={key} value={key}>
                  {asqLabels[key]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {asqValue === ASQKeys.Positive && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Critical alert note about positive ASQ. Please verify and notify provider.
            </Alert>
          )}
        </Grid>
      </Grid>

      <CSSModal
        open={isModalOpen}
        handleClose={handleModalClose}
        handleConfirm={handleModalConfirm}
        title="Confirm ASQ Positive"
        description="Are you sure you want to set ASQ as Positive?"
        closeButtonText="Cancel"
        confirmText="Confirm"
        errorMessage="An error occurred"
      />
    </Paper>
  );
};
