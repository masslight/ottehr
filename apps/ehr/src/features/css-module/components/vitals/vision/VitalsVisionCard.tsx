import { Box, Checkbox, CircularProgress, FormControlLabel, Grid, lighten, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { JSX, useCallback, useMemo, useState } from 'react';
import {
  getVisionExtraOptionsFormattedString,
  textToNumericValue,
  VitalFieldNames,
  VitalsVisionObservationDTO,
  VitalsVisionOption,
} from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { AccordionCard, DoubleColumnContainer } from '../../../../../telemed/components';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { useVitalsCardState } from '../hooks/useVitalsCardState';
import { composeVisionVitalsHistoryEntries } from './helpers';
import { VitalVisionHistoryEntry } from './VitalVisionEntry';
import VitalVisionHistoryElement from './VitalVisionHistoryElement';

const VitalsVisionCard: React.FC = (): JSX.Element => {
  const theme = useTheme();

  const {
    isLoadingVitalsByEncounter,
    handleSaveVital,
    handleDeleteVital,
    isSavingCardData,
    setSavingCardData,
    screenDimensions: { isLargeScreen },
    vitalsHistory: { mainHistoryEntries, extraHistoryEntries, latestHistoryEntry },
    historyElementSkeletonText,
  } = useVitalsCardState<VitalsVisionObservationDTO, VitalVisionHistoryEntry>(
    VitalFieldNames.VitalVision,
    composeVisionVitalsHistoryEntries
  );

  const [leftEyeSelection, setLeftEyeSelection] = useState<string>('');
  const [rightEyeSelection, setRightEyeSelection] = useState<string>('');
  const [bothEyesSelection, setBothEyesSelection] = useState<string>('');

  const [isChildTooYoungOptionSelected, setChildTooYoungOptionSelected] = useState<boolean>(false);
  const [isWithGlassesOptionSelected, setWithGlassesOptionSelected] = useState<boolean>(false);
  const [isWithoutGlassesOptionSelected, setWithoutGlassesOptionSelected] = useState<boolean>(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const isAddButtonDisabled = !leftEyeSelection || !rightEyeSelection || isSavingCardData || isLoadingVitalsByEncounter;

  const isCheckboxesDisabled = isSavingCardData || isLoadingVitalsByEncounter;

  const latestVisionValueLabel = useMemo(() => {
    if (!latestHistoryEntry) return;
    const visionOptionsLine = getVisionExtraOptionsFormattedString(latestHistoryEntry.extraOptions);
    return `Left eye: ${latestHistoryEntry.leftEyeVision}; Right eye: ${latestHistoryEntry.rightEyeVision}; ${
      visionOptionsLine ?? ''
    }`;
  }, [latestHistoryEntry]);

  const handleSaveVisionObservation = async (leftEyeVisionText: string, rightEeyVisionText: string): Promise<void> => {
    const lefEyeValueNum = textToNumericValue(leftEyeVisionText);
    if (!lefEyeValueNum) return;
    const rightEyeValueNum = textToNumericValue(rightEeyVisionText);
    if (!rightEyeValueNum) return;

    const extraOptions: VitalsVisionOption[] = [];
    if (isChildTooYoungOptionSelected) {
      extraOptions.push('child_too_young');
    }
    if (isWithGlassesOptionSelected) {
      extraOptions.push('with_glasses');
    }
    if (isWithoutGlassesOptionSelected) {
      extraOptions.push('without_glasses');
    }

    try {
      setSavingCardData(true);
      const vitalObs: VitalsVisionObservationDTO = {
        field: VitalFieldNames.VitalVision,
        leftEyeVisionValue: lefEyeValueNum,
        rightEyeVisionValue: rightEyeValueNum,
        extraVisionOptions: extraOptions,
      };
      await handleSaveVital(vitalObs);
      setLeftEyeSelection('');
      setRightEyeSelection('');
      setBothEyesSelection('');
      setChildTooYoungOptionSelected(false);
      setWithGlassesOptionSelected(false);
      setWithoutGlassesOptionSelected(false);
    } catch (error) {
      enqueueSnackbar('Error saving Vision vital data', { variant: 'error' });
    } finally {
      setSavingCardData(false);
    }
  };

  const handleLeftEyeSelectionChange = useCallback(
    (event: { target: { value: string } }): void => {
      const eventValue = event.target.value;
      const selectedLeftEye = eventValue ?? '';
      setLeftEyeSelection(selectedLeftEye);
      if (selectedLeftEye !== rightEyeSelection) {
        setBothEyesSelection('');
      }
    },
    [rightEyeSelection]
  );

  const handleRightEyeSelectionChange = useCallback(
    (event: { target: { value: string } }): void => {
      const eventValue = event.target.value;
      const selectedRightEye = eventValue ?? '';
      setRightEyeSelection(selectedRightEye);
      if (selectedRightEye !== leftEyeSelection) {
        setBothEyesSelection('');
      }
    },
    [leftEyeSelection]
  );

  const handleBothEyesSelectionChange = useCallback((event: { target: { value: string } }): void => {
    const eventValue = event.target.value;
    const selectedBothEyes = eventValue ?? '';
    setBothEyesSelection(selectedBothEyes);
    setLeftEyeSelection(selectedBothEyes);
    setRightEyeSelection(selectedBothEyes);
  }, []);

  const handleVisionOptionChanged = useCallback((isChecked: boolean, visionOption: VitalsVisionOption): void => {
    if (visionOption === 'child_too_young') {
      setChildTooYoungOptionSelected(isChecked);
    }
    if (visionOption === 'with_glasses') {
      setWithGlassesOptionSelected(isChecked);
      setWithoutGlassesOptionSelected(false);
    }
    if (visionOption === 'without_glasses') {
      setWithoutGlassesOptionSelected(isChecked);
      setWithGlassesOptionSelected(false);
    }
  }, []);

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`Vision ${latestVisionValueLabel ?? ''}`}
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
              {/* Left eye vision selector */}
              <Grid item xs={12} sm={3} md={3} lg={3} order={{ xs: 1, sm: 1, md: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    ml: 0,
                  }}
                >
                  <VitalsTextInputFiled
                    label="Left eye"
                    value={leftEyeSelection}
                    disabled={isSavingCardData}
                    isInputError={false}
                    onChange={handleLeftEyeSelectionChange}
                  />
                </Box>
              </Grid>

              {/* Right eye vision selector */}
              <Grid item xs={12} sm={3} md={3} lg={3} order={{ xs: 2, sm: 2, md: 2, lg: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    ml: 1,
                  }}
                >
                  <VitalsTextInputFiled
                    label="Right eye"
                    value={rightEyeSelection}
                    disabled={isSavingCardData}
                    isInputError={false}
                    onChange={handleRightEyeSelectionChange}
                  />
                </Box>
              </Grid>

              {/* Both eye vision selector */}
              <Grid
                item
                xs={12}
                sm={3}
                md={3}
                lg={3}
                order={{ xs: 3, sm: 3, md: 3, lg: 3 }}
                sx={{ mt: isLargeScreen ? 0 : 0 }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    ml: 1,
                  }}
                >
                  <VitalsTextInputFiled
                    label="Both eyes"
                    value={bothEyesSelection}
                    disabled={isSavingCardData}
                    isInputError={false}
                    onChange={handleBothEyesSelectionChange}
                  />
                </Box>
              </Grid>

              {/* Add Button column */}
              <Grid item xs={12} sm={3} md={3} lg={3} order={{ xs: 4, sm: 4, md: 4, lg: 4 }} sx={{ mt: 0 }}>
                <RoundedButton
                  disabled={isAddButtonDisabled}
                  onClick={() => handleSaveVisionObservation(leftEyeSelection, rightEyeSelection)}
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

              <Grid
                item
                xs={12}
                sm={12}
                md={12}
                lg={12}
                order={{ xs: 5, sm: 5, md: 5, lg: 5 }}
                sx={{ mt: isLargeScreen ? 1 : 1, ml: 1 }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                  {/* Child too young checkbox option */}
                  <FormControlLabel
                    sx={{
                      backgroundColor: 'transparent',
                      pr: 0,
                    }}
                    control={
                      <Checkbox
                        size="small"
                        sx={{
                          color: theme.palette.primary.main,
                          '&.Mui-checked': {
                            color: theme.palette.primary.main,
                          },
                          '&.Mui-disabled': {
                            color: lighten(theme.palette.primary.main, 0.4),
                          },
                        }}
                        disabled={isCheckboxesDisabled}
                        checked={isChildTooYoungOptionSelected}
                        onChange={(e) => handleVisionOptionChanged(e.target.checked, 'child_too_young')}
                      />
                    }
                    label={
                      <Typography
                        sx={{
                          fontSize: '16px',
                          fontWeight: 500,
                          color: isCheckboxesDisabled
                            ? lighten(theme.palette.text.primary, 0.4)
                            : theme.palette.text.primary,
                        }}
                      >
                        Child too young
                      </Typography>
                    }
                  />

                  {/* With glasses checkbox option */}
                  <FormControlLabel
                    sx={{
                      backgroundColor: 'transparent',
                      pr: 0,
                    }}
                    control={
                      <Checkbox
                        size="small"
                        sx={{
                          color: theme.palette.primary.main,
                          '&.Mui-checked': {
                            color: theme.palette.primary.main,
                          },
                          '&.Mui-disabled': {
                            color: lighten(theme.palette.primary.main, 0.4),
                          },
                        }}
                        disabled={isCheckboxesDisabled}
                        checked={isWithGlassesOptionSelected}
                        onChange={(e) => handleVisionOptionChanged(e.target.checked, 'with_glasses')}
                      />
                    }
                    label={
                      <Typography
                        sx={{
                          fontSize: '16px',
                          fontWeight: 500,
                          color: isCheckboxesDisabled
                            ? lighten(theme.palette.text.primary, 0.4)
                            : theme.palette.text.primary,
                        }}
                      >
                        With glasses
                      </Typography>
                    }
                  />

                  {/* Without glasses checkbox option */}
                  <FormControlLabel
                    sx={{
                      backgroundColor: 'transparent',
                      pr: 0,
                    }}
                    control={
                      <Checkbox
                        size="small"
                        sx={{
                          color: theme.palette.primary.main,
                          '&.Mui-checked': {
                            color: theme.palette.primary.main,
                          },
                          '&.Mui-disabled': {
                            color: lighten(theme.palette.primary.main, 0.4),
                          },
                        }}
                        disabled={isCheckboxesDisabled}
                        checked={isWithoutGlassesOptionSelected}
                        onChange={(e) => handleVisionOptionChanged(e.target.checked, 'without_glasses')}
                      />
                    }
                    label={
                      <Typography
                        sx={{
                          fontSize: '16px',
                          fontWeight: 500,
                          color: isCheckboxesDisabled
                            ? lighten(theme.palette.text.primary, 0.4)
                            : theme.palette.text.primary,
                        }}
                      >
                        Without glasses
                      </Typography>
                    }
                  />
                </Box>
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
                return <VitalVisionHistoryElement historyEntry={historyEntry} onDelete={handleDeleteVital} />;
              }}
            />
          }
        />
      </AccordionCard>
    </Box>
  );
};

export default VitalsVisionCard;
