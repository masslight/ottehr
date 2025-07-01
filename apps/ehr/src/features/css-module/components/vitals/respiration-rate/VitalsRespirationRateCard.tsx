import { Box, CircularProgress, Grid } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ChangeEvent, JSX, useCallback, useState } from 'react';
import { VitalFieldNames, VitalsRespirationRateObservationDTO } from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { AccordionCard, DoubleColumnContainer } from '../../../../../telemed/components';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { useVitalsCardState } from '../hooks/useVitalsCardState';
import {
  composeRespirationRateHistoryEntries,
  isValidRespirationRateValue,
  textToRespirationRateNumber,
} from './helpers';
import VitalsRespirationRateHistoryElementElement from './VitalsRespirationRateHistoryElement';
import { VitalsRespirationRateHistoryEntry } from './VitalsRespirationRateHistoryEntry';

const VitalsRespirationRateCard: React.FC = (): JSX.Element => {
  const {
    isLoadingVitalsByEncounter,
    handleSaveVital,
    handleDeleteVital,
    isSavingCardData,
    setSavingCardData,
    vitalsHistory: { mainHistoryEntries, extraHistoryEntries, latestHistoryEntry },
    historyElementSkeletonText,
  } = useVitalsCardState<VitalsRespirationRateObservationDTO, VitalsRespirationRateHistoryEntry>(
    VitalFieldNames.VitalRespirationRate,
    composeRespirationRateHistoryEntries
  );

  const [respirationRateValueText, setRespirationRateValueText] = useState('');

  const [isRespirationRateValidationError, setRespirationRateValidationError] = useState<boolean>(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const isDisabledAddButton =
    !respirationRateValueText || isSavingCardData || isLoadingVitalsByEncounter || isRespirationRateValidationError;

  const latestRespRateValue = latestHistoryEntry?.respirationsPerMin;

  const handleSaveRespirationRateObservation = useCallback(
    async (respRateValueText: string): Promise<void> => {
      const respRateValueNumber = textToRespirationRateNumber(respRateValueText);
      if (!respRateValueNumber) return;

      try {
        setSavingCardData(true);
        const vitalObs: VitalsRespirationRateObservationDTO = {
          field: VitalFieldNames.VitalRespirationRate,
          value: respRateValueNumber,
        };
        await handleSaveVital(vitalObs);
        setRespirationRateValueText('');
      } catch {
        enqueueSnackbar('Error saving respiration rate data', { variant: 'error' });
      } finally {
        setSavingCardData(false);
      }
    },
    [handleSaveVital, setSavingCardData]
  );

  const handleTextInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const respirationRateAsText = e.target.value;
      setRespirationRateValueText(respirationRateAsText);
      const respirationRate = textToRespirationRateNumber(respirationRateAsText);
      if (respirationRate) {
        setRespirationRateValidationError(!isValidRespirationRateValue(respirationRate));
      }
      if (respirationRateAsText.length === 0) {
        setRespirationRateValidationError(false);
      }
    },
    [setRespirationRateValidationError, setRespirationRateValueText]
  );

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`RR (/min) ${latestRespRateValue ?? ''}`}
        collapsed={isCollapsed}
        onSwitch={handleSectionCollapse}
      >
        <DoubleColumnContainer
          divider
          leftColumn={
            <Grid
              container
              sx={{
                height: 'auto',
                width: 'auto',
                backgroundColor: '#F7F8F9',
                borderRadius: 2,
                my: 2,
                mx: 2,
                py: 2,
                px: 2,
              }}
            >
              {/* RespirationRate Input Field column */}
              <Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 1, sm: 1, md: 1 }}>
                <VitalsTextInputFiled
                  label="RR (/min)"
                  value={respirationRateValueText}
                  disabled={isSavingCardData}
                  isInputError={isRespirationRateValidationError}
                  onChange={handleTextInputChange}
                />
              </Grid>

              {/* Add Button column */}
              <Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 2, sm: 2, md: 2, lg: 2 }} sx={{ mt: 0 }}>
                <RoundedButton
                  size="small"
                  disabled={isDisabledAddButton}
                  onClick={() => handleSaveRespirationRateObservation(respirationRateValueText)}
                  color="primary"
                  sx={{
                    height: '40px',
                    px: 2,
                    ml: 1,
                  }}
                  startIcon={isSavingCardData ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  Add
                </RoundedButton>
              </Grid>
            </Grid>
          }
          rightColumn={
            <VitalsHistoryContainer
              mainHistoryEntries={mainHistoryEntries}
              extraHistoryEntries={extraHistoryEntries}
              isLoading={isLoadingVitalsByEncounter}
              historyElementSkeletonText={historyElementSkeletonText}
              historyElementCreator={(historyEntry) => {
                return (
                  <VitalsRespirationRateHistoryElementElement
                    historyEntry={historyEntry}
                    onDelete={handleDeleteVital}
                  />
                );
              }}
            />
          }
        />
      </AccordionCard>
    </Box>
  );
};

export default VitalsRespirationRateCard;
