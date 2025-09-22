import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateRange } from '@mui/x-date-pickers-pro';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { useState } from 'react';

interface GenerateReportModalProps {
  open: boolean;
  onClose: () => void;
}

export const GenerateReportModal: React.FC<GenerateReportModalProps> = ({ open, onClose }) => {
  const [reportType, setReportType] = useState<'vitals' | 'time'>('vitals');
  const [dateRange, setDateRange] = useState<DateRange<any>>([null, null]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 4,
          minHeight: '40vh',
          maxHeight: '70vh',
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
            Generate Report
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Select Report Type */}
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
            Select Report Type
          </Typography>
          <RadioGroup row value={reportType} onChange={(e) => setReportType(e.target.value as 'vitals' | 'time')}>
            <FormControlLabel value="vitals" control={<Radio />} label="Vitals Report" />
            <FormControlLabel value="time" control={<Radio />} label="Time Report" />
          </RadioGroup>
        </Box>

        {/* Select Date Range */}
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
            Select Date Range
          </Typography>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateRangePicker
              value={dateRange}
              onChange={(newValue) => setDateRange(newValue)}
              localeText={{ start: 'Start Date', end: 'End Date' }}
              slots={{
                textField: TextField,
              }}
            />
          </LocalizationProvider>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
