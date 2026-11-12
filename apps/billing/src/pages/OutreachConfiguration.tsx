import { Add as AddIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FocusEvent, ReactElement, useEffect, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  ACTION_TYPE_LABELS,
  ALLOWED_ACTIONS,
  buildDefaultConfig,
  DEFAULT_EMAIL_TEMPLATE,
  DEFAULT_SMS_TEMPLATE,
  MEDIUM_LABELS,
  OUTREACH_TIMEZONE_OPTIONS,
  STATEMENT_TYPE_LABELS,
  TRIGGER_EVENT_LABELS,
} from 'utils/lib/helpers/rcm/scheduled-outreach-config';
import { FEATURE_FLAGS_CONFIG } from 'utils/lib/ottehr-config/feature-flags';
import { otherColors } from 'utils/lib/theme/billing-palette';
import {
  ActionType,
  ChargeCardConfig,
  INVOICE_OUTREACH_TRIGGER_EVENTS,
  NotificationMedium,
  NotificationsTimeRestriction,
  OutreachAction,
  OutreachConfigResponse,
  OutreachStatementType,
  SendNotificationConfig,
  TriggerEvent,
} from 'utils/lib/types/api/scheduled-outreach.types';
import { getOutreachConfig, saveOutreachConfig } from '../api/api';
import { InvoiceTemplateField } from '../components/InvoiceTemplateField';
import { useApiClients } from '../hooks/useAppClients';

interface OutreachSettings {
  actions: OutreachAction[];
  notificationsTimeRestriction: NotificationsTimeRestriction;
}

const MEDIUMS = Object.keys(MEDIUM_LABELS) as NotificationMedium[];
const STATEMENT_TYPES = Object.keys(STATEMENT_TYPE_LABELS) as OutreachStatementType[];
// The clinical outreach delivery resolves this placeholder in addition to the invoice ones.
const OUTREACH_EXTRA_SAMPLE_VALUES = { 'location-review-link': 'https://g.page/r/example-clinic/review' };
const noop = (): void => undefined;

// Sorted on load and save only, so an action does not move while its day count is typed.
const toSettings = ({ actions, notificationsTimeRestriction }: OutreachConfigResponse): OutreachSettings => ({
  actions: [...actions].sort((a, b) => a.trigger.daysAfter - b.trigger.daysAfter),
  notificationsTimeRestriction,
});

// The fields clamp to a minimum, so typing must replace the value rather than add a digit to it.
const selectAllOnFocus = (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>): void => event.target.select();

function notificationErrors(
  config: SendNotificationConfig,
  requireMedium: boolean
): { mediums: boolean; sms: boolean; email: boolean } {
  return {
    mediums: requireMedium && config.mediums.length === 0,
    sms: config.mediums.includes('sms') && !config.smsTemplate.trim(),
    email: config.mediums.includes('email') && !config.emailTemplate.trim(),
  };
}

function actionHasProblem(action: OutreachAction): boolean {
  const configs: [SendNotificationConfig, boolean][] = [];
  if (action.actionType === 'send-notification' && action.sendNotificationConfig) {
    configs.push([action.sendNotificationConfig, true]);
  }
  if (action.actionType === 'charge-card' && action.chargeCardConfig) {
    const { onSuccess, onFailure } = action.chargeCardConfig;
    if (onSuccess.enabled) configs.push([onSuccess, false]);
    if (onFailure.enabled) configs.push([onFailure, false]);
  }
  return configs.some(([config, requireMedium]) =>
    Object.values(notificationErrors(config, requireMedium)).some(Boolean)
  );
}

const toWholeNumber = (value: string, min: number, max: number): number =>
  Math.min(max, Math.max(min, parseInt(value, 10) || min));

