import { Box, Grid } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ChangeEvent, JSX, useCallback, useState } from 'react';
import { VitalFieldNames, VitalsRespirationRateObservationDTO } from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { AccordionCard, DoubleColumnContainer } from '../../../../../telemed/components';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { VitalsCardProps } from '../types';
import { textToRespirationRateNumber } from './helpers';

type VitalsRespirationRateCardProps = VitalsCardProps<VitalsRespirationRateObservationDTO>;
const VitalsRespirationRateCard: React.FC<VitalsRespirationRateCardProps> = ({
  handleSaveVital,
  handleDeleteVital,
  currentObs,
  historicalObs,
}): JSX.Element => {
  const [respirationRateValueText, setRespirationRateValueText] = useState('');

  const [isRespirationRateValidationError, setRespirationRateValidationError] = useState<boolean>(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const [isSaving, setIsSaving] = useState(false);

  const isDisabledAddButton = !respirationRateValueText || isRespirationRateValidationError;

  const latestRespRateValue = currentObs[0]?.value;

  const handleSaveRespirationRateObservation = useCallback(
    async (respRateValueText: string): Promise<void> => {
      const respRateValueNumber = textToRespirationRateNumber(respRateValueText);
      if (!respRateValueNumber) return;

      try {
        setIsSaving(true);
        const vitalObs: VitalsRespirationRateObservationDTO = {
          field: VitalFieldNames.VitalRespirationRate,
          value: respRateValueNumber,
        };
        await handleSaveVital(vitalObs);
        setRespirationRateValueText('');
      } catch {
        enqueueSnackbar('Error saving respiration rate data', { variant: 'error' });
      } finally {
        setIsSaving(false);
      }
    },
    [handleSaveVital]
  );

  const handleTextInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const respirationRateAsText = e.target.value;
      setRespirationRateValueText(respirationRateAsText);
      if (respirationRateAsText.length === 0) {
        setRespirationRateValidationError(false);
      }
    },
    [setRespirationRateValidationError, setRespirationRateValueText]
  );

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`RR (/min) ${latestRespRateValue ?? ''}`}
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
              {/* RespirationRate Input Field column */}
              <Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 1, sm: 1, md: 1 }}>
                <VitalsTextInputFiled
                  label="RR (/min)"
                  value={respirationRateValueText}
                  disabled={isSaving}
                  isInputError={isRespirationRateValidationError}
                  onChange={handleTextInputChange}
                />
              </Grid>

              {/* Add Button column */}
              <Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 2, sm: 2, md: 2, lg: 2 }} sx={{ mt: 0 }}>
                <RoundedButton
                  size="small"
                  disabled={isDisabledAddButton}
                  loading={isSaving}
                  onClick={() => handleSaveRespirationRateObservation(respirationRateValueText)}
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

export default VitalsRespirationRateCard;
