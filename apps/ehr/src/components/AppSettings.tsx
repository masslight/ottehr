import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormHelperText,
  IconButton,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { fetchAppSettings, saveAppSettings } from '../../../../packages/zambdas/src/services/appSettings';
import { RoundedButton } from './RoundedButton';

interface AppSettingsData {
  appName: string;
  logoFile: File | null | undefined;
  patientLogoFile: File | null | undefined;
  roundedLogoFile: File | null | undefined;
}

export const AppSettings = (): JSX.Element => {
  const [appSettings, setAppSettings] = useState<AppSettingsData>({
    appName: '',
    logoFile: null,
    patientLogoFile: null,
    roundedLogoFile: null,
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [patientLogoPreview, setPatientLogoPreview] = useState<string | null>(null);
  const [patientLogoFileName, setPatientLogoFileName] = useState<string>('');
  const [roundedLogoPreview, setRoundedLogoPreview] = useState<string | null>(null);
  const [roundedLogoFileName, setRoundedLogoFileName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    appName?: string;
    logoFile?: string;
    patientLogoFile?: string;
    roundedLogoFile?: string;
  }>({});
  const [toastOpen, setToastOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastSeverity, setToastSeverity] = useState<'success' | 'warning'>('warning');
  const [fieldTouched, setFieldTouched] = useState<{
    appName: boolean;
  }>({
    appName: false,
  });

  const loadAppSettings = async (): Promise<void> => {
    setLoading(true);
    try {
      const settings: any = await fetchAppSettings();
      console.log('App settings:', settings);
      if (settings?.appSettings) {
        const appSettings: any = settings.appSettings;
        setAppSettings({
          appName: appSettings.appName || '',
          logoFile: appSettings.logo || null,
          patientLogoFile: appSettings.patientLogo || null,
          roundedLogoFile: appSettings.roundedLogo || null,
        });
        if (appSettings.logo) {
          const fileName = appSettings.logo || 'uploaded-logo';
          setLogoFileName(fileName);
          setLogoPreview(appSettings.logo);
        } else {
          setLogoFileName('');
          setLogoPreview(null);
        }

        if (appSettings.patientLogo) {
          const fileName = appSettings.patientLogo;
          setPatientLogoFileName(fileName);
          setPatientLogoPreview(appSettings.patientLogo);
        } else {
          setPatientLogoFileName('');
          setPatientLogoPreview(null);
        }

        if (appSettings.roundLogo) {
          const fileName = appSettings.roundLogo;
          setRoundedLogoFileName(fileName);
          setRoundedLogoPreview(appSettings.roundLogo);
        } else {
          setRoundedLogoFileName('');
          setRoundedLogoPreview(null);
        }
      }
    } catch (error) {
      console.log('Error', error);
      setToastMessage('Failed to fetch app settings.');
      setToastSeverity('warning');
      setToastOpen(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAppSettings();
  }, []);

  const handleCancel = async (): Promise<any> => {
    await loadAppSettings();
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

  const validateAppName = (name: string): string | undefined => {
    if (!name.trim()) {
      return 'App name is required';
    }

    const nameWithoutSpaces = name.replace(/\s/g, '');
    if (nameWithoutSpaces.length > 255) {
      return 'App name must not exceed 255 characters (excluding spaces)';
    }

    return undefined;
  };

  const getCharacterCount = (text: string): number => {
    return text.replace(/\s/g, '').length;
  };

  const handleAppNameChange = (value: string): void => {
    setAppSettings((prev) => ({ ...prev, appName: value }));
    if (fieldTouched.appName) {
      const error = validateAppName(value);
      setErrors((prev) => ({ ...prev, appName: error }));
    }
  };

  const handleFieldBlur = (fieldName: keyof typeof fieldTouched): void => {
    setFieldTouched((prev) => ({ ...prev, [fieldName]: true }));

    if (fieldName === 'appName') {
      const error = validateAppName(appSettings.appName);
      setErrors((prev) => ({ ...prev, appName: error }));
    }
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

    setAppSettings((prev) => ({ ...prev, logoFile: file }));
    setLogoFileName(file.name);

    const reader = new FileReader();
    reader.onloadend = (): void => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePatientLogoUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrors((prev) => ({ ...prev, patientLogoFile: undefined }));

    const validationError = validateLogoFile(file);
    if (validationError) {
      setErrors((prev) => ({ ...prev, patientLogoFile: validationError }));
      return;
    }

    setAppSettings((prev) => ({ ...prev, patientLogoFile: file }));
    setPatientLogoFileName(file.name);

    const reader = new FileReader();
    reader.onloadend = (): void => setPatientLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRoundedLogoUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrors((prev) => ({ ...prev, roundedLogoFile: undefined }));

    const validationError = validateLogoFile(file);
    if (validationError) {
      setErrors((prev) => ({ ...prev, roundedLogoFile: validationError }));
      return;
    }

    setAppSettings((prev) => ({ ...prev, roundedLogoFile: file }));
    setRoundedLogoFileName(file.name);

    const reader = new FileReader();
    reader.onloadend = (): void => setRoundedLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = (): void => {
    setAppSettings((prev) => ({ ...prev, logoFile: null }));
    setLogoPreview(null);
    setLogoFileName('');
  };

  const handleRemovePatientLogo = (): void => {
    setAppSettings((prev) => ({ ...prev, patientLogoFile: null }));
    setPatientLogoPreview(null);
    setPatientLogoFileName('');
  };

  const handleRemoveRoundedLogo = (): void => {
    setAppSettings((prev) => ({ ...prev, roundedLogoFile: null }));
    setRoundedLogoPreview(null);
    setRoundedLogoFileName('');
  };

  const handleSubmit = async (): Promise<void> => {
    setFieldTouched({
      appName: true,
    });

    const appNameError = validateAppName(appSettings.appName);
    const newErrors = {
      appName: appNameError,
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
      const result = await saveAppSettings({
        appName: appSettings.appName,
        logo: appSettings.logoFile,
        patientLogo: appSettings.patientLogoFile,
        roundedLogo: appSettings.roundedLogoFile,
      });

      setToastSeverity('success');
      setToastMessage(result?.message || 'App settings success.');
      setToastOpen(true);
    } catch (error: any) {
      console.log('Err: ', error);
      setToastMessage(error?.response?.data?.errors?.[0]?.title || 'Error saving app settings.');
      setToastSeverity('warning');
      setToastOpen(true);
    } finally {
      setIsSaving(false);
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
            App Settings
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'column' } }}>
            <TextField
              label="App Name"
              required
              value={appSettings.appName}
              onChange={(e) => handleAppNameChange(e.target.value)}
              onBlur={() => handleFieldBlur('appName')}
              fullWidth
              error={!!errors.appName}
              helperText={
                errors.appName || `${getCharacterCount(appSettings.appName)}/255 characters (excluding spaces)`
              }
              sx={{
                '& .MuiFormLabel-asterisk': {
                  color: 'red',
                },
              }}
            />

            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                Dark Logo (Max 2MB)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpg,image/jpeg"
                  onChange={handleLogoUpload}
                  id="app-logo-upload"
                  style={{ display: 'none' }}
                />
                <label htmlFor="app-logo-upload">
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
                    alt="App logo preview"
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

            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                White Logo (Max 2MB)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpg,image/jpeg"
                  onChange={handlePatientLogoUpload}
                  id="patient-logo-upload"
                  style={{ display: 'none' }}
                />
                <label htmlFor="patient-logo-upload">
                  <RoundedButton variant="outlined" component="span">
                    Choose Patient Logo
                  </RoundedButton>
                </label>

                {patientLogoFileName && (
                  <Typography variant="body2" color="text.secondary">
                    {patientLogoFileName}
                  </Typography>
                )}
              </Box>

              {errors.patientLogoFile && <FormHelperText error>{errors.patientLogoFile}</FormHelperText>}

              {patientLogoPreview && (
                <Box
                  sx={{
                    mt: 2,
                    display: 'inline-flex',
                    position: 'relative',
                  }}
                >
                  <img
                    src={patientLogoPreview}
                    alt="Patient logo preview"
                    style={{
                      maxWidth: '100px',
                      maxHeight: '50px',
                      objectFit: 'contain',
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={handleRemovePatientLogo}
                    color="error"
                    title="Remove patient logo"
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

            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                Rounded Logo (Max 2MB)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpg,image/jpeg"
                  onChange={handleRoundedLogoUpload}
                  id="rounded-logo-upload"
                  style={{ display: 'none' }}
                />
                <label htmlFor="rounded-logo-upload">
                  <RoundedButton variant="outlined" component="span">
                    Choose Rounded Logo
                  </RoundedButton>
                </label>

                {roundedLogoFileName && (
                  <Typography variant="body2" color="text.secondary">
                    {roundedLogoFileName}
                  </Typography>
                )}
              </Box>

              {errors.roundedLogoFile && <FormHelperText error>{errors.roundedLogoFile}</FormHelperText>}

              {roundedLogoPreview && (
                <Box
                  sx={{
                    mt: 2,
                    display: 'inline-flex',
                    position: 'relative',
                  }}
                >
                  <img
                    src={roundedLogoPreview}
                    alt="Rounded logo preview"
                    style={{
                      maxWidth: '100px',
                      maxHeight: '50px',
                      objectFit: 'contain',
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={handleRemoveRoundedLogo}
                    color="error"
                    title="Remove rounded logo"
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
          </Box>

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
