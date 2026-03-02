import { Box, FormControl, Grid, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import React, { JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { roundTemperatureValue, VitalsTemperatureObservationDTO, VitalTemperatureObservationMethod } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { HISTORY_ELEMENT_SKELETON_TEXT, VITALS_FORM_BORDER_TRANSITION, VITALS_FORM_ERROR_BORDER } from '../constants';
import { useVitalsSaveOnEnter } from '../hooks/useVitalsSaveOnEnter';
import { VitalsCardProps } from '../types';

type VitalsTemperatureCardProps = VitalsCardProps<VitalsTemperatureObservationDTO>;
const VitalsTemperaturesCard: React.FC<VitalsTemperatureCardProps> = ({
  field,
  historyElementSkeletonText = HISTORY_ELEMENT_SKELETON_TEXT,
}): JSX.Element => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestTemperatureValue = field.current[0]?.value;
  const { localState } = field;

  const { handleKeyDown } = useVitalsSaveOnEnter({
    onSave: field.save,
  });

  // if (!vitalsEntities.length && isLoading)
  //   return <InPersonLoader height="80px" marginTop="20px" backgroundColor={theme.palette.background.paper} />;

  const renderTempQualifierDropdown = (): JSX.Element => {
    return (
      <FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small" disabled={field.isSaving}>
        <InputLabel id="qualifier-label">Qualifier</InputLabel>
        <Select
          value={localState.observationQualifier}
          label="Qualifier"
          labelId="qualifier-label"
          variant="outlined"
          error={false}
          defaultValue=""
          onChange={(event) => {
            const eventValue = event.target.value;
            const selectedQualifier = eventValue && eventValue.length > 0 ? eventValue : '';
            localState.handleQualifierChange(selectedQualifier);
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
        currentEncounterObs={field.current}
        historicalObs={field.historical}
        isLoading={false}
        historyElementSkeletonText={historyElementSkeletonText}
        historyElementCreator={(historyEntry) => {
          const isCurrent = field.current.some((obs) => obs.resourceId === historyEntry.resourceId);
          return (
            <VitalHistoryElement
              historyEntry={historyEntry}
              onDelete={isCurrent && !isReadOnly ? field.delete : undefined}
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
        label={`Temp (C) ${latestTemperatureValue != null ? roundTemperatureValue(latestTemperatureValue) : ''}`}
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
                  border: field.localState.validationError ? VITALS_FORM_ERROR_BORDER : 'none',
                  transition: VITALS_FORM_BORDER_TRANSITION,
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
                      value={localState.valueCelsius}
                      disabled={field.isSaving}
                      isInputError={localState.isCelsiusInvalid && localState.validationError}
                      onChange={localState.handleCelsiusChange}
                      onKeyDown={handleKeyDown}
                      data-testid={dataTestIds.vitalsPage.temperatureInput}
                    />
                    <Typography fontSize={25}>=</Typography>
                    <VitalsTextInputFiled
                      label="Temp (F)"
                      value={localState.valueFahrenheit}
                      disabled={field.isSaving}
                      isInputError={localState.isFahrenheitInvalid && localState.validationError}
                      onChange={localState.handleFahrenheitChange}
                      onKeyDown={handleKeyDown}
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
                    disabled={localState.isDisabled}
                    loading={field.isSaving}
                    size="small"
                    onClick={field.save}
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
