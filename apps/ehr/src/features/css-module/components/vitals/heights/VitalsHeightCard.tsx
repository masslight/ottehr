import { Box, CircularProgress, Grid, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ChangeEvent, JSX, useCallback, useMemo, useState } from 'react';
import { heightInCmToInch, VitalFieldNames, VitalsHeightObservationDTO } from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { AccordionCard, DoubleColumnContainer } from '../../../../../telemed/components';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { useVitalsCardState } from '../hooks/useVitalsCardState';
import { composeHeightVitalsHistoryEntries, isValidHeightInCmValue, textToHeightNumber } from './helpers';
import VitalHeightHistoryElement from './VitalHeightHistoryElement';
import { VitalHeightHistoryEntry } from './VitalHeightHistoryEntry';

const VitalsHeightCard: React.FC = (): JSX.Element => {
  const {
    isLoadingVitalsByEncounter,
    handleSaveVital,
    handleDeleteVital,
    isSavingCardData,
    setSavingCardData,
    screenDimensions: { isLargeScreen },
    vitalsHistory: { mainHistoryEntries, extraHistoryEntries, latestHistoryEntry },
    historyElementSkeletonText,
  } = useVitalsCardState<VitalsHeightObservationDTO, VitalHeightHistoryEntry>(
    VitalFieldNames.VitalHeight,
    composeHeightVitalsHistoryEntries
  );

  const [heightValueText, setHeightValueText] = useState('');

  const [isHeightValidationError, setHeightValidationError] = useState<boolean>(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const isDisabledAddButton =
    !heightValueText || isSavingCardData || isLoadingVitalsByEncounter || isHeightValidationError;

  const latestHeightValue = latestHistoryEntry?.heightCm;

  const enteredHeightInInch: number | undefined = useMemo(() => {
    const heightCm = textToHeightNumber(heightValueText);
    if (!heightCm) return;
    return heightInCmToInch(heightCm);
  }, [heightValueText]);

  const handleSaveHeightObservation = async (heightValueText: string): Promise<void> => {
    const heightValueNumber = textToHeightNumber(heightValueText);
    if (!heightValueNumber) return;

    try {
      setSavingCardData(true);
      const vitalObs: VitalsHeightObservationDTO = {
        field: VitalFieldNames.VitalHeight,
        value: heightValueNumber,
      };
      await handleSaveVital(vitalObs);
      setHeightValueText('');
    } catch {
      enqueueSnackbar('Error saving Height vital record', { variant: 'error' });
    } finally {
      setSavingCardData(false);
    }
  };

  const handleTextInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const heightAsText = e.target.value;
      setHeightValueText(heightAsText);
      const heightVal = textToHeightNumber(heightAsText);
      if (heightVal) {
        setHeightValidationError(!isValidHeightInCmValue(heightVal));
      }
      if (heightAsText.length === 0) {
        setHeightValidationError(false);
      }
    },
    [setHeightValidationError, setHeightValueText]
  );

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`Height (cm) ${latestHeightValue ?? ''}`}
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
              {/* Height Input Field column */}
              <Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 1, sm: 1, md: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                  }}
                >
                  <VitalsTextInputFiled
                    label="Height (cm)"
                    value={heightValueText}
                    disabled={isSavingCardData}
                    isInputError={isHeightValidationError}
                    onChange={handleTextInputChange}
                  />
                  <Typography fontSize={25} sx={{ ml: 1 }}>
                    /
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    label="Height (inch)"
                    sx={{
                      '& fieldset': { border: 'none' },
                      maxWidth: '110px',
                    }}
                    disabled
                    InputLabelProps={{ shrink: true }}
                    value={enteredHeightInInch ?? ''}
                  />
                </Box>
              </Grid>

              {/* Add Button column */}
              <Grid
                item
                xs={12}
                sm={6}
                md={6}
                lg={6}
                order={{ xs: 2, sm: 2, md: 2, lg: 2 }}
                sx={{ mt: isLargeScreen ? 0 : 0 }}
              >
                <RoundedButton
                  size="small"
                  disabled={isDisabledAddButton}
                  onClick={() => handleSaveHeightObservation(heightValueText)}
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
                return <VitalHeightHistoryElement historyEntry={historyEntry} onDelete={handleDeleteVital} />;
              }}
            />
          }
        />
      </AccordionCard>
    </Box>
  );
};

export default VitalsHeightCard;
