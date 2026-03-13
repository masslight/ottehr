import { Box, Checkbox, FormControlLabel, Grid, lighten, Typography, useTheme } from '@mui/material';
import React, { JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  formatWeight,
  formatWeightKg,
  formatWeightLbs,
  VitalFieldNames,
  vitalsConfig,
  VitalsWeightObservationDTO,
  VitalsWeightOption,
} from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { VITALS_FORM_BORDER_TRANSITION, VITALS_FORM_ERROR_BORDER } from '../constants';
import { useVitalsSaveOnEnter } from '../hooks/useVitalsSaveOnEnter';
import { VitalsCardProps } from '../types';

type VitalsWeightsCardProps = VitalsCardProps<VitalsWeightObservationDTO>;
const VitalsWeightsCard: React.FC<VitalsWeightsCardProps> = ({ field }): JSX.Element => {
  const theme = useTheme();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestWeightKg = field.current[0]?.value;
  const isPatientRefused = field.current[0]?.extraWeightOptions?.includes('patient_refused');
  const { localState } = field;

  const handleWeightOptionChanged = useCallback(
    async (isChecked: boolean, weightOption: VitalsWeightOption): Promise<void> => {
      if (weightOption !== 'patient_refused') return;

      localState.handlePatientRefusedChange(isChecked, weightOption);

      if (!isChecked) return;

      const vitalObs: VitalsWeightObservationDTO = {
        field: VitalFieldNames.VitalWeight,
        extraWeightOptions: ['patient_refused'],
      };
      await field.saveWithDto?.(vitalObs);
    },
    [field, localState]
  );

  const { handleKeyDown } = useVitalsSaveOnEnter({
    onSave: field.save,
  });

  const renderRightColumn = (): JSX.Element => {
    return (
      <VitalsHistoryContainer
        historicalObs={field.historical}
        currentEncounterObs={field.current}
        isLoading={false}
        historyElementCreator={(historyEntry) => {
          const isCurrent = field.current.some((obs) => obs.resourceId === historyEntry.resourceId);
          return (
            <VitalHistoryElement
              historyEntry={historyEntry}
              onDelete={isCurrent && !isReadOnly ? field.delete : undefined}
              dataTestId={dataTestIds.vitalsPage.weightItem}
            />
          );
        }}
      />
    );
  };

  const title =
    `Weight (${vitalsConfig['vital-weight'].unit}) ` +
    (isPatientRefused
      ? 'Patient Refused'
      : latestWeightKg
      ? formatWeight(latestWeightKg, vitalsConfig['vital-weight'].unit)
      : '');

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={title}
        collapsed={isCollapsed}
        onSwitch={handleSectionCollapse}
        dataTestId={dataTestIds.vitalsPage.weightHeader}
      >
        {isReadOnly ? (
          renderRightColumn()
        ) : (
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
                  border: field.localState.validationError ? VITALS_FORM_ERROR_BORDER : 'none',
                  transition: VITALS_FORM_BORDER_TRANSITION,
                }}
              >
                {/* Weight Input Field column */}
                <Grid item xs={12} sm={8} md={8} lg={8} order={{ xs: 1, sm: 1, md: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: vitalsConfig['vital-weight'].unit === 'kg' ? 'row' : 'row-reverse',
                      gap: 1,
                    }}
                  >
                    <VitalsTextInputFiled
                      label="Weight (kg)"
                      value={localState.weightKg ? formatWeightKg(localState.weightKg) : ''}
                      disabled={field.isSaving || localState.isPatientRefusedSelected}
                      isInputError={localState.validationError}
                      onChange={localState.handleKgInput}
                      onKeyDown={handleKeyDown}
                      data-testid={dataTestIds.vitalsPage.weightInput}
                    />
                    <Typography fontSize={25}>=</Typography>
                    <VitalsTextInputFiled
                      label="Weight (lbs)"
                      value={localState.weightKg ? formatWeightLbs(localState.weightKg) : ''}
                      disabled={field.isSaving || localState.isPatientRefusedSelected}
                      isInputError={localState.validationError}
                      onChange={localState.handleLbsInput}
                      onKeyDown={handleKeyDown}
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
                    disabled={localState.isDisabled || field.isSaving}
                    loading={field.isSaving}
                    onClick={field.save}
                    color="primary"
                    sx={{
                      height: '40px',
                      px: 2,
                      ml: 1,
                    }}
                    data-testid={dataTestIds.vitalsPage.weightAddButton}
                  >
                    Add
                  </RoundedButton>
                </Grid>
                <Grid item xs={12} sm={12} md={12} lg={12} order={{ xs: 5, sm: 5, md: 5, lg: 5 }} sx={{ mt: 1, ml: 1 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                    {/* Patient refused checkbox option */}
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
                          disabled={field.isSaving}
                          checked={localState.isPatientRefusedSelected}
                          onChange={(e) => handleWeightOptionChanged(e.target.checked, 'patient_refused')}
                          data-testid={dataTestIds.vitalsPage.weightPatientRefusedCheckbox}
                        />
                      }
                      label={
                        <Typography
                          sx={{
                            fontSize: '16px',
                            fontWeight: 500,
                            color: field.isSaving
                              ? lighten(theme.palette.text.primary, 0.4)
                              : theme.palette.text.primary,
                          }}
                        >
                          Patient Refused
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

export default VitalsWeightsCard;
