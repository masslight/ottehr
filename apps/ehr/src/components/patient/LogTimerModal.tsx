import CloseIcon from '@mui/icons-material/Close'; // Add this import
import {
  Backdrop,
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  IconButton, // Add this import
  Radio,
  RadioGroup,
  TextareaAutosize,
} from '@mui/material';
import React, { ReactElement, useState } from 'react';
import { RoundedButton } from '../RoundedButton';
import RoundedSwitch from '../RoundedSwitch';

interface LogTimerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { serviceType: ServiceType; interactiveCommunication: boolean; notes: string }) => void;
  onCancel: () => void;
  title?: string;
  message: ReactElement;
  isSubmitting?: boolean;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'success' | 'info' | 'warning';
}

type ServiceType = 'CCM' | 'PCM' | 'RPM' | 'RTM' | '';

export const LogTimerModal: React.FC<LogTimerModalProps> = ({
  open,
  onClose,
  onConfirm,
  onCancel,
  isSubmitting,
  confirmColor = 'primary',
}) => {
  const [serviceType, setServiceType] = useState<ServiceType>('');
  const [interactiveCommunication, setInteractiveCommunication] = useState<boolean | null>(false);
  const [notes, setNotes] = useState<string>('');
  const [errors, setErrors] = useState<{
    serviceType?: string;
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
        interactiveCommunication: interactiveCommunication ?? false,
        notes: notes.trim(),
      });
      resetForm();
    }
  };

  const handleCancel = (): void => {
    onCancel();
    handleClose();
  };

  const resetForm = (): void => {
    setServiceType('');
    setInteractiveCommunication(false);
    setNotes('');
    setErrors({});
  };

  const handleClose = (): void => {
    if (!isSubmitting) {
      onClose();
      resetForm();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 4,
          position: 'relative',
        },
      }}
      fullWidth
    >
      <IconButton
        aria-label="close"
        onClick={handleClose}
        disabled={isSubmitting}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: (theme) => theme.palette.grey[500],
          zIndex: 1300,
        }}
      >
        <CloseIcon />
      </IconButton>

      <Backdrop
        sx={{
          position: 'absolute',
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          borderRadius: 4,
        }}
        open={isSubmitting || false}
      >
        <CircularProgress color="primary" />
      </Backdrop>

      <Box sx={{ opacity: isSubmitting ? 0.5 : 1, pointerEvents: isSubmitting ? 'none' : 'auto' }}>
        <DialogContent>
          <FormControl component="fieldset" error={!!errors.serviceType} sx={{ mb: 3, width: '100%' }}>
            <FormLabel
              sx={{
                color: errors.serviceType ? '#d32f2f' : '#010101',
                fontWeight: 500,
                '& .css-9zk9qk-MuiFormLabel-asterisk': {
                  color: '#D32F2F',
                },
              }}
              component="legend"
              required
            >
              Select Care Service Type
            </FormLabel>
            <RadioGroup
              value={serviceType}
              onChange={(e) => {
                const value = e.target.value as ServiceType;
                setServiceType(value);
                if (!value) {
                  setErrors((prev) => ({ ...prev, serviceType: 'Service type is required' }));
                } else {
                  setErrors((prev) => ({ ...prev, serviceType: undefined }));
                }
              }}
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

          <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
            <FormLabel
              component="legend"
              sx={{
                fontWeight: 500,
                marginBottom: 1,
                color: '#010101',
              }}
            >
              Was an Interactive Communication performed during this time?
            </FormLabel>
            <RoundedSwitch
              checked={interactiveCommunication === true}
              onChange={(e) => setInteractiveCommunication(e.target.checked)}
            />
          </FormControl>

          <FormControl error={!!errors.notes} sx={{ width: '100%' }}>
            <FormLabel
              component="legend"
              sx={{
                color: '#010101',
                fontWeight: 500,
                '& .css-9zk9qk-MuiFormLabel-asterisk': {
                  color: '#D32F2F',
                },
              }}
              required
            >
              Additional Notes
            </FormLabel>
            <TextareaAutosize
              minRows={4}
              maxRows={8}
              value={notes}
              onChange={(e) => {
                const value = e.target.value;
                setNotes(value);
                if (!value.trim()) {
                  setErrors((prev) => ({ ...prev, notes: 'Additional Notes are required' }));
                } else if (getNoteLength(value) > 1000) {
                  setErrors((prev) => ({ ...prev, notes: 'Additional Notes cannot exceed 1000 characters' }));
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
              placeholder="Add any relevant notes about the care provided..."
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
            m: 2,
            my: 0,
            pb: 2,
          }}
        >
          <RoundedButton
            sx={{ minWidth: '115px' }}
            onClick={handleConfirm}
            disabled={isSubmitting}
            color={confirmColor}
            variant="contained"
          >
            Submit
          </RoundedButton>
          <RoundedButton sx={{ minWidth: '115px' }} onClick={handleCancel} disabled={isSubmitting} variant="outlined">
            Discard
          </RoundedButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
