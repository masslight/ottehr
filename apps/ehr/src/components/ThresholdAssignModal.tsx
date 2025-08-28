import { Box, Button, CircularProgress, FormControl, Grid, Modal, TextField, Typography } from '@mui/material';
import { FC, useState } from 'react';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 500,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  display: 'flex',
  flexDirection: 'column',
};

type ThresholdAssignModalProps = {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  deviceType: string;
  onSaveThreshold: (thresholds: Record<string, string>) => Promise<void>;
};

export const ThresholdAssignModal: FC<ThresholdAssignModalProps> = ({
  open,
  onClose,
  deviceType,
  onSaveThreshold,
}): JSX.Element => {
  const [thresholds, setThresholds] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleClose: () => void = (): void => {
    setThresholds({});
    onClose();
  };

  const handleSave: () => Promise<void> = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await onSaveThreshold(thresholds);
      handleClose();
    } catch (error: unknown) {
      console.error('Failed to save thresholds:', error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleThresholdChange: (field: string, value: string) => void = (field: string, value: string): void => {
    setThresholds((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getDeviceConfig: () => {
    title: string;
    fields: { id: string; label: string; placeholder: string }[];
  } = (): { title: string; fields: { id: string; label: string; placeholder: string }[] } => {
    switch (deviceType) {
      case 'WS':
        return {
          title: 'Weight Threshold',
          fields: [
            {
              id: 'weight',
              label: 'Measured weight (in grams)',
              placeholder: 'Enter weight threshold in grams',
            },
          ],
        };
      case 'BG':
        return {
          title: 'Blood Glucose Threshold',
          fields: [
            {
              id: 'glucose',
              label: 'Blood Glucose',
              placeholder: 'Enter glucose threshold',
            },
          ],
        };
      case 'BP':
        return {
          title: 'Blood Pressure Thresholds',
          fields: [
            {
              id: 'systolic',
              label: 'BP Systolic (mmHg)',
              placeholder: 'Enter systolic threshold',
            },
            {
              id: 'diastolic',
              label: 'BP Diastolic (mmHg)',
              placeholder: 'Enter diastolic threshold',
            },
          ],
        };
      default:
        return {
          title: 'Device Threshold',
          fields: [
            {
              id: 'default',
              label: 'Threshold Value',
              placeholder: 'Enter threshold value',
            },
          ],
        };
    }
  };

  const deviceConfig = getDeviceConfig();

  return (
    <Modal open={open} onClose={handleClose} aria-labelledby="threshold-modal" aria-describedby="set-device-thresholds">
      <Box sx={modalStyle}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography id="threshold-modal" variant="h6" component="h2">
            {deviceConfig.title}
          </Typography>
        </Box>
        <Grid container spacing={2}>
          {deviceConfig.fields.map((field) => (
            <Grid item xs={12} key={field.id}>
              <FormControl fullWidth>
                <TextField
                  label={field.label}
                  placeholder={field.placeholder}
                  variant="outlined"
                  value={thresholds[field.id] || ''}
                  onChange={(e) => handleThresholdChange(field.id, e.target.value)}
                  type="number"
                />
              </FormControl>
            </Grid>
          ))}
        </Grid>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
          <Button variant="outlined" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isSaving || deviceConfig.fields.some((field) => !thresholds[field.id])}
          >
            {isSaving ? <CircularProgress size={24} color="inherit" /> : 'Save Thresholds'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};
