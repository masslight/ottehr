import { Box, Grid } from '@mui/material';
import React, { JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { VitalsRespirationRateObservationDTO } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { VITALS_FORM_BORDER_TRANSITION, VITALS_FORM_ERROR_BORDER } from '../constants';
import { useVitalsSaveOnEnter } from '../hooks/useVitalsSaveOnEnter';
import { VitalsCardProps } from '../types';

type VitalsRespirationRateCardProps = VitalsCardProps<VitalsRespirationRateObservationDTO>;
const VitalsRespirationRateCard: React.FC<VitalsRespirationRateCardProps> = ({ field }): JSX.Element => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestRespRateValue = field.current[0]?.value;
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
              dataTestId={dataTestIds.vitalsPage.respirationRateItem}
            />
          );
        }}
      />
    );
  };

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`RR (/min) ${latestRespRateValue ?? ''}`}
        collapsed={isCollapsed}
        onSwitch={handleSectionCollapse}
        dataTestId={dataTestIds.vitalsPage.respirationRateHeader}
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
                {/* RespirationRate Input Field column */}
                <Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 1, sm: 1, md: 1 }}>
                  <VitalsTextInputFiled
                    label="RR (/min)"
                    value={localState.value}
                    disabled={field.isSaving}
                    isInputError={localState.validationError}
                    onChange={localState.handleValueChange}
                    onKeyDown={handleKeyDown}
                    data-testid={dataTestIds.vitalsPage.respirationRateInput}
                  />
                </Grid>

                {/* Add Button column */}
                <Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 2, sm: 2, md: 2, lg: 2 }} sx={{ mt: 0 }}>
                  <RoundedButton
                    size="small"
                    disabled={localState.isDisabled}
                    loading={field.isSaving}
                    onClick={field.save}
                    color="primary"
                    sx={{
                      height: '40px',
                      px: 2,
                      ml: 1,
                    }}
                    data-testid={dataTestIds.vitalsPage.respirationRateAddButton}
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

export default VitalsRespirationRateCard;
