import { Box, CircularProgress, FormControl, Grid, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ChangeEvent, JSX, useCallback, useState } from 'react';
import {
  toVitalHeartbeatObservationMethod,
  VitalFieldNames,
  VitalHeartbeatObservationMethod,
  VitalsHeartbeatObservationDTO,
} from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { AccordionCard, DoubleColumnContainer } from '../../../../../telemed/components';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { useVitalsCardState } from '../hooks/useVitalsCardState';
import { composeHeartbeatHistoryEntries, isValidHeartbeatPerMinValue, textToHeartbeatNumber } from './helpers';
import VitalHeartbeatHistoryElement from './VitalHeartbeatHistoryElement';
import { VitalHeartbeatHistoryEntry } from './VitalHeartbeatHistoryEntry';

const VitalsHeartbeatCard: React.FC = (): JSX.Element => {
  const {
    isLoadingVitalsByEncounter,
    handleSaveVital,
    handleDeleteVital,
    isSavingCardData,
    setSavingCardData,
    screenDimensions: { isLargeScreen },
    vitalsHistory: { mainHistoryEntries, extraHistoryEntries, latestHistoryEntry },
    historyElementSkeletonText,
  } = useVitalsCardState<VitalsHeartbeatObservationDTO, VitalHeartbeatHistoryEntry>(
    VitalFieldNames.VitalHeartbeat,
    composeHeartbeatHistoryEntries
  );

  const [heartbeatValueText, setHeartbeatValueText] = useState('');

  // the method how this Heartbeat observation has been acquired
  const [observationQualifier, setObservationsQualifier] = useState<string>('');

  const [isHeartbeatValidationError, setHeartbeatValidationError] = useState<boolean>(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const isDisabledAddButton =
    !heartbeatValueText || isSavingCardData || isLoadingVitalsByEncounter || isHeartbeatValidationError;

  const latestHeartbeatValue = latestHistoryEntry?.heartbeatPerMin;

  const handleSaveHeartbeatObservation = async (heartbeatValueText: string): Promise<void> => {
    const heartbeatValueNumber = textToHeartbeatNumber(heartbeatValueText);
    if (!heartbeatValueNumber) return;

    const observationMethod = toVitalHeartbeatObservationMethod(observationQualifier);
    try {
      setSavingCardData(true);
      const vitalObs: VitalsHeartbeatObservationDTO = {
        field: VitalFieldNames.VitalHeartbeat,
        value: heartbeatValueNumber,
        observationMethod: observationMethod,
      };
      await handleSaveVital(vitalObs);
      setHeartbeatValueText('');
      setObservationsQualifier('');
    } catch (error) {
      enqueueSnackbar('Error saving Heartbeat data', { variant: 'error' });
    } finally {
      setSavingCardData(false);
    }
  };

  const handleTextInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const hrAsText = e.target.value;
    setHeartbeatValueText(hrAsText);
    const heartbeat = textToHeartbeatNumber(hrAsText);
    if (heartbeat) {
      setHeartbeatValidationError(!isValidHeartbeatPerMinValue(heartbeat));
    }
    if (hrAsText.length === 0) {
      setHeartbeatValidationError(false);
    }
  }, []);

  const renderQualifierDropdown = (): JSX.Element => {
    return (
      <FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small" disabled={isSavingCardData}>
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

  return (
    <Box sx={{ mt: 3 }}>
      <AccordionCard
        label={`HR (/min) ${latestHeartbeatValue ?? ''}`}
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
              {/* Heartbeat Input Field column */}
              <Grid item xs={12} sm={4} md={4} lg={4} order={{ xs: 1, sm: 1, md: 1 }}>
                <VitalsTextInputFiled
                  label="HR (/min)"
                  value={heartbeatValueText}
                  disabled={isSavingCardData}
                  isInputError={isHeartbeatValidationError}
                  onChange={handleTextInputChange}
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
                  disabled={isDisabledAddButton}
                  onClick={() => handleSaveHeartbeatObservation(heartbeatValueText)}
                  color="primary"
                  sx={{
                    height: '40px',
                    px: 2,
                    ml: 1,
                  }}
                  startIcon={isSavingCardData ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  Add
                </RoundedButton>
              </Grid>
            </Grid>
          }
          rightColumn={
            <VitalsHistoryContainer
              mainHistoryEntries={mainHistoryEntries}
              extraHistoryEntries={extraHistoryEntries}
              isLoading={isLoadingVitalsByEncounter}
              historyElementSkeletonText={historyElementSkeletonText}
              historyElementCreator={(historyEntry) => {
                return <VitalHeartbeatHistoryElement historyEntry={historyEntry} onDelete={handleDeleteVital} />;
              }}
            />
          }
        />
      </AccordionCard>
    </Box>
  );
};

export default VitalsHeartbeatCard;
