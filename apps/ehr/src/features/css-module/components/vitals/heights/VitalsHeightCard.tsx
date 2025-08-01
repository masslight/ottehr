import { Box, Grid, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ChangeEvent, JSX, useCallback, useMemo, useState } from 'react';
import { cmToInches, VitalFieldNames, VitalsHeightObservationDTO } from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { AccordionCard, DoubleColumnContainer } from '../../../../../telemed/components';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { VitalsCardProps } from '../types';
import { textToHeightNumber } from './helpers';

type VitalsHeightCardProps = VitalsCardProps<VitalsHeightObservationDTO>;
const VitalsHeightCard: React.FC<VitalsHeightCardProps> = ({
  handleSaveVital,
  handleDeleteVital,
  currentObs,
  historicalObs,
}): JSX.Element => {
  const [heightValueText, setHeightValueText] = useState('');

  const [isHeightValidationError, setHeightValidationError] = useState<boolean>(false);
  const { isLargeScreen } = useScreenDimensions();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const [isSaving, setIsSaving] = useState(false);

  const isDisabledAddButton = !heightValueText || isHeightValidationError;

  const latestHeightValue = currentObs[0]?.value;

  const enteredHeightInInch: number | undefined = useMemo(() => {
    const heightCm = textToHeightNumber(heightValueText);
    if (!heightCm) return;
    return cmToInches(heightCm);
  }, [heightValueText]);

  const handleSaveHeightObservation = async (heightValueText: string): Promise<void> => {
    const heightValueNumber = textToHeightNumber(heightValueText);
    if (!heightValueNumber) return;

    try {
      setIsSaving(true);
      const vitalObs: VitalsHeightObservationDTO = {
        field: VitalFieldNames.VitalHeight,
        value: heightValueNumber,
      };
      await handleSaveVital(vitalObs);
      setHeightValueText('');
    } catch {
      enqueueSnackbar('Error saving Height vital record', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTextInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const heightAsText = e.target.value;
      setHeightValueText(heightAsText);
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
                    disabled={isSaving}
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
                  loading={isSaving}
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
              currentEncounterObs={currentObs}
              historicalObs={historicalObs}
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

export default VitalsHeightCard;
