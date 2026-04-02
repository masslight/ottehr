import { Save } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { getVisitFeedbackConfig, saveVisitFeedbackConfig } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';

const MAX_SMS_LENGTH = 160;

const DELAY_OPTIONS = [
  { value: 1, label: '1 hour' },
  { value: 2, label: '2 hours' },
  { value: 4, label: '4 hours' },
  { value: 8, label: '8 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
  { value: 72, label: '72 hours' },
];

export const VisitFeedbackSettings: React.FC = () => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState('');
  const [delayHours, setDelayHours] = useState(24);

  // Track initial values for dirty detection
  const [initialValues, setInitialValues] = useState({ enabled: false, messageTemplate: '', delayHours: 24 });

  const isDirty =
    enabled !== initialValues.enabled ||
    messageTemplate !== initialValues.messageTemplate ||
    delayHours !== initialValues.delayHours;

  const remainingChars = MAX_SMS_LENGTH - messageTemplate.length;
  const isOverLimit = remainingChars < 0;

  useEffect(() => {
    const loadConfig = async (): Promise<void> => {
      if (!oystehrZambda) return;
      try {
        const config = await getVisitFeedbackConfig(oystehrZambda);
        setEnabled(config.enabled);
        setMessageTemplate(config.messageTemplate);
        setDelayHours(config.delayHours);
        setInitialValues({
          enabled: config.enabled,
          messageTemplate: config.messageTemplate,
          delayHours: config.delayHours,
        });
      } catch (error) {
        console.error('Failed to load visit feedback config:', error);
      } finally {
        setLoading(false);
      }
    };
    void loadConfig();
  }, [oystehrZambda]);

  const handleSave = async (): Promise<void> => {
    if (!oystehrZambda) return;
    setSaving(true);
    try {
      await saveVisitFeedbackConfig(oystehrZambda, {
        enabled,
        messageTemplate,
        delayHours,
      });
      setInitialValues({ enabled, messageTemplate, delayHours });
      enqueueSnackbar('Visit feedback settings saved', { variant: 'success' });
    } catch (error) {
      console.error('Failed to save visit feedback config:', error);
      enqueueSnackbar('Failed to save settings. Please try again.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2, maxWidth: 700 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" color="primary.dark" sx={{ mb: 1 }}>
          Visit Feedback
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Automatically text patients after their visit to solicit feedback.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label={
              <Box>
                <Typography fontWeight={500}>Enable visit feedback</Typography>
                <Typography variant="body2" color="text.secondary">
                  When enabled, patients will receive an SMS after their visit
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', ml: 0 }}
          />

          <Box>
            <Typography fontWeight={500} sx={{ mb: 1 }}>
              Send after
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              How long after a visit is completed before the feedback text is sent
            </Typography>
            <Select
              value={delayHours}
              onChange={(e) => setDelayHours(e.target.value as number)}
              size="small"
              disabled={!enabled}
              sx={{ minWidth: 200 }}
            >
              {DELAY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box>
            <Typography fontWeight={500} sx={{ mb: 1 }}>
              Message template
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              This message will be sent via SMS to the patient. Keep it within {MAX_SMS_LENGTH} characters to avoid
              splitting across multiple texts.
            </Typography>
            <TextField
              multiline
              minRows={3}
              maxRows={5}
              fullWidth
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              placeholder="e.g., Thank you for visiting us! We'd love to hear about your experience. Please reply with your feedback."
              error={isOverLimit}
              helperText={
                isOverLimit
                  ? `Message is ${Math.abs(remainingChars)} characters over the ${MAX_SMS_LENGTH} character limit`
                  : undefined
              }
              disabled={!enabled}
              InputProps={{
                sx: { fontSize: '14px' },
              }}
            />
            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                textAlign: 'right',
                color: isOverLimit
                  ? theme.palette.error.main
                  : remainingChars <= 20
                  ? theme.palette.warning.main
                  : theme.palette.text.secondary,
                fontWeight: remainingChars <= 20 ? 600 : 400,
              }}
            >
              {remainingChars} characters remaining
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <LoadingButton
              variant="contained"
              loading={saving}
              disabled={!isDirty || isOverLimit}
              onClick={handleSave}
              startIcon={<Save />}
              sx={{ textTransform: 'none', borderRadius: 25 }}
            >
              Save Changes
            </LoadingButton>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
