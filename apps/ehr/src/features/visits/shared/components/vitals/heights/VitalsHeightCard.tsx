import { Box, Grid, Typography } from '@mui/material';
import React, { JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { VitalsHeightObservationDTO } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { VITALS_FORM_BORDER_TRANSITION, VITALS_FORM_ERROR_BORDER } from '../constants';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { useVitalsSaveOnEnter } from '../hooks/useVitalsSaveOnEnter';
import { VitalsCardProps } from '../types';

type VitalsHeightCardProps = VitalsCardProps<VitalsHeightObservationDTO>;

const VitalsHeightCard: React.FC<VitalsHeightCardProps> = ({ field }): JSX.Element => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { isLargeScreen } = useScreenDimensions();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestHeightValue = field.current[0]?.value;
  const { localState } = field;

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
                  border: field.localState.validationError ? VITALS_FORM_ERROR_BORDER : 'none',
                  transition: VITALS_FORM_BORDER_TRANSITION,
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
                      value={localState.valueCm}
                      disabled={field.isSaving}
                      isInputError={localState.validationError}
                      onChange={localState.handleCmChange}
                      onKeyDown={handleKeyDown}
                      data-testid={dataTestIds.vitalsPage.heightInput}
                    />
                    <Typography fontSize={25}>=</Typography>
                    <VitalsTextInputFiled
                      label="Height (inch)"
                      value={localState.valueInches}
                      disabled={field.isSaving}
                      isInputError={localState.validationError}
                      onChange={localState.handleInchesChange}
                      onKeyDown={handleKeyDown}
                    />
                    <Typography fontSize={25}>=</Typography>
                    <VitalsTextInputFiled
                      label="Height (ft)"
                      value={localState.valueFeet}
                      disabled={field.isSaving}
                      isInputError={localState.validationError}
                      onChange={localState.handleFeetChange}
                      onKeyDown={handleKeyDown}
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
                    disabled={localState.isDisabled}
                    onClick={field.save}
                    loading={field.isSaving}
                    color="primary"
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
