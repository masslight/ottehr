import { Box, CircularProgress, FormControl, Grid, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ChangeEvent, JSX, useCallback, useState } from 'react';
import {
  toVitalOxygenSatObservationMethod,
  VitalFieldNames,
  VitalsOxygenSatObservationDTO,
  VitalsOxygenSatObservationMethod,
} from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { AccordionCard, DoubleColumnContainer } from '../../../../../telemed/components';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { useVitalsCardState } from '../hooks/useVitalsCardState';
import { composeOxygenSatHistoryEntries, isValidOxySatPercentageValue, textToOxygenSatNumber } from './helpers';
import VitalOxygenSatHistoryElement from './VitalOxygenSatHistoryElement';
import { VitalsOxygenSatHistoryEntry } from './VitalsOxygenSatHistoryEntry';

const VitalsOxygenSatCard: React.FC = (): JSX.Element => {
  const {
    isLoadingVitalsByEncounter,
    handleSaveVital,
    handleDeleteVital,
    isSavingCardData,
    setSavingCardData,
    screenDimensions: { isLargeScreen },
    vitalsHistory: { mainHistoryEntries, extraHistoryEntries, latestHistoryEntry },
    historyElementSkeletonText,
  } = useVitalsCardState<VitalsOxygenSatObservationDTO, VitalsOxygenSatHistoryEntry>(
    VitalFieldNames.VitalOxygenSaturation,
    composeOxygenSatHistoryEntries
  );

  const [oxySatValueText, setOxySatValueText] = useState('');

  // the method how this Oxygen Saturation observation has been acquired
  const [observationQualifier, setObservationsQualifier] = useState<string>('');

  const [isOxySatValidationError, setOxySatValidationError] = useState<boolean>(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const isDisabledAddButton =
    !oxySatValueText || isSavingCardData || isLoadingVitalsByEncounter || isOxySatValidationError;

  const latestOxySatValue = latestHistoryEntry?.oxygenSatPercentage;

  const handleSaveOxySatObservation = useCallback(
    async (oxySatValueText: string): Promise<void> => {
      const oxySatValueNumber = textToOxygenSatNumber(oxySatValueText);
      if (!oxySatValueNumber) return;

      const observationMethod = toVitalOxygenSatObservationMethod(observationQualifier);
      try {
        setSavingCardData(true);
        const vitalObs: VitalsOxygenSatObservationDTO = {
          field: VitalFieldNames.VitalOxygenSaturation,
          value: oxySatValueNumber,
          observationMethod: observationMethod,
        };
        await handleSaveVital(vitalObs);
        setOxySatValueText('');
        setObservationsQualifier('');
      } catch (error) {
        enqueueSnackbar('Error saving oxygen saturation data', { variant: 'error' });
      } finally {
        setSavingCardData(false);
      }
    },
    [observationQualifier, setSavingCardData, handleSaveVital]
  );

  const handleTextInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const oxySatAsText = e.target.value;
      setOxySatValueText(oxySatAsText);
      const oxySaturation = textToOxygenSatNumber(oxySatAsText);
      if (oxySaturation) {
        setOxySatValidationError(!isValidOxySatPercentageValue(oxySaturation));
      }
      if (oxySatAsText.length === 0) {
        setOxySatValidationError(false);
      }
    },
    [setOxySatValidationError, setOxySatValueText]
  );

  const renderQualifierDropdown = (): JSX.Element => {
    return (
      <FormControl fullWidth size="small" sx={{ backgroundColor: 'white' }} disabled={isSavingCardData}>
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
          {Object.values(VitalsOxygenSatObservationMethod).map((obsMethod) => (
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
        label={`Oxygen sat (%) ${latestOxySatValue ?? ''}`}
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
              {/* Oxy sat Input Field column */}
              <Grid item xs={12} sm={4} md={4} lg={4} order={{ xs: 1, sm: 1, md: 1 }}>
                <VitalsTextInputFiled
                  label="Sat (%)"
                  value={oxySatValueText}
                  disabled={isSavingCardData}
                  isInputError={isOxySatValidationError}
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
                  disabled={isDisabledAddButton}
                  onClick={() => handleSaveOxySatObservation(oxySatValueText)}
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
                return <VitalOxygenSatHistoryElement historyEntry={historyEntry} onDelete={handleDeleteVital} />;
              }}
            />
          }
        />
      </AccordionCard>
    </Box>
  );
};

export default VitalsOxygenSatCard;
