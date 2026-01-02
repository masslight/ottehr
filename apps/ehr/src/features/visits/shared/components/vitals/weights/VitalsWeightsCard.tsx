import { Box, Checkbox, FormControlLabel, Grid, lighten, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ChangeEvent, JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import {
  formatWeight,
  formatWeightKg,
  formatWeightLbs,
  LBS_IN_KG,
  roundNumberToDecimalPlaces,
  textToNumericValue,
  VitalFieldNames,
  vitalsConfig,
  VitalsWeightObservationDTO,
  VitalsWeightOption,
} from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { VitalsCardProps } from '../types';

type VitalsWeightsCardProps = VitalsCardProps<VitalsWeightObservationDTO>;
const VitalsWeightsCard: React.FC<VitalsWeightsCardProps> = ({
  handleSaveVital,
  handleDeleteVital,
  currentObs,
  historicalObs,
}): JSX.Element => {
  const theme = useTheme();
  const [weightKg, setWeightKg] = useState<number | undefined>(undefined);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestWeightKg = currentObs[0]?.value;
  const isPatientRefused = currentObs[0]?.extraWeightOptions?.includes('patient_refused');

  const [isPatientRefusedOptionSelected, setOptionRefusedOptionSelected] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveWeightObservation = async (): Promise<void> => {
    if (!weightKg && !isPatientRefusedOptionSelected) {
      return;
    }

    try {
      setIsSaving(true);
      let vitalObs: VitalsWeightObservationDTO;

      if (isPatientRefusedOptionSelected) {
        vitalObs = {
          field: VitalFieldNames.VitalWeight,
          extraWeightOptions: ['patient_refused'],
        };
      } else {
        if (weightKg == null) {
          return;
        }

        vitalObs = {
          field: VitalFieldNames.VitalWeight,
          value: weightKg,
        };
      }
      await handleSaveVital(vitalObs);
      setWeightKg(undefined);
      setOptionRefusedOptionSelected(false);
    } catch {
      enqueueSnackbar('Error saving Weight data', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKgInput = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setWeightKg(textToNumericValue(e.target.value));
  }, []);

  const handleLbsInput = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const numericValue = textToNumericValue(e.target.value);
    if (numericValue) {
      setWeightKg(roundNumberToDecimalPlaces(numericValue / LBS_IN_KG, 2));
    } else {
      setWeightKg(undefined);
    }
  }, []);

  const handleWeightOptionChanged = useCallback((isChecked: boolean, weightOption: VitalsWeightOption): void => {
    if (weightOption === 'patient_refused') {
      setOptionRefusedOptionSelected(isChecked);
      setWeightKg(undefined);
    }
  }, []);

  const renderRightColumn = (): JSX.Element => {
    return (
      <VitalsHistoryContainer
        historicalObs={historicalObs}
        currentEncounterObs={currentObs}
        isLoading={false}
        historyElementCreator={(historyEntry) => {
          const isCurrent = currentObs.some((obs) => obs.resourceId === historyEntry.resourceId);
          return (
            <VitalHistoryElement
              historyEntry={historyEntry}
              onDelete={isCurrent && !isReadOnly ? handleDeleteVital : undefined}
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
      <AccordionCard label={title} collapsed={isCollapsed} onSwitch={handleSectionCollapse}>
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
                      value={weightKg ? formatWeightKg(weightKg) : ''}
                      disabled={isSaving || isPatientRefusedOptionSelected}
                      isInputError={false}
                      onChange={handleKgInput}
                    />
                    <Typography fontSize={25}>=</Typography>
                    <VitalsTextInputFiled
                      label="Weight (lbs)"
                      value={weightKg ? formatWeightLbs(weightKg) : ''}
                      disabled={isSaving || isPatientRefusedOptionSelected}
                      isInputError={false}
                      onChange={handleLbsInput}
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
                    disabled={!weightKg && !isPatientRefusedOptionSelected}
                    loading={isSaving}
                    onClick={handleSaveWeightObservation}
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
                          disabled={isSaving}
                          checked={isPatientRefusedOptionSelected}
                          onChange={(e) => handleWeightOptionChanged(e.target.checked, 'patient_refused')}
                        />
                      }
                      label={
                        <Typography
                          sx={{
                            fontSize: '16px',
                            fontWeight: 500,
                            color: isSaving ? lighten(theme.palette.text.primary, 0.4) : theme.palette.text.primary,
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
