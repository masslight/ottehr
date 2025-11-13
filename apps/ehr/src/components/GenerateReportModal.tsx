import { CalendarMonth } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Backdrop,
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Radio,
  RadioGroup,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateRange } from '@mui/x-date-pickers-pro';
import { MobileDateRangePicker } from '@mui/x-date-pickers-pro/MobileDateRangePicker';
import { SingleInputDateRangeField } from '@mui/x-date-pickers-pro/SingleInputDateRangeField';
import dayjs from 'dayjs';
import { useState } from 'react';
import { genreateManualReport } from '../../../../packages/zambdas/src/services/reports';
import { RoundedButton } from './RoundedButton';

interface GenerateReportModalProps {
  open: boolean;
  onClose: () => void;
  loadReports: () => void;
  patientId: string;
}

export const GenerateReportModal: React.FC<GenerateReportModalProps> = ({ open, onClose, patientId, loadReports }) => {
  const [reportType, setReportType] = useState<'vitals' | 'time' | null>(null);
  const [dateRange, setDateRange] = useState<DateRange<any>>([null, null]);
  const [loading, setLoading] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastSeverity, setToastSeverity] = useState<'success' | 'warning'>('warning');

  const handleCloseToast = (): void => setToastOpen(false);

  const resetForm = (): void => {
    setReportType(null);
    setDateRange([null, null]);
  };

  const handleCloseModal = (): void => {
    resetForm();
    onClose();
  };

  const handleGenerate = async (): Promise<any> => {
    if (!dateRange[0] || !dateRange[1]) {
      setToastMessage('Please select a date range.');
      setToastSeverity('warning');
      setToastOpen(true);
      return;
    }

    setLoading(true);

    try {
      const startDate = dayjs(dateRange[0]).startOf('day').toISOString();
      const endDate = dayjs(dateRange[1]).endOf('day').toISOString();
      const apiReportType = reportType === 'vitals' ? 'vitals-report' : 'time-report';

      const res = (await genreateManualReport(patientId, startDate, endDate, 'csv', apiReportType)) as any;

      const responseMessage = res?.message;

      if (responseMessage === 'No vitals data found for the selected date range.') {
        setToastMessage('No vitals data found for the selected date range.');
        setToastSeverity('warning');
        setToastOpen(true);
        setLoading(false);
        return;
      }

      if (
        responseMessage === 'Time report created successfully.' ||
        responseMessage === 'Vital report created successfully.'
      ) {
        setToastSeverity('success');
      } else {
        setToastSeverity('warning');
      }

      setToastMessage(responseMessage || 'Falied to generate report.');
      setToastOpen(true);
      resetForm();
      loadReports();
      onClose();
    } catch (err) {
      console.error('Error generating report:', err);
      setToastMessage('Error generating report.');
      setToastSeverity('warning');
      setToastOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleCloseModal}
        maxWidth="xs"
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
        <Backdrop
          sx={{
            position: 'absolute',
            color: '#fff',
            zIndex: (theme) => theme.zIndex.drawer + 1,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderRadius: 4,
          }}
          open={loading || false}
        >
          <CircularProgress color="primary" />
        </Backdrop>

        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderColor: 'divider',
            pb: 2,
          }}
        >
          <Typography variant="h4" color="primary.dark">
            Generate Report
          </Typography>
          <IconButton onClick={handleCloseModal} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Report Type */}
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
              Select Report Type
            </Typography>
            <RadioGroup row value={reportType} onChange={(e) => setReportType(e.target.value as 'vitals' | 'time')}>
              <FormControlLabel value="vitals" control={<Radio />} label="Vitals Report" />
              <FormControlLabel value="time" control={<Radio />} label="Time Report" />
            </RadioGroup>
          </Box>

          {/* Date Range */}
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
              Select Date Range
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <MobileDateRangePicker
                value={dateRange}
                onChange={(newValue) => setDateRange(newValue)}
                slots={{
                  field: SingleInputDateRangeField,
                  textField: (params) => (
                    <TextField
                      {...params}
                      placeholder="Select Date Range"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <InputAdornment position="start">
                            <CalendarMonth color="primary" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        maxWidth: '400px',
                        width: '100%',
                        '& .MuiInputBase-input': { cursor: 'pointer' },
                      }}
                    />
                  ),
                }}
              />
            </LocalizationProvider>
          </Box>
        </DialogContent>

        <DialogActions sx={{ display: 'flex', justifyContent: 'end', m: 2, my: 0, pb: 2 }}>
          <RoundedButton sx={{ minWidth: '115px' }} variant="contained" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate'}
          </RoundedButton>
          <RoundedButton sx={{ minWidth: '115px' }} onClick={handleCloseModal} variant="outlined">
            Cancel
          </RoundedButton>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toastOpen}
        autoHideDuration={6000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseToast} severity={toastSeverity} sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </>
  );
};
