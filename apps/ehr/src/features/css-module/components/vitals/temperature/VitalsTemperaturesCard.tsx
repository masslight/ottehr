import { Box, FormControl, Grid, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ChangeEvent, JSX, useCallback, useMemo, useState } from 'react';
import {
  toVitalTemperatureObservationMethod,
  VitalFieldNames,
  VitalsTemperatureObservationDTO,
  VitalTemperatureObservationMethod,
} from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { AccordionCard, DoubleColumnContainer } from '../../../../../telemed/components';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { HISTORY_ELEMENT_SKELETON_TEXT, VitalsCardProps } from '../types';
import { celsiusToFahrenheit, textToTemperatureNumber } from './helpers';

type VitalsTemperatureCardProps = VitalsCardProps<VitalsTemperatureObservationDTO>;
const VitalsTemperaturesCard: React.FC<VitalsTemperatureCardProps> = ({
  handleSaveVital,
  handleDeleteVital,
  currentObs,
  historicalObs,
  historyElementSkeletonText = HISTORY_ELEMENT_SKELETON_TEXT,
}): JSX.Element => {
  const [temperatureValueText, setTemperatureValueText] = useState('');

  // the method how this Temperature observation has been acquired
  const [observationQualifier, setObservationsQualifier] = useState<string>('');

  const [isTemperatureValidationError, setTemperatureValidationError] = useState<boolean>(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const { isLargeScreen } = useScreenDimensions();

  const [isSaving, setIsSaving] = useState(false);

  const isDisabledAddButton = !temperatureValueText || isTemperatureValidationError;

  const latestTemperatureValue = currentObs[0]?.value;

  const enteredTemperatureInFahrenheit: number | undefined = useMemo(() => {
    const temperatureCelsius = textToTemperatureNumber(temperatureValueText);
    if (!temperatureCelsius) return;
    return celsiusToFahrenheit(temperatureCelsius);
  }, [temperatureValueText]);

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
    if (tempAsText.length === 0) {
      setTemperatureValidationError(false);
    }
  }, []);

  // if (!vitalsEntities.length && isLoading)
  //   return <CSSLoader height="80px" marginTop="20px" backgroundColor={theme.palette.background.paper} />;

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

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`Temp (C) ${latestTemperatureValue ?? ''}`}
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
              {/* Temperature Input Field column */}
              <Grid item xs={12} sm={6} md={6} lg={4} order={{ xs: 1, sm: 1, md: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                  }}
                >
                  <VitalsTextInputFiled
                    label="Temp (C)"
                    value={temperatureValueText}
                    disabled={isSaving}
                    isInputError={isTemperatureValidationError}
                    onChange={handleTextInputChange}
                  />

                  <Typography fontSize={25} sx={{ ml: 1 }}>
                    =
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    label="Temp (F)"
                    sx={{
                      '& fieldset': { border: 'none' },
                      maxWidth: '110px',
                    }}
                    disabled
                    InputLabelProps={{ shrink: true }}
                    value={enteredTemperatureInFahrenheit ?? ''}
                  />
                </Box>
              </Grid>

              {/* Qualifier/method dropdown column */}
              <Grid
                item
                xs={12}
                sm={3}
                md={3}
                lg={4}
                order={{ xs: 2, sm: 2, md: 2, lg: 2 }}
                sx={{ mt: isLargeScreen ? 0 : 0 }}
              >
                {renderTempQualifierDropdown()}
              </Grid>

              {/* Add Button column */}
              <Grid
                item
                xs={12}
                sm={3}
                md={3}
                lg={4}
                order={{ xs: 3, sm: 3, md: 3, lg: 3 }}
                sx={{ mt: isLargeScreen ? 0 : 0 }}
              >
                <RoundedButton
                  disabled={isDisabledAddButton}
                  loading={isSaving}
                  size="small"
                  onClick={() => handleSaveTemperatureObservation(temperatureValueText)}
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
              historyElementSkeletonText={historyElementSkeletonText}
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

export default VitalsTemperaturesCard;
