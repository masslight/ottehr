import { Box, CircularProgress, Grid, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { JSX, useCallback, useMemo, useState } from 'react';
import { kgToLb, textToWeightNumber, VitalFieldNames, VitalsWeightObservationDTO } from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { AccordionCard, DoubleColumnContainer } from '../../../../../telemed';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { useVitalsCardState } from '../hooks/useVitalsCardState';
import { composeWeightVitalsHistoryEntries } from './helpers';
import VitalWeightHistoryElement from './VitalWeightHistoryElement';
import { VitalWeightHistoryEntry } from './VitalWeightHistoryEntry';

const VitalsWeightsCard: React.FC = (): JSX.Element => {
  const {
    isLoadingVitalsByEncounter,
    handleSaveVital,
    handleDeleteVital,
    isSavingCardData,
    setSavingCardData,
    vitalsHistory: { mainHistoryEntries, extraHistoryEntries, latestHistoryEntry },
    historyElementSkeletonText,
  } = useVitalsCardState<VitalsWeightObservationDTO, VitalWeightHistoryEntry>(
    VitalFieldNames.VitalWeight,
    composeWeightVitalsHistoryEntries
  );

  const [weightValueText, setWeightValueText] = useState('');

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestWeightValue = latestHistoryEntry?.weightKg;

  const enteredWeightInLb: number | undefined = useMemo(() => {
    const weightKg = textToWeightNumber(weightValueText);
    if (!weightKg) return;
    return kgToLb(weightKg);
  }, [weightValueText]);

  const handleSaveWeightObservation = async (weightValueText: string): Promise<void> => {
    const weightValueNumber = textToWeightNumber(weightValueText);
    if (!weightValueNumber) return;
    try {
      setSavingCardData(true);
      const vitalObs: VitalsWeightObservationDTO = {
        field: VitalFieldNames.VitalWeight,
        value: weightValueNumber,
      };
      await handleSaveVital(vitalObs);
      setWeightValueText('');
    } catch {
      enqueueSnackbar('Error saving Weight data', { variant: 'error' });
    } finally {
      setSavingCardData(false);
    }
  };

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`Weight (kg) ${latestWeightValue ?? ''}`}
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
              {/* Weight Input Field column */}
              <Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 1, sm: 1, md: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                  }}
                >
                  <VitalsTextInputFiled
                    label="Weight (kg)"
                    value={weightValueText}
                    disabled={isSavingCardData}
                    isInputError={false}
                    onChange={(e) => setWeightValueText(e.target.value)}
                  />
                  <Typography fontSize={25} sx={{ ml: 1 }}>
                    /
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    label="Weight (lbs)"
                    sx={{
                      '& fieldset': { border: 'none' },
                      maxWidth: '110px',
                    }}
                    disabled
                    InputLabelProps={{ shrink: true }}
                    value={enteredWeightInLb ?? ''}
                  />
                </Box>
              </Grid>

              {/* Add Button column */}
              <Grid
                item
                container
                xs={12}
                sm={4}
                md={4}
                lg={4}
                order={{ xs: 2, sm: 2, md: 2, lg: 3 }}
                style={{ alignSelf: 'center' }}
              >
                <RoundedButton
                  size="small"
                  disabled={!weightValueText || isSavingCardData || isLoadingVitalsByEncounter}
                  onClick={() => handleSaveWeightObservation(weightValueText)}
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
                return <VitalWeightHistoryElement historyEntry={historyEntry} onDelete={handleDeleteVital} />;
              }}
            />
          }
        />
      </AccordionCard>
    </Box>
  );
};

export default VitalsWeightsCard;