function NotificationEditor<T extends SendNotificationConfig>({
  config,
  onChange,
  requireMedium,
  showErrors,
  disabled,
}: {
  config: T;
  onChange: (config: T) => void;
  requireMedium: boolean;
  showErrors: boolean;
  disabled: boolean;
}): ReactElement {
  const errors = notificationErrors(config, requireMedium);
  const toggleMedium = (medium: NotificationMedium, checked: boolean): void => {
    const updated = {
      ...config,
      mediums: checked ? [...config.mediums, medium] : config.mediums.filter((m) => m !== medium),
    };
    if (checked && medium === 'sms' && !updated.smsTemplate) updated.smsTemplate = DEFAULT_SMS_TEMPLATE;
    if (checked && medium === 'email' && !updated.emailTemplate) updated.emailTemplate = DEFAULT_EMAIL_TEMPLATE;
    if (checked && medium === 'paper-mail' && !updated.statementType) updated.statementType = 'standard';
    onChange(updated);
  };
  return (
    <Stack spacing={2}>
      <Box>
        <FormGroup row>
          {MEDIUMS.map((medium) => (
            <FormControlLabel
              key={medium}
              label={MEDIUM_LABELS[medium]}
              control={
                <Checkbox
                  size="small"
                  checked={config.mediums.includes(medium)}
                  onChange={(event) => toggleMedium(medium, event.target.checked)}
                  disabled={
                    disabled ||
                    // A saved paper mail channel can still be removed.
                    (medium === 'paper-mail' &&
                      !FEATURE_FLAGS_CONFIG.mailingPaperStatementsEnabled &&
                      !config.mediums.includes(medium))
                  }
                />
              }
            />
          ))}
        </FormGroup>
        {showErrors && errors.mediums && (
          <FormHelperText error>Choose at least one notification channel</FormHelperText>
        )}
      </Box>
      {config.mediums.includes('sms') && (
        <InvoiceTemplateField
          label="SMS Template"
          value={config.smsTemplate}
          onChange={(smsTemplate) => onChange({ ...config, smsTemplate })}
          onBlur={noop}
          inputRef={noop}
          error={showErrors && errors.sms}
          disabled={disabled}
          isSms
          extraSampleValues={OUTREACH_EXTRA_SAMPLE_VALUES}
        />
      )}
      {config.mediums.includes('email') && (
        <InvoiceTemplateField
          label="Email Template"
          value={config.emailTemplate}
          onChange={(emailTemplate) => onChange({ ...config, emailTemplate })}
          onBlur={noop}
          inputRef={noop}
          error={showErrors && errors.email}
          disabled={disabled}
          extraSampleValues={OUTREACH_EXTRA_SAMPLE_VALUES}
        />
      )}
      {config.mediums.includes('paper-mail') && (
        <TextField
          select
          label="Statement Type"
          size="small"
          value={config.statementType || 'standard'}
          onChange={(event) => onChange({ ...config, statementType: event.target.value as OutreachStatementType })}
          disabled={disabled}
          sx={{ width: 250 }}
          InputLabelProps={{ shrink: true }}
        >
          {STATEMENT_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {STATEMENT_TYPE_LABELS[type]}
            </MenuItem>
          ))}
        </TextField>
      )}
    </Stack>
  );
}

function ChargeCardEditor({
  config,
  onChange,
  showErrors,
  disabled,
}: {
  config: ChargeCardConfig;
  onChange: (config: ChargeCardConfig) => void;
  showErrors: boolean;
  disabled: boolean;
}): ReactElement {
  const outcomes = [
    ['onSuccess', 'Notify on Successful Charge'],
    ['onFailure', 'Notify on Failed Charge'],
  ] as const;
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="body2">Retry</Typography>
        <TextField
          type="number"
          size="small"
          value={config.retryAttempts}
          onFocus={selectAllOnFocus}
          onChange={(event) => {
            const retryAttempts = toWholeNumber(event.target.value, 0, 10);
            // The save validator rejects retries without an interval of at least one day.
            const retryIntervalDays =
              retryAttempts > 0 ? Math.max(1, config.retryIntervalDays) : config.retryIntervalDays;
            onChange({ ...config, retryAttempts, retryIntervalDays });
          }}
          sx={{ width: 80 }}
          inputProps={{ min: 0, max: 10, step: 1, 'aria-label': 'Retry attempts' }}
        />
        <Typography variant="body2">time(s) every</Typography>
        <TextField
          type="number"
          size="small"
          value={config.retryIntervalDays}
          onFocus={selectAllOnFocus}
          onChange={(event) => onChange({ ...config, retryIntervalDays: toWholeNumber(event.target.value, 1, 90) })}
          disabled={disabled || config.retryAttempts === 0}
          sx={{ width: 80 }}
          inputProps={{ min: 1, max: 90, step: 1, 'aria-label': 'Retry interval days' }}
        />
        <Typography variant="body2">day(s)</Typography>
      </Stack>
      {outcomes.map(([key, label]) => (
        <Box key={key}>
          <FormControlLabel
            label={label}
            control={
              <Checkbox
                size="small"
                checked={config[key].enabled}
                onChange={(event) => onChange({ ...config, [key]: { ...config[key], enabled: event.target.checked } })}
              />
            }
          />
          {config[key].enabled && (
            <Box role="group" aria-label={label} sx={{ ml: 4, mt: 1 }}>
              <NotificationEditor
                config={config[key]}
                onChange={(notification) => onChange({ ...config, [key]: notification })}
                requireMedium={false}
                showErrors={showErrors}
                disabled={disabled}
              />
            </Box>
          )}
        </Box>
      ))}
    </Stack>
  );
}

