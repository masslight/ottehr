import { Box, Checkbox, FormControlLabel, Grid, lighten, Typography, useTheme } from '@mui/material';
import React, { JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getVisionExtraOptionsFormattedString, VitalsVisionObservationDTO } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextFreeInputField } from '../components/VitalsTextInputFiled';
import { VITALS_FORM_BORDER_TRANSITION, VITALS_FORM_ERROR_BORDER } from '../constants';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { useVitalsSaveOnEnter } from '../hooks/useVitalsSaveOnEnter';
import { VitalsCardProps } from '../types';

type VitalsVisionCardProps = VitalsCardProps<VitalsVisionObservationDTO>;
const VitalsVisionCard: React.FC<VitalsVisionCardProps> = ({ field, historyElementSkeletonText }): JSX.Element => {
  const theme = useTheme();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { isLargeScreen } = useScreenDimensions();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const { localState } = field;
  const isCheckboxesDisabled = field.isSaving;

  const latestVisionValueLabel = (() => {
    const latestHistoryEntry = field.current[0];
    if (!latestHistoryEntry) return;
    const visionOptionsLine = getVisionExtraOptionsFormattedString(latestHistoryEntry.extraVisionOptions);
    return `Left eye: ${latestHistoryEntry.leftEyeVisionText}; Right eye: ${latestHistoryEntry.rightEyeVisionText}; ${
      visionOptionsLine ?? ''
    }`;
  })();

  const { handleKeyDown } = useVitalsSaveOnEnter({
    onSave: field.save,
  });

  const renderRightColumn = (): JSX.Element => {
    return (
      <VitalsHistoryContainer
        historicalObs={field.historical}
        currentEncounterObs={field.current}
        isLoading={false}
        historyElementSkeletonText={historyElementSkeletonText}
        historyElementCreator={(historyEntry) => {
          const isCurrent = field.current.some((obs) => obs.resourceId === historyEntry.resourceId);
          return (
            <VitalHistoryElement
              historyEntry={historyEntry}
              onDelete={isCurrent && !isReadOnly ? field.delete : undefined}
              dataTestId={dataTestIds.vitalsPage.visionItem}
            />
          );
        }}
      />
    );
  };

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`Vision ${latestVisionValueLabel ?? ''}`}
        collapsed={isCollapsed}
        onSwitch={handleSectionCollapse}
        dataTestId={dataTestIds.vitalsPage.visionHeader}
      >
        {isReadOnly ? (
          renderRightColumn()
        ) : (
          <DoubleColumnContainer
            divider
            leftColumn={
              <Grid
                container
                onKeyDown={handleKeyDown}
                sx={{
                  height: 'auto',
                  width: 'auto',
                  backgroundColor: '#F7F8F9',
                  borderRadius: 2,
                  my: 2,
                  mx: 2,
                  py: 2,
                  px: 2,
                  border: field.localState.validationError ? VITALS_FORM_ERROR_BORDER : 'none',
                  transition: VITALS_FORM_BORDER_TRANSITION,
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
                      value={localState.leftEyeSelection}
                      disabled={field.isSaving}
                      isInputError={localState.isLeftEyeInvalid && localState.validationError}
                      onChange={localState.handleLeftEyeChange}
                      data-testid={dataTestIds.vitalsPage.visionLeftInput}
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
                      value={localState.rightEyeSelection}
                      disabled={field.isSaving}
                      isInputError={localState.isRightEyeInvalid && localState.validationError}
                      onChange={localState.handleRightEyeChange}
                      data-testid={dataTestIds.vitalsPage.visionRightInput}
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
                      value={localState.bothEyesSelection}
                      disabled={field.isSaving}
                      isInputError={false}
                      onChange={localState.handleBothEyesChange}
                    />
                  </Box>
                </Grid>

                {/* Add Button column */}
                <Grid item xs={12} sm={3} md={3} lg={3} order={{ xs: 4, sm: 4, md: 4, lg: 4 }} sx={{ mt: 0 }}>
                  <RoundedButton
                    disabled={localState.isDisabled}
                    loading={field.isSaving}
                    onClick={field.save}
                    color="primary"
                    sx={{
                      height: '40px',
                      px: 2,
                      ml: 1,
                    }}
                    data-testid={dataTestIds.vitalsPage.visionAddButton}
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
                          checked={localState.isChildTooYoungSelected}
                          onChange={(e) => localState.handleVisionOptionChange(e.target.checked, 'child_too_young')}
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
                          checked={localState.isWithGlassesSelected}
                          onChange={(e) => localState.handleVisionOptionChange(e.target.checked, 'with_glasses')}
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
                          checked={localState.isWithoutGlassesSelected}
                          onChange={(e) => localState.handleVisionOptionChange(e.target.checked, 'without_glasses')}
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
            rightColumn={renderRightColumn()}
          />
        )}
      </AccordionCard>
    </Box>
  );
};

export default VitalsVisionCard;
