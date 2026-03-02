import { Box, FormControl, Grid, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import React, { JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { VitalHeartbeatObservationMethod, VitalsHeartbeatObservationDTO } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { VITALS_FORM_BORDER_TRANSITION, VITALS_FORM_ERROR_BORDER } from '../constants';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { useVitalsSaveOnEnter } from '../hooks/useVitalsSaveOnEnter';
import { VitalsCardProps } from '../types';

type VitalsHeartbeatCardProps = VitalsCardProps<VitalsHeartbeatObservationDTO>;
const VitalsHeartbeatCard: React.FC<VitalsHeartbeatCardProps> = ({ field }): JSX.Element => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { isLargeScreen } = useScreenDimensions();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const latestHeartbeatValue = field.current[0]?.value;
  const { localState } = field;

  const { handleKeyDown } = useVitalsSaveOnEnter({
    onSave: field.save,
  });

  const renderQualifierDropdown = (): JSX.Element => {
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
          {Object.values(VitalHeartbeatObservationMethod).map((obsMethod) => (
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
        historyElementCreator={(historyEntry) => {
          const isCurrent = field.current.some((obs) => obs.resourceId === historyEntry.resourceId);
          return (
            <VitalHistoryElement
              historyEntry={historyEntry}
              onDelete={isCurrent && !isReadOnly ? field.delete : undefined}
              dataTestId={dataTestIds.vitalsPage.heartbeatItem}
            />
          );
        }}
      />
    );
  };

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`HR (/min) ${latestHeartbeatValue ?? ''}`}
        collapsed={isCollapsed}
        onSwitch={handleSectionCollapse}
        dataTestId={dataTestIds.vitalsPage.heartbeatHeader}
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
                {/* Heartbeat Input Field column */}
                <Grid item xs={12} sm={4} md={4} lg={4} order={{ xs: 1, sm: 1, md: 1 }}>
                  <VitalsTextInputFiled
                    label="HR (/min)"
                    value={localState.value}
                    disabled={field.isSaving}
                    isInputError={localState.validationError}
                    onChange={localState.handleValueChange}
                    onKeyDown={handleKeyDown}
                    data-testid={dataTestIds.vitalsPage.heartbeatInput}
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
                    {renderQualifierDropdown()}
                  </Box>
                </Grid>

                {/* Add Button column */}
                <Grid item xs={12} sm={4} md={4} lg={4} order={{ xs: 3, sm: 3, md: 3, lg: 3 }} sx={{ mt: 0 }}>
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
                    data-testid={dataTestIds.vitalsPage.heartbeatAddButton}
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

export default VitalsHeartbeatCard;
