import { Box, Checkbox, FormControlLabel, Grid, lighten, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { JSX, useCallback, useState } from 'react';
import {
  getVisionExtraOptionsFormattedString,
  VitalFieldNames,
  VitalsVisionObservationDTO,
  VitalsVisionOption,
} from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { AccordionCard, DoubleColumnContainer } from '../../../../../telemed/components';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextFreeInputField } from '../components/VitalsTextInputFiled';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { VitalsCardProps } from '../types';

type VitalsVisionCardProps = VitalsCardProps<VitalsVisionObservationDTO>;
const VitalsVisionCard: React.FC<VitalsVisionCardProps> = ({
  handleSaveVital,
  handleDeleteVital,
  currentObs,
  historicalObs,
  historyElementSkeletonText,
}): JSX.Element => {
  const theme = useTheme();

  const [leftEyeSelection, setLeftEyeSelection] = useState<string>('');
  const [rightEyeSelection, setRightEyeSelection] = useState<string>('');
  const [bothEyesSelection, setBothEyesSelection] = useState<string>('');

  const [isChildTooYoungOptionSelected, setChildTooYoungOptionSelected] = useState<boolean>(false);
  const [isWithGlassesOptionSelected, setWithGlassesOptionSelected] = useState<boolean>(false);
  const [isWithoutGlassesOptionSelected, setWithoutGlassesOptionSelected] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const isAddButtonDisabled = !leftEyeSelection || !rightEyeSelection;

  const isCheckboxesDisabled = isSaving;

  const { isLargeScreen } = useScreenDimensions();

  const latestVisionValueLabel = (() => {
    const latestHistoryEntry = currentObs[0];
    if (!latestHistoryEntry) return;
    const visionOptionsLine = getVisionExtraOptionsFormattedString(latestHistoryEntry.extraVisionOptions);
    return `Left eye: ${latestHistoryEntry.leftEyeVisionText}; Right eye: ${latestHistoryEntry.rightEyeVisionText}; ${
      visionOptionsLine ?? ''
    }`;
  })();

  const handleSaveVisionObservation = async (leftEyeVisionText: string, rightEyeVisionText: string): Promise<void> => {
    if (!leftEyeVisionText) return;
    if (!rightEyeVisionText) return;

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
      setIsSaving(true);
      const vitalObs: VitalsVisionObservationDTO = {
        field: VitalFieldNames.VitalVision,
        leftEyeVisionText: leftEyeVisionText,
        rightEyeVisionText: rightEyeVisionText,
        extraVisionOptions: extraOptions,
      };
      await handleSaveVital(vitalObs);
      setLeftEyeSelection('');
      setRightEyeSelection('');
      setBothEyesSelection('');
      setChildTooYoungOptionSelected(false);
      setWithGlassesOptionSelected(false);
      setWithoutGlassesOptionSelected(false);
    } catch {
      enqueueSnackbar('Error saving Vision vital data', { variant: 'error' });
    } finally {
      setIsSaving(false);
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
                  <VitalsTextFreeInputField
                    label="Left eye"
                    value={leftEyeSelection}
                    disabled={isSaving}
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
                  <VitalsTextFreeInputField
                    label="Right eye"
                    value={rightEyeSelection}
                    disabled={isSaving}
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
                  <VitalsTextFreeInputField
                    label="Both eyes"
                    value={bothEyesSelection}
                    disabled={isSaving}
                    isInputError={false}
                    onChange={handleBothEyesSelectionChange}
                  />
                </Box>
              </Grid>

              {/* Add Button column */}
              <Grid item xs={12} sm={3} md={3} lg={3} order={{ xs: 4, sm: 4, md: 4, lg: 4 }} sx={{ mt: 0 }}>
                <RoundedButton
                  disabled={isAddButtonDisabled}
                  loading={isSaving}
                  onClick={() => handleSaveVisionObservation(leftEyeSelection, rightEyeSelection)}
                  color="primary"
                  sx={{
                    height: '40px',
                    px: 2,
                    ml: 1,
                  }}
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
              historicalObs={historicalObs}
              currentEncounterObs={currentObs}
              isLoading={false}
              historyElementSkeletonText={historyElementSkeletonText}
              historyElementCreator={(historyEntry) => {
                const isCurrent = currentObs.some((obs) => obs.resourceId === historyEntry.resourceId);
                return (
                  <VitalHistoryElement
                    historyEntry={historyEntry}
                    onDelete={isCurrent ? handleDeleteVital : undefined}
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

export default VitalsVisionCard;
