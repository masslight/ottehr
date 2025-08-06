import { Box, Grid, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { JSX, useCallback, useMemo, useState } from 'react';
import { kgToLbs, textToWeightNumber, VitalFieldNames, VitalsWeightObservationDTO } from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { AccordionCard, DoubleColumnContainer } from '../../../../../telemed';
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

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestWeightValue = currentObs[0]?.value;

  const [isSaving, setIsSaving] = useState(false);

  const enteredWeightInLb: number | undefined = useMemo(() => {
    const weightKg = textToWeightNumber(weightValueText);
    if (!weightKg) return;
    return kgToLbs(weightKg);
  }, [weightValueText]);

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
    } catch {
      enqueueSnackbar('Error saving Weight data', { variant: 'error' });
    } finally {
      setIsSaving(false);
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
                    disabled={isSaving}
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
          rightColumn={
            <VitalsHistoryContainer
              historicalObs={historicalObs}
              currentEncounterObs={currentObs}
              isLoading={false}
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

export default VitalsWeightsCard;
