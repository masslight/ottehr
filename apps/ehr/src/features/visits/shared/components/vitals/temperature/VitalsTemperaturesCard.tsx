import { Box, FormControl, Grid, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ChangeEvent, JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  toVitalTemperatureObservationMethod,
  VitalFieldNames,
  VitalsTemperatureObservationDTO,
  VitalTemperatureObservationMethod,
} from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { HISTORY_ELEMENT_SKELETON_TEXT, VitalsCardProps } from '../types';
import { textToTemperatureNumber } from './helpers';

type VitalsTemperatureCardProps = VitalsCardProps<VitalsTemperatureObservationDTO>;
const VitalsTemperaturesCard: React.FC<VitalsTemperatureCardProps> = ({
  handleSaveVital,
  handleDeleteVital,
  currentObs,
  historicalObs,
  historyElementSkeletonText = HISTORY_ELEMENT_SKELETON_TEXT,
}): JSX.Element => {
  const [temperatureValueText, setTemperatureValueText] = useState('');
  const [temperatureValueTextFahrenheit, setTemperatureValueTextFahrenheit] = useState('');
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  // the method how this Temperature observation has been acquired
  const [observationQualifier, setObservationsQualifier] = useState<string>('');

  const [isTemperatureValidationError, setTemperatureValidationError] = useState<boolean>(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const [isSaving, setIsSaving] = useState(false);

  const isDisabledAddButton = !temperatureValueText || isTemperatureValidationError;

  const latestTemperatureValue = currentObs[0]?.value;

  const handleSaveTemperatureObservation = async (temperatureValueText: string): Promise<void> => {
    // console.log(`handleSaveTemperatureObservation() value=[${temperatureValueText}]`);

    const temperatureValueNumber = textToTemperatureNumber(temperatureValueText);
    if (!temperatureValueNumber) return;

    const observationMethod = toVitalTemperatureObservationMethod(observationQualifier);
    try {
      setIsSaving(true);
      const vitalObs: VitalsTemperatureObservationDTO = {
        field: VitalFieldNames.VitalTemperature,
        value: temperatureValueNumber,
        observationMethod: observationMethod,
      };
      await handleSaveVital(vitalObs);
      setTemperatureValueText('');
      setTemperatureValueTextFahrenheit('');
      setObservationsQualifier('');
    } catch {
      enqueueSnackbar('Error saving Temperature data', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTextInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const tempAsText = e.target.value;
    setTemperatureValueText(tempAsText);
    const tempAsNumber = textToTemperatureNumber(tempAsText);
    setTemperatureValueTextFahrenheit(tempAsNumber ? celsiusToFahrenheit(tempAsNumber).toString() : '');
    if (tempAsText.length === 0) {
      setTemperatureValidationError(false);
    }
  }, []);

  const handleTextInputChangeFahrenheit = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const tempAsText = e.target.value;
      setTemperatureValueTextFahrenheit(tempAsText);
      const tempAsNumber = textToTemperatureNumber(tempAsText);
      setTemperatureValueText(tempAsNumber ? fahrenheitToCelsius(tempAsNumber).toString() : '');
      if (tempAsText.length === 0) {
        setTemperatureValidationError(false);
      }
    },
    []
  );

  // if (!vitalsEntities.length && isLoading)
  //   return <InPersonLoader height="80px" marginTop="20px" backgroundColor={theme.palette.background.paper} />;

  const renderTempQualifierDropdown = (): JSX.Element => {
    return (
      <FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small" disabled={isSaving}>
        <InputLabel id="qualifier-label">Qualifier</InputLabel>
        <Select
          value={observationQualifier}
          label="Qualifier"
          labelId="qualifier-label"
          variant="outlined"
          error={false}
          defaultValue=""
          onChange={(event) => {
            const eventValue = event.target.value;
            const selectedQualifier = eventValue && eventValue.length > 0 ? eventValue : '';
            setObservationsQualifier(selectedQualifier);
          }}
        >
          <MenuItem key="default_obs_method" value={''}>
            <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
              &nbsp;
            </Typography>
          </MenuItem>
          {Object.values(VitalTemperatureObservationMethod).map((obsMethod) => (
            <MenuItem key={obsMethod} value={obsMethod}>
              <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
                {obsMethod}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

  const renderRightColumn = (): JSX.Element => {
    return (
      <VitalsHistoryContainer
        currentEncounterObs={currentObs}
        historicalObs={historicalObs}
        isLoading={false}
        historyElementSkeletonText={historyElementSkeletonText}
        historyElementCreator={(historyEntry) => {
          const isCurrent = currentObs.some((obs) => obs.resourceId === historyEntry.resourceId);
          return (
            <VitalHistoryElement
              historyEntry={historyEntry}
              onDelete={isCurrent && !isReadOnly ? handleDeleteVital : undefined}
              dataTestId={dataTestIds.vitalsPage.temperatureItem}
            />
          );
        }}
      />
    );
  };

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`Temp (C) ${latestTemperatureValue ?? ''}`}
        collapsed={isCollapsed}
        onSwitch={handleSectionCollapse}
        dataTestId={dataTestIds.vitalsPage.temperatureHeader}
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
                  m: 2,
                  p: 2,
                  pt: 1,
                  pl: 1,
                }}
                rowSpacing={1}
                columnSpacing={1}
              >
                {/* Temperature Input Field column */}
                <Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 1, sm: 1, md: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      gap: 1,
                    }}
                  >
                    <VitalsTextInputFiled
                      label="Temp (C)"
                      value={temperatureValueText}
                      disabled={isSaving}
                      isInputError={isTemperatureValidationError}
                      onChange={handleTextInputChange}
                      data-testid={dataTestIds.vitalsPage.temperatureInput}
                    />
                    <Typography fontSize={25}>=</Typography>
                    <VitalsTextInputFiled
                      label="Temp (F)"
                      value={temperatureValueTextFahrenheit}
                      disabled={isSaving}
                      isInputError={isTemperatureValidationError}
                      onChange={handleTextInputChangeFahrenheit}
                    />
                  </Box>
                </Grid>

                {/* Qualifier/method dropdown column */}
                <Grid item xs={12} sm={3} md={3} lg={4} order={{ xs: 2, sm: 2, md: 2, lg: 2 }}>
                  {renderTempQualifierDropdown()}
                </Grid>

                {/* Add Button column */}
                <Grid item xs={12} sm={3} md={3} lg={2} order={{ xs: 3, sm: 3, md: 3, lg: 3 }}>
                  <RoundedButton
                    disabled={isDisabledAddButton}
                    loading={isSaving}
                    size="small"
                    onClick={() => handleSaveTemperatureObservation(temperatureValueText)}
                    color="primary"
                    sx={{
                      height: '40px',
                      px: 2,
                    }}
                    data-testid={dataTestIds.vitalsPage.temperatureAddButton}
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

export default VitalsTemperaturesCard;
