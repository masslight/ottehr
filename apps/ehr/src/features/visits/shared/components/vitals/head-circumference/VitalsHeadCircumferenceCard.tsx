import ClearIcon from '@mui/icons-material/Clear';
import { Box, Button, Grid } from '@mui/material';
import React, { JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { HEIGHT_CM_DISPLAY_PRECISION, HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { VitalsHeadCircumferenceObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ageInMonthsOnDate } from 'utils/lib/utils/dateUtils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from '../../../stores/appointment/appointment.store';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { VitalsUnitInputRow } from '../components/VitalsUnitInputRow';
import { VITALS_FORM_BORDER_TRANSITION, VITALS_FORM_ERROR_BORDER } from '../constants';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { useVitalsSaveOnEnter } from '../hooks/useVitalsSaveOnEnter';
import { useVitalsUnitInputOrder } from '../hooks/useVitalsUnitInputOrder';
import { VitalsCardProps } from '../types';

type VitalsHeadCircumferenceCardProps = VitalsCardProps<VitalsHeadCircumferenceObservationDTO>;

// Head circumference is measured at every well visit through 24 months (AAP/Bright Futures), so the card starts
// open for younger patients and collapsed from this age on; staff can open it at any age.
export const HEAD_CIRCUMFERENCE_COLLAPSED_FROM_MONTHS = 24;

const VitalsHeadCircumferenceCard: React.FC<VitalsHeadCircumferenceCardProps> = ({ field }): JSX.Element => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { isLargeScreen } = useScreenDimensions();
  const {
    resources: { patient, appointment },
  } = useAppointmentData();

  // Age at the visit (today without an appointment start); an unknown age leaves the card open.
  const ageMonths = ageInMonthsOnDate(patient?.birthDate, appointment?.start);
  const collapsedByDefault = ageMonths !== undefined && ageMonths >= HEAD_CIRCUMFERENCE_COLLAPSED_FROM_MONTHS;
  // Undefined until staff toggle the card, so the default follows the patient once loaded.
  const [toggledCollapsed, setToggledCollapsed] = useState<boolean>();
  const isCollapsed = toggledCollapsed ?? collapsedByDefault;

  const handleSectionCollapse = useCallback(() => {
    setToggledCollapsed(!isCollapsed);
  }, [isCollapsed]);

  const latestCm = field.current[0]?.value;

  const latestValue =
    latestCm === undefined ? '' : HeightMeasurement.fromCm(latestCm).getCm(HEIGHT_CM_DISPLAY_PRECISION);

  const { localState } = field;
  const unitInputOrder = useVitalsUnitInputOrder();

  const { handleKeyDown } = useVitalsSaveOnEnter({
    onSave: field.save,
  });

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
              dataTestId={dataTestIds.vitalsPage.headCircumferenceItem}
            />
          );
        }}
      />
    );
  };

  return (
    <Box>
      <AccordionCard
        label={`Head circumference (cm) ${latestValue ?? ''}`}
        collapsed={isCollapsed}
        onSwitch={handleSectionCollapse}
        dataTestId={dataTestIds.vitalsPage.headCircumferenceHeader}
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
                <Grid item xs={12} sm={10} md={10} lg={10} order={{ xs: 1, sm: 1, md: 1 }}>
                  <VitalsUnitInputRow
                    order={unitInputOrder}
                    metricInput={
                      <VitalsTextInputFiled
                        label="cm"
                        value={localState.valueCm}
                        disabled={field.isSaving}
                        isInputError={localState.validationError}
                        onChange={localState.handleCmChange}
                        onKeyDown={handleKeyDown}
                        data-testid={dataTestIds.vitalsPage.headCircumferenceInput}
                      />
                    }
                    imperialInput={
                      <VitalsTextInputFiled
                        label="inches"
                        value={localState.valueInches}
                        disabled={field.isSaving}
                        isInputError={localState.validationError}
                        onChange={localState.handleInchesChange}
                        onKeyDown={handleKeyDown}
                        data-testid={dataTestIds.vitalsPage.headCircumferenceInchesInput}
                      />
                    }
                  />
                </Grid>

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
                    disabled={localState.isDisabled}
                    onClick={field.save}
                    loading={field.isSaving}
                    color="primary"
                    sx={{
                      height: '40px',
                      px: 2,
                      ml: 1,
                    }}
                    data-testid={dataTestIds.vitalsPage.headCircumferenceAddButton}
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

export default VitalsHeadCircumferenceCard;
