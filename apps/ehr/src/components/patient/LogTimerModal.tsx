import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  TextareaAutosize,
  Typography,
} from '@mui/material';
import React, { ReactElement, useState } from 'react';

interface LogTimerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { serviceType: ServiceType; interactiveCommunication: boolean; notes: string }) => void;
  onCancel: () => void;
  title?: string;
  message: ReactElement;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'success' | 'info' | 'warning';
}

type ServiceType = 'CCM' | 'PCM' | 'RPM' | 'RTM' | '';

export const LogTimerModal: React.FC<LogTimerModalProps> = ({
  open,
  onClose,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Yes',
  cancelText = 'No',
  confirmColor = 'primary',
}) => {
  const [serviceType, setServiceType] = useState<ServiceType>('');
  const [interactiveCommunication, setInteractiveCommunication] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [errors, setErrors] = useState<{
    serviceType?: string;
    interactiveCommunication?: string;
    notes?: string;
  }>({});

  const getNoteLength = (text: string): any => {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .trim().length;
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!serviceType) {
      newErrors.serviceType = 'Service type is required';
    }

    if (interactiveCommunication === null) {
      newErrors.interactiveCommunication = 'Please select if interactive communication was performed';
    }

    if (!notes.trim()) {
      newErrors.notes = 'Notes are required';
    } else if (getNoteLength(notes) > 1000) {
      newErrors.notes = 'Notes cannot exceed 1000 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = (): void => {
    if (validateForm()) {
      onConfirm({
        serviceType,
        interactiveCommunication: interactiveCommunication!,
        notes: notes.trim(),
      });
      resetForm();
    }
  };

  const handleCancel = (): void => {
    onCancel();
    resetForm();
  };

  const resetForm = (): void => {
    setServiceType('');
    setInteractiveCommunication(null);
    setNotes('');
    setErrors({});
  };

  const handleClose = (): void => {
    onClose();
    resetForm();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogContent>
        {title && (
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
        )}

        <Typography sx={{ mb: 2 }}>{message}</Typography>

        <FormControl component="fieldset" error={!!errors.serviceType} sx={{ mb: 3, width: '100%' }}>
          <FormLabel component="legend" required>
            Service Type
          </FormLabel>
          <RadioGroup
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as ServiceType)}
            row
            sx={{ mt: 1 }}
          >
            <FormControlLabel value="CCM" control={<Radio />} label="CCM – Chronic Care Management" />
            <FormControlLabel value="PCM" control={<Radio />} label="PCM – Principal Care Management" />
            <FormControlLabel value="RPM" control={<Radio />} label="RPM – Remote Physiological Monitoring" />
            <FormControlLabel value="RTM" control={<Radio />} label="RTM – Remote Therapeutic Monitoring" />
          </RadioGroup>
          {errors.serviceType && <FormHelperText>{errors.serviceType}</FormHelperText>}
        </FormControl>

        <FormControl component="fieldset" error={!!errors.interactiveCommunication} sx={{ mb: 3, width: '100%' }}>
          <FormLabel component="legend" required>
            Was an Interactive Communication performed during this time?
          </FormLabel>
          <RadioGroup
            value={interactiveCommunication === null ? '' : interactiveCommunication.toString()}
            onChange={(e) => setInteractiveCommunication(e.target.value === 'true')}
            row
            sx={{ mt: 1 }}
          >
            <FormControlLabel value="true" control={<Radio />} label="Yes" />
            <FormControlLabel value="false" control={<Radio />} label="No" />
          </RadioGroup>
          {errors.interactiveCommunication && <FormHelperText>{errors.interactiveCommunication}</FormHelperText>}
        </FormControl>

        <FormControl error={!!errors.notes} sx={{ width: '100%' }}>
          <FormLabel component="legend" required>
            Notes
          </FormLabel>
          <TextareaAutosize
            minRows={4}
            maxRows={8}
            value={notes}
            onChange={(e) => {
              const value = e.target.value;
              setNotes(value);
              if (!value.trim()) {
                setErrors((prev) => ({ ...prev, notes: 'Notes are required' }));
              } else if (getNoteLength(value) > 1000) {
                setErrors((prev) => ({ ...prev, notes: 'Notes cannot exceed 1000 characters' }));
              } else {
                setErrors((prev) => ({ ...prev, notes: undefined }));
              }
            }}
            onFocus={(e) => {
              e.target.style.outline = 'none';
              e.target.style.border = errors.notes ? '1px solid #d32f2f' : '1px solid #1976d2';
            }}
            onBlur={(e) => {
              e.target.style.outline = 'none';
              e.target.style.border = errors.notes ? '1px solid #d32f2f' : '1px solid #ccc';
            }}
            placeholder="Enter your notes here..."
            style={{
              width: '100%',
              padding: '12px',
              border: errors.notes ? '1px solid #d32f2f' : '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'inherit',
              fontSize: '14px',
              marginTop: '8px',
              resize: 'vertical',
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <FormHelperText>{errors.notes || `${getNoteLength(notes)}/1000 characters`}</FormHelperText>
          </Box>
        </FormControl>
      </DialogContent>

      <DialogActions
        sx={{
          display: 'flex',
          justifyContent: 'end',
          pr: 3,
          pb: 2,
        }}
      >
        <Button onClick={handleCancel} variant="outlined">
          {cancelText}
        </Button>
        <Button onClick={handleConfirm} color={confirmColor} variant="contained">
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