function ActionEditor({
  action,
  onChange,
  onDelete,
  showErrors,
  disabled,
}: {
  action: OutreachAction;
  onChange: (action: OutreachAction) => void;
  onDelete: () => void;
  showErrors: boolean;
  disabled: boolean;
}): ReactElement {
  return (
    <Stack
      role="group"
      aria-label={`${ACTION_TYPE_LABELS[action.actionType]} action`}
      spacing={2}
      sx={{ border: `1px solid ${otherColors.lightDivider}`, borderRadius: 1, p: 2 }}
    >
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <FormControlLabel
          label="Enabled"
          control={
            <Switch
              checked={action.enabled !== false}
              onChange={(event) => onChange({ ...action, enabled: event.target.checked })}
            />
          }
        />
        <TextField
          select
          label="Trigger Event"
          size="small"
          value={action.trigger.event}
          onChange={(event) =>
            onChange({ ...action, trigger: { ...action.trigger, event: event.target.value as TriggerEvent } })
          }
          disabled={disabled}
          sx={{ width: 200 }}
          InputLabelProps={{ shrink: true }}
        >
          {INVOICE_OUTREACH_TRIGGER_EVENTS.map((event) => (
            <MenuItem key={event} value={event}>
              {TRIGGER_EVENT_LABELS[event]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="number"
          label="Days After Event"
          size="small"
          value={action.trigger.daysAfter}
          onFocus={selectAllOnFocus}
          onChange={(event) =>
            onChange({
              ...action,
              trigger: { ...action.trigger, daysAfter: toWholeNumber(event.target.value, 0, Number.MAX_SAFE_INTEGER) },
            })
          }
          sx={{ width: 150 }}
          inputProps={{ min: 0, step: 1 }}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          select
          label="Action Type"
          size="small"
          value={action.actionType}
          onChange={(event) => {
            const actionType = event.target.value as ActionType;
            onChange({
              ...action,
              actionType,
              chargeCardConfig: undefined,
              sendNotificationConfig: undefined,
              referToCollectionsConfig: undefined,
              ...buildDefaultConfig(actionType),
            });
          }}
          disabled={disabled}
          sx={{ width: 240 }}
          InputLabelProps={{ shrink: true }}
        >
          {ALLOWED_ACTIONS[action.trigger.event].map((type) => (
            <MenuItem key={type} value={type}>
              {ACTION_TYPE_LABELS[type]}
            </MenuItem>
          ))}
        </TextField>
        <IconButton aria-label="Delete action" onClick={onDelete} disabled={disabled} sx={{ ml: 'auto' }}>
          <DeleteIcon />
        </IconButton>
      </Stack>
      {action.actionType === 'send-notification' && action.sendNotificationConfig && (
        <NotificationEditor
          config={action.sendNotificationConfig}
          onChange={(sendNotificationConfig) => onChange({ ...action, sendNotificationConfig })}
          requireMedium
          showErrors={showErrors}
          disabled={disabled}
        />
      )}
      {action.actionType === 'charge-card' && action.chargeCardConfig && (
        <ChargeCardEditor
          config={action.chargeCardConfig}
          onChange={(chargeCardConfig) => onChange({ ...action, chargeCardConfig })}
          showErrors={showErrors}
          disabled={disabled}
        />
      )}
      {action.actionType === 'refer-to-collections' && (
        <Alert severity="warning">Automated referral to collections action is not yet available.</Alert>
      )}
      {action.actionType === 'log' && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          This action will log that it was executed. No additional configuration is needed.
        </Typography>
      )}
    </Stack>
  );
}

export default function OutreachConfiguration(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [saved, setSaved] = useState<OutreachSettings | null>(null);
  const [edited, setEdited] = useState<OutreachSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const isLoaded = saved !== null;

  useEffect(() => {
    if (!oystehrZambda || isLoaded) return;
    let active = true;
    setLoadError(null);
    void getOutreachConfig(oystehrZambda)
      .then((response) => {
        if (!active) return;
        setSaved(toSettings(response));
        setEdited(toSettings(response));
      })
      .catch((error) => {
        if (active) setLoadError(getApiError({ error, defaultError: 'Failed to load outreach settings' }));
      });
    return () => {
      active = false;
    };
  }, [oystehrZambda, isLoaded, loadAttempt]);

  const dirty = JSON.stringify(saved) !== JSON.stringify(edited);
  const updateAction = (action: OutreachAction): void =>
    setEdited(
      (current) => current && { ...current, actions: current.actions.map((a) => (a.id === action.id ? action : a)) }
    );
  const updateRestriction = (changes: Partial<NotificationsTimeRestriction>): void =>
    setEdited(
      (current) =>
        current && {
          ...current,
          notificationsTimeRestriction: { ...current.notificationsTimeRestriction, ...changes },
        }
    );

  const onSave = async (): Promise<void> => {
    if (!oystehrZambda || !edited) return;
    if (edited.actions.some(actionHasProblem)) {
      setShowErrors(true);
      setSaveError('Fix the highlighted problems before saving.');
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const response = await saveOutreachConfig(oystehrZambda, edited);
      setSaved(toSettings(response));
      setEdited(toSettings(response));
      setShowErrors(false);
      enqueueSnackbar('Outreach settings saved', { variant: 'success' });
    } catch (error) {
      setSaveError(getApiError({ error, defaultError: 'Failed to save outreach settings' }));
    } finally {
      setSaving(false);
    }
  };

  const restriction = edited?.notificationsTimeRestriction;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          Outreach Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Automated patient outreach triggered by invoice events.
        </Typography>
      </Box>
      {loadError ? (
        <Alert severity="error" action={<Button onClick={() => setLoadAttempt((value) => value + 1)}>Retry</Button>}>
          {loadError}
        </Alert>
      ) : !edited || !restriction ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} aria-label="Loading outreach settings" />
        </Box>
      ) : (
        <Box
          sx={{ bgcolor: 'background.paper', border: `1px solid ${otherColors.lightDivider}`, borderRadius: 2, p: 3 }}
        >
          <Stack component="fieldset" disabled={saving} spacing={3} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}
            {INVOICE_OUTREACH_TRIGGER_EVENTS.map((event) => (
              <Stack
                key={event}
                component="section"
                aria-label={`Triggered by ${TRIGGER_EVENT_LABELS[event]}`}
                spacing={2}
              >
                <Typography variant="h6" component="h2">
                  Triggered by {TRIGGER_EVENT_LABELS[event]}
                </Typography>
                {edited.actions
                  .filter((action) => action.trigger.event === event)
                  .map((action) => (
                    <ActionEditor
                      key={action.id}
                      action={action}
                      onChange={updateAction}
                      onDelete={() =>
                        setEdited({ ...edited, actions: edited.actions.filter((a) => a.id !== action.id) })
                      }
                      showErrors={showErrors}
                      disabled={saving}
                    />
                  ))}
                <Box>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() =>
                      setEdited({
                        ...edited,
                        actions: [
                          ...edited.actions,
                          {
                            id: crypto.randomUUID(),
                            trigger: { event, daysAfter: 0 },
                            actionType: 'send-notification',
                            ...buildDefaultConfig('send-notification'),
                          },
                        ],
                      })
                    }
                  >
                    Add action
                  </Button>
                </Box>
              </Stack>
            ))}
            <Divider />
            <Stack component="section" aria-label="Notification hours" spacing={2}>
              <Typography variant="h6" component="h2">
                Notification hours
              </Typography>
              <FormControlLabel
                label="Restrict notifications to specific hours"
                control={
                  <Checkbox
                    checked={restriction.enabled}
                    onChange={(event) => updateRestriction({ enabled: event.target.checked })}
                  />
                }
              />
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <TextField
                  label="Send after"
                  type="time"
                  size="small"
                  disabled={!restriction.enabled}
                  value={restriction.windowStart}
                  // A cleared time is empty, which the save endpoint rejects.
                  onChange={(event) => event.target.value && updateRestriction({ windowStart: event.target.value })}
                  sx={{ width: 160 }}
                  inputProps={{ step: 900 }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Send before"
                  type="time"
                  size="small"
                  disabled={!restriction.enabled}
                  value={restriction.windowEnd}
                  onChange={(event) => event.target.value && updateRestriction({ windowEnd: event.target.value })}
                  sx={{ width: 160 }}
                  inputProps={{ step: 900 }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  select
                  label="Timezone"
                  size="small"
                  disabled={saving || !restriction.enabled}
                  value={restriction.timezone}
                  onChange={(event) => updateRestriction({ timezone: event.target.value })}
                  sx={{ width: 300 }}
                  InputLabelProps={{ shrink: true }}
                >
                  {OUTREACH_TIMEZONE_OPTIONS.map(({ value, label }) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={!dirty || saving} onClick={() => void onSave()}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button
                disabled={!dirty || saving}
                onClick={() => {
                  setEdited(saved);
                  setSaveError(null);
                  setShowErrors(false);
                }}
              >
                Reset
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
