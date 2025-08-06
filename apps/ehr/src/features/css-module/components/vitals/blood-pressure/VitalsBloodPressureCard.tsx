import { Box, FormControl, Grid, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ChangeEvent, JSX, useCallback, useState } from 'react';
import {
  toVitalBloodPressureObservationMethod,
  VitalBloodPressureObservationMethod,
  VitalFieldNames,
  VitalsBloodPressureObservationDTO,
} from 'utils';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { AccordionCard, DoubleColumnContainer } from '../../../../../telemed/components';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { VitalsCardProps } from '../types';
import { textToBloodPressureNumber } from './helpers';

type VitalsBloodPressureCardProps = VitalsCardProps<VitalsBloodPressureObservationDTO>;
const VitalsBloodPressureCard: React.FC<VitalsBloodPressureCardProps> = ({
  handleSaveVital,
  handleDeleteVital,
  currentObs,
  historicalObs,
}): JSX.Element => {
  const [systolicValueText, setSystolicValueText] = useState('');
  const [diastolicValueText, setDiastolicValueText] = useState('');

  // the method how this Blood pressure observation has been acquired
  const [observationQualifier, setObservationsQualifier] = useState<string>('');

  const [isSystolicValidationError, setSystolicValidationError] = useState<boolean>(false);
  const [isDiastolicValidationError, setDiastolicValidationError] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prevCollapseState) => !prevCollapseState);
  }, [setIsCollapsed]);

  const { isLargeScreen } = useScreenDimensions();

  const isDisabledAddButton =
    !systolicValueText || !diastolicValueText || isSystolicValidationError || isDiastolicValidationError;

  const latestPressureValueLabel = (() => {
    const latestHistoryEntry = currentObs[0];
    if (!latestHistoryEntry) return;
    return `${latestHistoryEntry.systolicPressure}/${latestHistoryEntry.diastolicPressure}`;
  })();

  const handleSavePressureObservation = async (
    systolicPressureText: string,
    diastolicValueText: string
  ): Promise<void> => {
    const systolicValueNum = textToBloodPressureNumber(systolicPressureText);
    if (!systolicValueNum) return;

    const diastolicValueNum = textToBloodPressureNumber(diastolicValueText);
    if (!diastolicValueNum) return;

    const observationMethod = toVitalBloodPressureObservationMethod(observationQualifier);
    try {
      setIsSaving(true);
      const vitalObs: VitalsBloodPressureObservationDTO = {
        field: VitalFieldNames.VitalBloodPressure,
        systolicPressure: systolicValueNum,
        diastolicPressure: diastolicValueNum,
        observationMethod: observationMethod,
      };
      await handleSaveVital(vitalObs);
      setSystolicValueText('');
      setDiastolicValueText('');
      setObservationsQualifier('');
    } catch {
      enqueueSnackbar('Error saving Blood Pressure vital data', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSystolicTextInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const systolicAsText = e.target.value;
      setSystolicValueText(systolicAsText);
      if (systolicAsText.length === 0) {
        setSystolicValidationError(false);
      }
    },
    [setSystolicValidationError, setSystolicValueText]
  );

  const handleDiastolicTextInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const diastolicAsText = e.target.value;
      setDiastolicValueText(diastolicAsText);
      if (diastolicAsText.length === 0) {
        setDiastolicValidationError(false);
      }
    },
    [setDiastolicValidationError, setDiastolicValueText]
  );

  const renderBloodPressureQualifierDropdown = (): JSX.Element => {
    return (
      <FormControl size="small" fullWidth sx={{ backgroundColor: 'white' }} disabled={isSaving}>
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
          {Object.values(VitalBloodPressureObservationMethod).map((obsMethod) => (
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
        label={`BP (mm Hg) ${latestPressureValueLabel ?? ''}`}
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
              {/* Systolic / Diastolic pressure Input Field column */}
              <Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 1, sm: 1, md: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                  }}
                >
                  <VitalsTextInputFiled
                    label="Systolic"
                    value={systolicValueText}
                    disabled={isSaving}
                    isInputError={isSystolicValidationError}
                    onChange={handleSystolicTextInputChange}
                  />
                  <Typography fontSize={25} sx={{ ml: 1 }}>
                    /
                  </Typography>
                  <VitalsTextInputFiled
                    label="Diastolic"
                    value={diastolicValueText}
                    disabled={isSaving}
                    isInputError={isDiastolicValidationError}
                    onChange={handleDiastolicTextInputChange}
                    sx={{ ml: 1 }}
                  />
                </Box>
              </Grid>

              {/* Qualifier/method dropdown column */}
              <Grid
                item
                xs={12}
                sm={3}
                md={3}
                lg={3}
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
                  {renderBloodPressureQualifierDropdown()}
                </Box>
              </Grid>

              {/* Add Button column */}
              <Grid
                item
                xs={12}
                sm={3}
                md={3}
                lg={3}
                order={{ xs: 3, sm: 3, md: 3, lg: 3 }}
                sx={{ mt: isLargeScreen ? 0 : 0 }}
              >
                <RoundedButton
                  size="small"
                  disabled={isDisabledAddButton}
                  loading={isSaving}
                  onClick={() => handleSavePressureObservation(systolicValueText, diastolicValueText)}
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

export default VitalsBloodPressureCard;
