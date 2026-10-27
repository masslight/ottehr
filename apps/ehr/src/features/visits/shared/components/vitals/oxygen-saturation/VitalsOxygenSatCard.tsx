import ClearIcon from '@mui/icons-material/Clear';
import { Box, Button, FormControl, Grid, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import React, { JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { SUPPLEMENTAL_O2_FLOW_RATE_UNIT } from 'utils/lib/helpers/vitals/vitals-oxygen-saturation.helper';
import {
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsOxygenSatObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextFreeInputField, VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { VITALS_FORM_BORDER_TRANSITION, VITALS_FORM_ERROR_BORDER } from '../constants';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { useVitalsSaveOnEnter } from '../hooks/useVitalsSaveOnEnter';
import { VitalsCardProps } from '../types';

type VitalsOxygenSatCardProps = VitalsCardProps<VitalsOxygenSatObservationDTO>;
const VitalsOxygenSatCard: React.FC<VitalsOxygenSatCardProps> = ({ field }): JSX.Element => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { isLargeScreen } = useScreenDimensions();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestOxySatValue = field.current[0]?.value;
  const { localState } = field;

  const { handleKeyDown } = useVitalsSaveOnEnter({
    onSave: field.save,
  });

  const isSupplementalO2 = localState.observationQualifier === VitalsOxygenSatObservationMethod.OnSupplementalO2;

  const renderDropdown = ({
    label,
    labelId,
    value,
    options,
    onChange,
  }: {
    label: string;
    labelId: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
  }): JSX.Element => {
    return (
      <FormControl fullWidth size="small" sx={{ backgroundColor: 'white' }} disabled={field.isSaving}>
        <InputLabel id={labelId}>{label}</InputLabel>
        <Select
          value={value}
          label={label}
          labelId={labelId}
          variant="outlined"
          error={false}
          defaultValue=""
          onChange={(event) => onChange(event.target.value)}
        >
          <MenuItem key="default_obs_method" value={''}>
            <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
              &nbsp;
            </Typography>
          </MenuItem>
          {options.map((option) => (
            <MenuItem key={option} value={option}>
              <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
                {option}
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
        historyElementCreator={(historyEntry) => {
          const isCurrent = field.current.some((obs) => obs.resourceId === historyEntry.resourceId);
          return (
            <VitalHistoryElement
              historyEntry={historyEntry}
              onDelete={isCurrent && !isReadOnly ? field.delete : undefined}
              dataTestId={dataTestIds.vitalsPage.oxygenSaturationItem}
            />
          );
        }}
      />
    );
  };

  return (
    <Box>
      <AccordionCard
        label={`Oxygen sat (%) ${latestOxySatValue ?? ''}`}
        collapsed={isCollapsed}
        onSwitch={handleSectionCollapse}
        dataTestId={dataTestIds.vitalsPage.oxygenSaturationHeader}
        headerItem={
          field.hasData && !isReadOnly ? (
            <Button
              size="small"
              variant="text"
              startIcon={<ClearIcon fontSize="small" />}
              onClick={(e) => {
                e.stopPropagation();
                field.onClearForm?.();
              }}
            >
              Clear draft
            </Button>
          ) : undefined
        }
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
                  border: field.localState.validationError ? VITALS_FORM_ERROR_BORDER : 'none',
                  transition: VITALS_FORM_BORDER_TRANSITION,
                }}
              >
                {/* Oxy sat Input Field column */}
                <Grid item xs={12} sm={4} md={4} lg={4} order={{ xs: 1, sm: 1, md: 1 }}>
                  <VitalsTextInputFiled
                    label="Sat (%)"
                    value={localState.value}
                    disabled={field.isSaving}
                    isInputError={localState.isValueInvalid && localState.validationError}
                    onChange={localState.handleValueChange}
                    onKeyDown={handleKeyDown}
                    data-testid={dataTestIds.vitalsPage.oxygenSaturationInput}
                  />
                </Grid>

                {/* Qualifier/method dropdown column */}
                <Grid
                  item
                  xs={12}
                  sm={4}
                  md={4}
                  lg={4}
                  order={{ xs: 2, sm: 2, md: 2, lg: 2 }}
                  sx={{ mt: isLargeScreen ? 0 : 0 }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      ml: 1,
                    }}
                  >
                    {renderDropdown({
                      label: 'Qualifier',
                      labelId: 'qualifier-label',
                      value: localState.observationQualifier,
                      options: Object.values(VitalsOxygenSatObservationMethod),
                      onChange: localState.handleQualifierChange,
                    })}
                  </Box>
                </Grid>

                {/* Add Button column */}
                <Grid item xs={12} sm={4} md={4} lg={4} order={{ xs: 3, sm: 3, md: 3, lg: 3 }} sx={{ mt: 0 }}>
                  <RoundedButton
                    disabled={localState.isDisabled}
                    loading={field.isSaving}
                    onClick={field.save}
                    color="primary"
                    sx={{
                      height: '40px',
                      px: 2,
                      ml: 1,
                    }}
                    data-testid={dataTestIds.vitalsPage.oxygenSaturationAddButton}
                  >
                    Add
                  </RoundedButton>
                </Grid>

                {isSupplementalO2 && (
                  <>
                    <Grid item xs={12} sm={4} md={4} lg={4} order={{ xs: 4 }} sx={{ mt: 2 }}>
                      <VitalsTextInputFiled
                        label={`Flow rate (${SUPPLEMENTAL_O2_FLOW_RATE_UNIT})`}
                        value={localState.flowRate}
                        disabled={field.isSaving}
                        isInputError={localState.isFlowRateInvalid && localState.validationError}
                        onChange={localState.handleFlowRateChange}
                        onKeyDown={handleKeyDown}
                      />
                    </Grid>

                    <Grid item xs={12} sm={4} md={4} lg={4} order={{ xs: 5 }} sx={{ mt: 2 }}>
                      <Box sx={{ ml: 1 }}>
                        {renderDropdown({
                          label: 'Type',
                          labelId: 'supplemental-o2-delivery-type-label',
                          value: localState.deliveryType,
                          options: Object.values(VitalsSupplementalO2DeliveryType),
                          onChange: localState.handleDeliveryTypeChange,
                        })}
                      </Box>
                    </Grid>

                    {localState.deliveryType === VitalsSupplementalO2DeliveryType.Other && (
                      <Grid item xs={12} sm={8} md={8} lg={8} order={{ xs: 6 }} sx={{ mt: 2 }}>
                        <VitalsTextFreeInputField
                          placeholder="Please specify"
                          inputProps={{ 'aria-label': 'Please specify other type' }}
                          value={localState.deliveryTypeOther}
                          disabled={field.isSaving}
                          onChange={localState.handleDeliveryTypeOtherChange}
                          onKeyDown={handleKeyDown}
                        />
                      </Grid>
                    )}
                  </>
                )}
              </Grid>
            }
            rightColumn={renderRightColumn()}
          />
        )}
      </AccordionCard>
    </Box>
  );
};

export default VitalsOxygenSatCard;
