import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  Radio,
  RadioGroup,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchReportSettings,
  getReportDownloadUrl,
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
  logo?: any;
  header: string;
  footer: string;
}

export const AutomateReport = (): JSX.Element => {
  const [reportName, setReportName] = useState<string>('');
  const [reportTemplate, setReportTemplate] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [branding, setBranding] = useState<BrandingData>({
    logoFile: null,
    header: '',
    footer: '',
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [_existingLogoPath, setExistingLogoPath] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [errors, setErrors] = useState<{
    reportName?: string;
    reportTemplate?: string;
    frequency?: string;
    header?: string;
    footer?: string;
    logoFile?: string;
  }>({});
  const [toastOpen, setToastOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastSeverity, setToastSeverity] = useState<'success' | 'warning'>('warning');
  const navigate = useNavigate();

  const fetchSettings = async (): Promise<void> => {
    setLoading(true);
    try {
      const settings = await fetchReportSettings();

      console.log('settings', settings);
      if (settings?.reports) {
        const reportSettings: ReportSettings = settings.reports;

        setReportName(reportSettings.title || '');
        setReportTemplate(reportSettings.reportType || '');
        setFrequency(reportSettings.frequency || '');

        setBranding({
          logoFile: reportSettings.logo || '',
          header: reportSettings.header || '',
          footer: reportSettings.footer || '',
        });

        if (reportSettings.logo) {
          setExistingLogoPath(reportSettings.logo);
          const fileName = reportSettings.logo.split('/').pop() || 'uploaded-logo';
          setLogoFileName(fileName);

          try {
            const logoUrl = await getReportDownloadUrl(reportSettings.logo);
            setLogoPreview(logoUrl);
          } catch (error) {
            console.error('Failed to load logo preview:', error);
            setLogoPreview(null);
          }
        } else {
          setExistingLogoPath(null);
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
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

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
    setExistingLogoPath(null);

    const reader = new FileReader();
    reader.onloadend = (): void => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = (): void => {
    setBranding({ ...branding, logoFile: null });
    setLogoPreview(null);
    setLogoFileName('');
    setExistingLogoPath(null);
  };

  const handleSubmit = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await saveReportSettings({
        title: reportName,
        fileFormat: reportTemplate as 'pdf' | 'csv',
        frequency: frequency as 'daily' | 'weekly' | 'monthly',
        header: branding.header,
        footer: branding.footer,
        logo: branding.logoFile,
      });

      setToastSeverity('success');
      setToastMessage(result?.message || 'Automate report saved.');
      setToastOpen(true);
      void fetchSettings();
    } catch (error) {
      setToastMessage('Error saving report.');
      setToastSeverity('warning');
      setToastOpen(true);
    } finally {
      setLoading(false);
    }
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
            <Typography variant="h6" gutterBottom>
              Automation Frequency
            </Typography>
            <RadioGroup row value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <FormControlLabel value="daily" control={<Radio />} label="Daily" />
              <FormControlLabel value="weekly" control={<Radio />} label="Weekly" />
              <FormControlLabel value="monthly" control={<Radio />} label="Monthly" />
            </RadioGroup>
            {errors.frequency && <FormHelperText>{errors.frequency}</FormHelperText>}
          </FormControl>

          {reportTemplate === 'pdf' && (
            <>
              <Typography variant="h4" color="primary.dark">
                Branding Details
              </Typography>

              <TextField
                label="Report Name / Title"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                fullWidth
                error={!!errors.reportName}
                helperText={errors.reportName}
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
                  onChange={(e) => setBranding({ ...branding, header: e.target.value })}
                  fullWidth
                  error={!!errors.header}
                  helperText={errors.header}
                />
                <TextField
                  label="Footer Text"
                  value={branding.footer}
                  onChange={(e) => setBranding({ ...branding, footer: e.target.value })}
                  fullWidth
                  error={!!errors.footer}
                  helperText={errors.footer}
                />
              </Box>
            </>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'end', gap: 1, mt: 2 }}>
            <RoundedButton variant="contained" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </RoundedButton>
            <RoundedButton onClick={() => navigate(-1)} variant="outlined" disabled={loading}>
              Cancel
            </RoundedButton>
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
