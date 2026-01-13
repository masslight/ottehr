import { Box, Grid, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ChangeEvent, JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { VitalFieldNames, VitalsHeightObservationDTO } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { VitalsCardProps } from '../types';
import {
  heightCmToFeetText,
  heightCmToInchesText,
  textToHeightNumber,
  textToHeightNumberFromFeet,
  textToHeightNumberFromInches,
} from './helpers';

type VitalsHeightCardProps = VitalsCardProps<VitalsHeightObservationDTO>;

const VitalsHeightCard: React.FC<VitalsHeightCardProps> = ({
  handleSaveVital,
  handleDeleteVital,
  currentObs,
  historicalObs,
}): JSX.Element => {
  const [heightValueTextCm, setHeightValueTextCm] = useState('');
  const [heightValueTextInches, setHeightValueTextInches] = useState('');
  const [heightValueTextFeet, setHeightValueTextFeet] = useState('');
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const [isHeightValidationError, setHeightValidationError] = useState<boolean>(false);
  const { isLargeScreen } = useScreenDimensions();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const [isSaving, setIsSaving] = useState(false);

  const isDisabledAddButton =
    (!heightValueTextCm && !heightValueTextInches && !heightValueTextFeet) || isHeightValidationError;

  const latestHeightValue = currentObs[0]?.value;

  const handleSaveHeightObservation = async (): Promise<void> => {
    let heightValueNumber: number | undefined;

    if (heightValueTextCm) {
      heightValueNumber = textToHeightNumber(heightValueTextCm);
    } else if (heightValueTextInches) {
      heightValueNumber = textToHeightNumberFromInches(heightValueTextInches);
    } else if (heightValueTextFeet) {
      heightValueNumber = textToHeightNumberFromFeet(heightValueTextFeet);
    }

    if (!heightValueNumber) return;

    try {
      setIsSaving(true);
      const vitalObs: VitalsHeightObservationDTO = {
        field: VitalFieldNames.VitalHeight,
        value: heightValueNumber,
      };
      await handleSaveVital(vitalObs);
      setHeightValueTextCm('');
      setHeightValueTextInches('');
      setHeightValueTextFeet('');
    } catch {
      enqueueSnackbar('Error saving Height vital record', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTextInputChangeCm = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const cmAsText = e.target.value;
    setHeightValueTextCm(cmAsText);
    const heightCm = textToHeightNumber(cmAsText);
    if (heightCm) {
      const inchesText = heightCmToInchesText(heightCm);
      setHeightValueTextInches(inchesText);

      const feetText = heightCmToFeetText(heightCm);
      setHeightValueTextFeet(feetText);
    } else {
      setHeightValueTextInches('');
      setHeightValueTextFeet('');
    }
    if (cmAsText.length === 0) {
      setHeightValidationError(false);
    }
  }, []);

  const handleTextInputChangeInches = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const inchesAsText = e.target.value;
    setHeightValueTextInches(inchesAsText);
    const heightCm = textToHeightNumberFromInches(inchesAsText);
    if (heightCm) {
      setHeightValueTextCm(heightCm.toString());

      const feetText = heightCmToFeetText(heightCm);
      setHeightValueTextFeet(feetText);
    } else {
      setHeightValueTextCm('');
      setHeightValueTextFeet('');
    }
    if (inchesAsText.length === 0) {
      setHeightValidationError(false);
    }
  }, []);

  const handleTextInputChangeFeet = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const feetAsText = e.target.value;
    setHeightValueTextFeet(feetAsText);

    const heightCm = textToHeightNumberFromFeet(feetAsText);

    if (heightCm) {
      setHeightValueTextCm(heightCm.toString());

      const inchesText = heightCmToInchesText(heightCm);
      setHeightValueTextInches(inchesText);
    } else {
      setHeightValueTextCm('');
      setHeightValueTextInches('');
    }

    if (feetAsText.length === 0) {
      setHeightValidationError(false);
    }
  }, []);

  const renderRightColumn = (): JSX.Element => {
    return (
      <VitalsHistoryContainer
        currentEncounterObs={currentObs}
        historicalObs={historicalObs}
        isLoading={false}
        historyElementCreator={(historyEntry) => {
          const isCurrent = currentObs.some((obs) => obs.resourceId === historyEntry.resourceId);
          return (
            <VitalHistoryElement
              historyEntry={historyEntry}
              onDelete={isCurrent && !isReadOnly ? handleDeleteVital : undefined}
              dataTestId={dataTestIds.vitalsPage.heightItem}
            />
          );
        }}
      />
    );
  };

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`Height (cm) ${latestHeightValue ?? ''}`}
        collapsed={isCollapsed}
        onSwitch={handleSectionCollapse}
        dataTestId={dataTestIds.vitalsPage.heightHeader}
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
                {/* Height Input Field column */}
                <Grid item xs={12} sm={10} md={10} lg={10} order={{ xs: 1, sm: 1, md: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      gap: 1,
                    }}
                  >
                    <VitalsTextInputFiled
                      label="Height (cm)"
                      value={heightValueTextCm}
                      disabled={isSaving}
                      isInputError={isHeightValidationError}
                      onChange={handleTextInputChangeCm}
                      data-testid={dataTestIds.vitalsPage.heightInput}
                    />
                    <Typography fontSize={25}>=</Typography>
                    <VitalsTextInputFiled
                      label="Height (inch)"
                      value={heightValueTextInches}
                      disabled={isSaving}
                      isInputError={isHeightValidationError}
                      onChange={handleTextInputChangeInches}
                    />
                    <Typography fontSize={25}>=</Typography>
                    <VitalsTextInputFiled
                      label="Height (ft)"
                      value={heightValueTextFeet}
                      disabled={isSaving}
                      isInputError={isHeightValidationError}
                      onChange={handleTextInputChangeFeet}
                    />
                  </Box>
                </Grid>

                {/* Add Button column */}
                <Grid
                  item
                  xs={12}
                  sm={2}
                  md={2}
                  lg={2}
                  order={{ xs: 2, sm: 2, md: 2, lg: 2 }}
                  sx={{ mt: isLargeScreen ? 0 : 0 }}
                >
                  <RoundedButton
                    size="small"
                    disabled={isDisabledAddButton}
                    onClick={handleSaveHeightObservation}
                    loading={isSaving}
                    color="primary"
                    data-testid="add-height-button"
                    sx={{
                      height: '40px',
                      px: 2,
                      ml: 1,
                    }}
                    data-testid={dataTestIds.vitalsPage.heightAddButton}
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

export default VitalsHeightCard;
