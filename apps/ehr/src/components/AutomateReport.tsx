import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { useState } from 'react';
import { RoundedButton } from './RoundedButton';

interface AutomateReportModalProps {
  open: boolean;
  onClose: () => void;
}

export const AutomateReportModal: React.FC<AutomateReportModalProps> = ({ open, onClose }) => {
  const [reportName, setReportName] = useState('');
  const [reportTemplate, setReportTemplate] = useState('tabular');
  const [frequency, setFrequency] = useState('weekly');
  const [executionTime, setExecutionTime] = useState<Dayjs | null>(dayjs());
  const [fileFormats, setFileFormats] = useState<string[]>([]);
  const [branding, setBranding] = useState({ logo: '', header: '', footer: '' });

  const toggleFormat = (format: string): void => {
    setFileFormats((prev) => (prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 4,
          minHeight: '60vh',
          maxHeight: '90vh',
          boxShadow: '0px 6px 20px rgba(0,0,0,0.15)',
        },
      }}
    >
      {/* Title */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderColor: 'divider',
          pb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
            Automate Report
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Report Name */}
        <TextField
          label="Report Name / Title"
          value={reportName}
          onChange={(e) => setReportName(e.target.value)}
          fullWidth
        />

        {/* Report Template */}
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
            Report Template
          </Typography>
          <RadioGroup row value={reportTemplate} onChange={(e) => setReportTemplate(e.target.value)}>
            <FormControlLabel value="pdf" control={<Radio />} label="PDF" />
            <FormControlLabel value="csv" control={<Radio />} label="CSV" />
          </RadioGroup>
        </Box>

        {/* Fields / Columns Selection */}
        <TextField label="Fields / Columns Selection" placeholder="Choose columns to include..." fullWidth />

        {/* Scheduling */}
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
            Automation Frequency
          </Typography>
          <RadioGroup row value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <FormControlLabel value="daily" control={<Radio />} label="Daily" />
            <FormControlLabel value="weekly" control={<Radio />} label="Weekly" />
            <FormControlLabel value="monthly" control={<Radio />} label="Monthly" />
          </RadioGroup>
        </Box>

        {/* Time of Execution */}
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <TimePicker
            label="Time of Execution"
            value={executionTime}
            onChange={(newValue) => setExecutionTime(newValue)}
            sx={{ width: '100%' }}
          />
        </LocalizationProvider>

        {/* File Formats */}
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
            File Format(s)
          </Typography>
          <FormGroup row>
            {['PDF', 'Excel', 'CSV', 'JSON'].map((format) => (
              <FormControlLabel
                key={format}
                control={<Checkbox checked={fileFormats.includes(format)} onChange={() => toggleFormat(format)} />}
                label={format}
              />
            ))}
          </FormGroup>
        </Box>

        {/* Branding */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
              Logo (Max 2MB)
            </Typography>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 2 * 1024 * 1024) {
                    alert('File size must be less than 2 MB');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setBranding({ ...branding, logo: reader.result as string });
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Header Text"
              value={branding.header}
              onChange={(e) => setBranding({ ...branding, header: e.target.value })}
              fullWidth
            />
            <TextField
              label="Footer Text"
              value={branding.footer}
              onChange={(e) => setBranding({ ...branding, footer: e.target.value })}
              fullWidth
            />
          </Box>
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions
        sx={{
          display: 'flex',
          justifyContent: 'end',
          m: 2,
          my: 0,
          pb: 2,
        }}
      >
        <RoundedButton sx={{ minWidth: '115px' }} variant="contained">
          Automate
        </RoundedButton>
        <RoundedButton sx={{ minWidth: '115px' }} onClick={onClose} variant="outlined">
          Cancel
        </RoundedButton>
      </DialogActions>
    </Dialog>
  );
};
