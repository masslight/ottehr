import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  Popover,
  Radio,
  RadioGroup,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchReportSettings,
  getImageDownloadUrl,
  saveReportSettings,
} from '../../../../packages/zambdas/src/services/reports';
import { RoundedButton } from './RoundedButton';

interface BrandingData {
  logoFile: File | null | undefined;
  header: string;
  footer: string;
}

interface ReportSettings {
  title: string;
  reportType: string;
  frequency: string;
  automationTime?: string;
  logo?: any;
  header: string;
  footer: string;
}

export const AutomateReport = (): JSX.Element => {
  const [reportName, setReportName] = useState<string>('');
  const [reportTemplate, setReportTemplate] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('');
  const [automationTime, setAutomationTime] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [branding, setBranding] = useState<BrandingData>({
    logoFile: null,
    header: '',
    footer: '',
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [errors, setErrors] = useState<{
    reportName?: string;
    reportTemplate?: string;
    frequency?: string;
    automationTime?: string;
    header?: string;
    footer?: string;
    logoFile?: string;
  }>({});
  const [toastOpen, setToastOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastSeverity, setToastSeverity] = useState<'success' | 'warning'>('warning');
  const [nextTriggerDates, setNextTriggerDates] = useState<string[]>([]);
  const [fieldTouched, setFieldTouched] = useState<{
    reportName: boolean;
    header: boolean;
    footer: boolean;
  }>({
    reportName: false,
    header: false,
    footer: false,
  });
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  // Create a UTC time string in HH:mm:ss format (time only, no date)
  const createUTCTimeString = useCallback((hours = 0, minutes = 0): string => {
    const utcHours = hours.toString().padStart(2, '0');
    const utcMinutes = minutes.toString().padStart(2, '0');
    return `${utcHours}:${utcMinutes}:00`;
  }, []);

  // Convert local time to UTC time string (HH:mm:ss)
  const convertToUTCTimeString = useCallback(
    (date: Date | null): string => {
      if (!date) return '00:00:00';

      // Get the local time and convert to UTC
      const localHours = date.getHours();
      const localMinutes = date.getMinutes();

      // For UTC time, we use the same hours and minutes (no timezone conversion)
      // Since we want the exact time in UTC, not converted from local
      return createUTCTimeString(localHours, localMinutes);
    },
    [createUTCTimeString]
  );

  // Convert UTC time string (HH:mm:ss) to local Date for TimePicker
  const convertTimeStringToLocalDate = useCallback((timeString: string): Date | null => {
    if (!timeString) return new Date(); // Return current time if no time provided

    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const date = new Date();
      // Set the time in local timezone for the TimePicker
      date.setHours(hours, minutes, 0, 0);
      return date;
    } catch (error) {
      console.error('Error parsing time string:', error);
      return new Date(); // Return current time as fallback
    }
  }, []);

  // Parse time from either ISO string or time string
  const parseTimeFromBackend = useCallback(
    (timeValue: string): Date | null => {
      if (!timeValue) return convertTimeStringToLocalDate('00:00:00');

      try {
        // Check if it's an ISO string (contains 'T')
        if (timeValue.includes('T')) {
          const date = new Date(timeValue);
          const hours = date.getUTCHours();
          const minutes = date.getUTCMinutes();
          return convertTimeStringToLocalDate(createUTCTimeString(hours, minutes));
        } else {
          // It's already a time string like "03:20:00"
          return convertTimeStringToLocalDate(timeValue);
        }
      } catch (error) {
        console.error('Error parsing time from backend:', error);
        return convertTimeStringToLocalDate('00:00:00');
      }
    },
    [convertTimeStringToLocalDate, createUTCTimeString]
  );

  useEffect(() => {
    const convertTimeToStorageFormat = (date: Date | null): string => {
      if (!date) {
        return '00:00:00';
      }
      return convertToUTCTimeString(date);
    };

    const newTime = convertTimeToStorageFormat(selectedTime);
    setAutomationTime(newTime);
  }, [selectedTime, convertToUTCTimeString]);

  const fetchSettings = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const settings = await fetchReportSettings();

      console.log('settings', settings);
      if (settings?.reports) {
        const reportSettings: ReportSettings = settings.reports;

        setReportName(reportSettings.title || '');
        setReportTemplate(reportSettings.reportType || '');
        setFrequency(reportSettings.frequency || '');

        // Set automation time
        if (reportSettings.automationTime) {
          const timeValue = reportSettings.automationTime;
          setAutomationTime(timeValue);

          // Use the new parsing function
          const timeDate = parseTimeFromBackend(timeValue);
          setSelectedTime(timeDate);
        } else {
          // Set default time if none exists
          const defaultTime = convertTimeStringToLocalDate('00:00:00');
          setSelectedTime(defaultTime);
          setAutomationTime('00:00:00');
        }

        setBranding({
          logoFile: reportSettings.logo || '',
          header: reportSettings.header || '',
          footer: reportSettings.footer || '',
        });

        if (reportSettings.logo) {
          const fileName = reportSettings.logo.split('/').pop() || 'uploaded-logo';
          setLogoFileName(fileName);

          try {
            const logoUrl = await getImageDownloadUrl(reportSettings.logo);
            setLogoPreview(logoUrl);
          } catch (error) {
            console.error('Failed to load logo preview:', error);
            setLogoPreview(null);
          }
        } else {
          setLogoFileName('');
          setLogoPreview(null);
        }
      }
    } catch (error) {
      console.log('Error', error);
      setToastMessage('Failed to fetch report settings.');
      setToastSeverity('warning');
      setToastOpen(true);
    } finally {
      setLoading(false);
    }
  }, [parseTimeFromBackend, convertTimeStringToLocalDate]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (frequency && automationTime) {
      setNextTriggerDates(getNextTriggerDates(frequency, automationTime));
    }
  }, [frequency, automationTime, selectedTime]);

  const handleCancel = async (): Promise<any> => {
    await fetchSettings();
  };

  const handleCloseToast = (): void => setToastOpen(false);

  const validateLogoFile = (file: File): string | null => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const maxSize = 2 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      return 'Please select a valid image file (PNG, JPEG, JPG only)';
    }

    if (file.size > maxSize) {
      return 'File size must be less than 2 MB';
    }

    return null;
  };

  const validateReportTitle = (title: string): string | undefined => {
    if (reportTemplate !== 'pdf') {
      return undefined;
    }

    if (!title.trim()) {
      return 'Report title is required';
    }

    const titleWithoutSpaces = title.replace(/\s/g, '');
    if (titleWithoutSpaces.length > 255) {
      return 'Report title must not exceed 255 characters (excluding spaces)';
    }

    return undefined;
  };

  const validateCharacterLimit = (text: string, fieldName: string): string | undefined => {
    if (reportTemplate !== 'pdf') {
      return undefined;
    }

    const textWithoutSpaces = text.replace(/\s/g, '');
    if (textWithoutSpaces.length > 255) {
      return `${fieldName} must not exceed 255 characters (excluding spaces)`;
    }
    return undefined;
  };

  const handleReportTitleChange = (value: string): void => {
    setReportName(value);
    if (fieldTouched.reportName) {
      const error = validateReportTitle(value);
      setErrors((prev) => ({ ...prev, reportName: error }));
    }
  };

  const handleHeaderChange = (value: string): void => {
    setBranding((prev) => ({ ...prev, header: value }));
    if (fieldTouched.header && reportTemplate === 'pdf') {
      const error = validateCharacterLimit(value, 'Header');
      setErrors((prev) => ({ ...prev, header: error }));
    }
  };

  const handleFooterChange = (value: string): void => {
    setBranding((prev) => ({ ...prev, footer: value }));
    if (fieldTouched.footer && reportTemplate === 'pdf') {
      const error = validateCharacterLimit(value, 'Footer');
      setErrors((prev) => ({ ...prev, footer: error }));
    }
  };

  const handleFieldBlur = (fieldName: keyof typeof fieldTouched): void => {
    setFieldTouched((prev) => ({ ...prev, [fieldName]: true }));

    if (fieldName === 'reportName' && reportTemplate === 'pdf') {
      const error = validateReportTitle(reportName);
      setErrors((prev) => ({ ...prev, reportName: error }));
    } else if (fieldName === 'header' && reportTemplate === 'pdf') {
      const error = validateCharacterLimit(branding.header, 'Header');
      setErrors((prev) => ({ ...prev, header: error }));
    } else if (fieldName === 'footer' && reportTemplate === 'pdf') {
      const error = validateCharacterLimit(branding.footer, 'Footer');
      setErrors((prev) => ({ ...prev, footer: error }));
    }
  };

  const getCharacterCount = (text: string): number => {
    return text.replace(/\s/g, '').length;
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrors((prev) => ({ ...prev, logoFile: undefined }));

    const validationError = validateLogoFile(file);
    if (validationError) {
      setErrors((prev) => ({ ...prev, logoFile: validationError }));
      return;
    }

    setBranding({ ...branding, logoFile: file });
    setLogoFileName(file.name);

    const reader = new FileReader();
    reader.onloadend = (): void => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = (): void => {
    setBranding({ ...branding, logoFile: null });
    setLogoPreview(null);
    setLogoFileName('');
  };

  const getNextTriggerDates = (frequency: string, time: string): string[] => {
    const dates: string[] = [];
    const now = new Date();

    // Parse the time string (HH:mm:ss)
    const [hours, minutes] = time.split(':').map(Number);

    for (let i = 1; i <= 10; i++) {
      const next = new Date(now);

      if (frequency === 'daily') {
        next.setUTCDate(now.getUTCDate() + i);
      } else if (frequency === 'weekly') {
        next.setUTCDate(now.getUTCDate() + 7 * i);
      } else if (frequency === 'monthly') {
        next.setUTCMonth(now.getUTCMonth() + i);
      }

      // Set the time from the time string (UTC)
      next.setUTCHours(hours, minutes, 0, 0);
      dates.push(next.toUTCString().replace('GMT', 'UTC'));
    }

    return dates;
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setFrequency(value);
    if (automationTime) {
      setNextTriggerDates(getNextTriggerDates(value, automationTime));
    }
  };

  const handleTimeChange = (newValue: Date | null): void => {
    setSelectedTime(newValue);
  };

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = (): void => {
    setAnchorEl(null);
  };

  const handleSubmit = async (): Promise<void> => {
    setFieldTouched({
      reportName: true,
      header: true,
      footer: true,
    });

    const reportNameError = reportTemplate === 'pdf' ? validateReportTitle(reportName) : undefined;
    const headerError = reportTemplate === 'pdf' ? validateCharacterLimit(branding.header, 'Header') : undefined;
    const footerError = reportTemplate === 'pdf' ? validateCharacterLimit(branding.footer, 'Footer') : undefined;

    const newErrors = {
      reportName: reportNameError,
      header: headerError,
      footer: footerError,
    };

    setErrors(newErrors);

    const hasErrors = Object.values(newErrors).some((error) => error !== undefined);

    if (hasErrors) {
      setToastMessage('Please fix validation errors before saving.');
      setToastSeverity('warning');
      setToastOpen(true);
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveReportSettings({
        title: reportName,
        fileFormat: reportTemplate as 'pdf' | 'csv',
        frequency: frequency as 'daily' | 'weekly' | 'monthly',
        automationTime: automationTime, // This will now be just "HH:mm:ss"
        header: branding.header,
        footer: branding.footer,
        logo: branding.logoFile,
      });

      setToastSeverity('success');
      setToastMessage(result?.message || 'Automate report saved.');
      setToastOpen(true);
    } catch (error: any) {
      console.log('Err: ', error?.response.data);
      setToastMessage(error?.response.data.errors[0].title || 'Error saving report.');
      setToastSeverity('warning');
      setToastOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  const open = Boolean(anchorEl);

  // Format UTC time for display
  const formatUTCTimeForDisplay = (date: Date | null): string => {
    if (!date) return '00:00:00 UTC';

    // Convert to UTC time string
    const timeString = convertToUTCTimeString(date);
    return `${timeString} UTC`;
  };

  return (
    <>
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h4" color="primary.dark">
            Automate Reports
          </Typography>

          {/* ... (rest of your JSX remains exactly the same) */}
          <FormControl error={!!errors.reportTemplate}>
            <Typography variant="h6" gutterBottom>
              Report Template
            </Typography>
            <RadioGroup row value={reportTemplate} onChange={(e) => setReportTemplate(e.target.value)}>
              <FormControlLabel value="pdf" control={<Radio />} label="PDF" />
              <FormControlLabel value="csv" control={<Radio />} label="CSV" />
            </RadioGroup>
            {errors.reportTemplate && <FormHelperText>{errors.reportTemplate}</FormHelperText>}
          </FormControl>

          <FormControl error={!!errors.frequency}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" gutterBottom>
                Automation Frequency
              </Typography>
              <IconButton
                size="small"
                onMouseEnter={handlePopoverOpen}
                onMouseLeave={handlePopoverClose}
                sx={{ color: 'primary.main' }}
              >
                <VisibilityIcon />
              </IconButton>
            </Box>
            <RadioGroup row value={frequency} onChange={handleFrequencyChange}>
              <FormControlLabel value="daily" control={<Radio />} label="Daily" />
              <FormControlLabel value="weekly" control={<Radio />} label="Weekly" />
              <FormControlLabel value="monthly" control={<Radio />} label="Monthly" />
            </RadioGroup>
            {errors.frequency && <FormHelperText>{errors.frequency}</FormHelperText>}
          </FormControl>

          <Popover
            id="mouse-over-popover"
            sx={{
              pointerEvents: 'none',
            }}
            open={open}
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
            onClose={handlePopoverClose}
            disableRestoreFocus
          >
            <Box sx={{ p: 2, maxWidth: 400 }}>
              <Typography variant="subtitle1" gutterBottom>
                Next 10 Trigger Dates
              </Typography>
              {nextTriggerDates.length > 0 ? (
                nextTriggerDates.map((date, index) => (
                  <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                    {new Date(date).toUTCString().replace('GMT', 'UTC')}
                  </Typography>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Select frequency and time to see trigger dates
                </Typography>
              )}
            </Box>
          </Popover>

          <Box>
            <Typography variant="h6" gutterBottom>
              Automation Time (UTC)
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TimePicker
                label="Select Time (Your Local Time)"
                value={selectedTime}
                onChange={handleTimeChange}
                ampm={false} // Use 24-hour format
                views={['hours', 'minutes']} // Only show hours and minutes
                format="HH:mm" // 24-hour format
                slotProps={{
                  textField: {
                    sx: { minWidth: 180 },
                  },
                }}
              />

              <Typography variant="body2" color="text.secondary">
                It Will run at: {formatUTCTimeForDisplay(selectedTime)}
              </Typography>
            </Box>
            {errors.automationTime && <FormHelperText error>{errors.automationTime}</FormHelperText>}
          </Box>

          {/* ... (rest of your JSX remains exactly the same) */}
          {reportTemplate === 'pdf' && (
            <>
              <Typography variant="h4" color="primary.dark">
                Branding Details
              </Typography>

              <TextField
                label="Report Name / Title"
                required
                value={reportName}
                onChange={(e) => handleReportTitleChange(e.target.value)}
                onBlur={() => handleFieldBlur('reportName')}
                fullWidth
                error={!!errors.reportName}
                helperText={errors.reportName || `${getCharacterCount(reportName)}/255 characters (excluding spaces)`}
                sx={{
                  '& .MuiFormLabel-asterisk': {
                    color: 'red',
                  },
                }}
              />

              <Box>
                <Typography variant="h6" gutterBottom>
                  Logo (Max 2MB)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpg,image/jpeg"
                    onChange={handleLogoUpload}
                    id="logo-upload"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="logo-upload">
                    <RoundedButton variant="outlined" component="span">
                      Choose Logo
                    </RoundedButton>
                  </label>

                  {logoFileName && (
                    <Typography variant="body2" color="text.secondary">
                      {logoFileName}
                    </Typography>
                  )}
                </Box>

                {errors.logoFile && <FormHelperText error>{errors.logoFile}</FormHelperText>}

                {logoPreview && (
                  <Box
                    sx={{
                      mt: 2,
                      display: 'inline-flex',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      style={{
                        maxWidth: '100px',
                        maxHeight: '50px',
                        objectFit: 'contain',
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={handleRemoveLogo}
                      color="error"
                      title="Remove logo"
                      sx={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        '&:hover': {
                          backgroundColor: 'error.main',
                          color: 'white',
                        },
                        width: 20,
                        height: 20,
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField
                  label="Header Text"
                  value={branding.header}
                  onChange={(e) => handleHeaderChange(e.target.value)}
                  onBlur={() => handleFieldBlur('header')}
                  fullWidth
                  error={!!errors.header}
                  helperText={
                    errors.header || `${getCharacterCount(branding.header)}/255 characters (excluding spaces)`
                  }
                />

                <TextField
                  label="Footer Text"
                  value={branding.footer}
                  onChange={(e) => handleFooterChange(e.target.value)}
                  onBlur={() => handleFieldBlur('footer')}
                  fullWidth
                  error={!!errors.footer}
                  helperText={
                    errors.footer || `${getCharacterCount(branding.footer)}/255 characters (excluding spaces)`
                  }
                />
              </Box>
            </>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'end', gap: 1, mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={isSaving}
              startIcon={isSaving ? <CircularProgress size={16} /> : null}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button onClick={handleCancel} variant="outlined" disabled={loading}>
              Reset
            </Button>
          </Box>

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
        </Box>
      )}
    </>
  );
};
