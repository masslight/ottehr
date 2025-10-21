import { Box, Grid, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ChangeEvent, JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { kgToLbs, textToWeightNumber, VitalFieldNames, VitalsWeightObservationDTO } from 'utils';
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
  const [weightValueText, setWeightValueText] = useState('');
  const [weightValueTextLbs, setWeightValueTextLbs] = useState('');
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestWeightValue = currentObs[0]?.value;

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveWeightObservation = async (weightValueText: string): Promise<void> => {
    const weightValueNumber = textToWeightNumber(weightValueText);
    if (!weightValueNumber) return;
    try {
      setIsSaving(true);
      const vitalObs: VitalsWeightObservationDTO = {
        field: VitalFieldNames.VitalWeight,
        value: weightValueNumber,
      };
      await handleSaveVital(vitalObs);
      setWeightValueText('');
      setWeightValueTextLbs('');
    } catch {
      enqueueSnackbar('Error saving Weight data', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTextInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const weightAsText = e.target.value;
    setWeightValueText(weightAsText);
    const weightAsNumber = textToWeightNumber(weightAsText);
    setWeightValueTextLbs(weightAsNumber ? kgToLbs(weightAsNumber).toString() : '');
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

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`Weight (kg) ${latestWeightValue ?? ''}`}
        collapsed={isCollapsed}
        onSwitch={handleSectionCollapse}
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
                }}
              >
                {/* Weight Input Field column */}
                <Grid item xs={12} sm={8} md={8} lg={8} order={{ xs: 1, sm: 1, md: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      gap: 1,
                    }}
                  >
                    <VitalsTextInputFiled
                      label="Weight (kg)"
                      value={weightValueText}
                      disabled={isSaving}
                      isInputError={false}
                      onChange={handleTextInputChange}
                    />
                    <Typography fontSize={25}>=</Typography>
                    <VitalsTextInputFiled
                      label="Weight (lbs)"
                      value={weightValueTextLbs}
                      disabled={true}
                      isInputError={false}
                      onChange={() => {}}
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
                    disabled={!weightValueText}
                    loading={isSaving}
                    onClick={() => handleSaveWeightObservation(weightValueText)}
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
