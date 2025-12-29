import { Box, Grid, Typography } from '@mui/material';
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
  const [weightKg, setWeightKg] = useState<number | undefined>(undefined);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestWeightKg = currentObs[0]?.value;

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveWeightObservation = async (weightKg: number): Promise<void> => {
    try {
      setIsSaving(true);
      const vitalObs: VitalsWeightObservationDTO = {
        field: VitalFieldNames.VitalWeight,
        value: weightKg,
      };
      await handleSaveVital(vitalObs);
      setWeightKg(undefined);
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
    (latestWeightKg ? formatWeight(latestWeightKg, vitalsConfig['vital-weight'].unit) : '');

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
                      disabled={isSaving}
                      isInputError={false}
                      onChange={handleKgInput}
                    />
                    <Typography fontSize={25}>=</Typography>
                    <VitalsTextInputFiled
                      label="Weight (lbs)"
                      value={weightKg ? formatWeightLbs(weightKg) : ''}
                      disabled={isSaving}
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
                    disabled={!weightKg}
                    loading={isSaving}
                    onClick={() => weightKg && handleSaveWeightObservation(weightKg)}
                    color="primary"
                    data-testid="add-weight-button"
                    sx={{
                      height: '40px',
                      px: 2,
                      ml: 1,
                    }}
                  >
                    Add
                  </RoundedButton>
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
