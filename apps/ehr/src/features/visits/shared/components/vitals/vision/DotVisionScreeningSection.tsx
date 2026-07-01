import { Box, Divider, FormControlLabel, Grid, Radio, RadioGroup, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DOT_VISION_SCREENING_LABELS } from 'utils';
import { VitalsTextInputFiled } from '../components/VitalsTextInputFiled';
import DotVisionDocumentUploader from './DotVisionDocumentUploader';
import { DotVisionScreeningLocalState } from './useDotVisionScreeningLocalState';

interface DotVisionScreeningSectionProps {
  state: DotVisionScreeningLocalState;
  collapsed: boolean;
  onToggleCollapse: () => void;
  appointmentId?: string;
  isReadOnly: boolean;
  isSaving: boolean;
  onSave: () => void;
}

interface YesNoRowProps {
  label: string;
  value: boolean | null;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  showDivider?: boolean;
}

const YesNoRow: FC<YesNoRowProps> = ({ label, value, disabled, onChange, showDivider = true }) => {
  const theme = useTheme();
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1,
        }}
      >
        <Typography sx={{ fontSize: '16px', fontWeight: 500, color: theme.palette.primary.dark }}>{label}</Typography>
        <RadioGroup
          row
          value={value === null ? '' : value ? 'yes' : 'no'}
          onChange={(e) => onChange(e.target.value === 'yes')}
          sx={{ flexWrap: 'nowrap' }}
        >
          <FormControlLabel value="yes" disabled={disabled} control={<Radio size="small" />} label="Yes" />
          <FormControlLabel value="no" disabled={disabled} control={<Radio size="small" />} label="No" />
        </RadioGroup>
      </Box>
      {showDivider && <Divider />}
    </>
  );
};

export const DotVisionScreeningSection: FC<DotVisionScreeningSectionProps> = ({
  state,
  collapsed,
  onToggleCollapse,
  appointmentId,
  isReadOnly,
  isSaving,
  onSave,
}) => {
  const disabled = isReadOnly || isSaving;

  return (
    <Box sx={{ mt: 2 }}>
      <AccordionCard
        label="DOT Vision Screening"
        collapsed={collapsed}
        onSwitch={onToggleCollapse}
        dataTestId={dataTestIds.vitalsPage.dotVisionScreeningHeader}
      >
        <Box sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <VitalsTextInputFiled
                label={`${DOT_VISION_SCREENING_LABELS.horizontalFieldLeft} (degrees)`}
                value={state.horizontalFieldLeft}
                disabled={disabled}
                onChange={(e) => state.handleHorizontalFieldLeftChange(e.target.value)}
                data-testid={dataTestIds.vitalsPage.dotVisionHorizontalFieldLeftInput}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <VitalsTextInputFiled
                label={`${DOT_VISION_SCREENING_LABELS.horizontalFieldRight} (degrees)`}
                value={state.horizontalFieldRight}
                disabled={disabled}
                onChange={(e) => state.handleHorizontalFieldRightChange(e.target.value)}
                data-testid={dataTestIds.vitalsPage.dotVisionHorizontalFieldRightInput}
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }}>
            <YesNoRow
              label={DOT_VISION_SCREENING_LABELS.canRecognizeColors}
              value={state.canRecognizeColors}
              disabled={disabled}
              onChange={state.handleCanRecognizeColorsChange}
            />
            <YesNoRow
              label={DOT_VISION_SCREENING_LABELS.monocularVision}
              value={state.hasMonocularVision}
              disabled={disabled}
              onChange={state.handleMonocularVisionChange}
            />
            <YesNoRow
              label={DOT_VISION_SCREENING_LABELS.referredToSpecialist}
              value={state.referredToSpecialist}
              disabled={disabled}
              onChange={state.handleReferredChange}
            />
            <YesNoRow
              label={DOT_VISION_SCREENING_LABELS.receivedDocumentation}
              value={state.receivedDocumentation}
              disabled={disabled}
              onChange={state.handleReceivedDocumentationChange}
              showDivider={false}
            />
          </Box>

          {state.receivedDocumentation === true && appointmentId && (
            <DotVisionDocumentUploader
              appointmentId={appointmentId}
              document={state.document}
              disabled={disabled}
              onUploaded={state.setDocument}
              onRemove={() => state.setDocument(undefined)}
            />
          )}

          {!isReadOnly && (
            <RoundedButton
              disabled={!state.isValid || isSaving}
              loading={isSaving}
              onClick={onSave}
              color="primary"
              sx={{ mt: 2 }}
              data-testid={dataTestIds.vitalsPage.dotVisionAddButton}
            >
              Add
            </RoundedButton>
          )}
        </Box>
      </AccordionCard>
    </Box>
  );
};

export default DotVisionScreeningSection;
