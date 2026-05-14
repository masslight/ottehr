import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Snackbar,
  Stack,
  Switch,
  Tab,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEditor } from '@tiptap/react';
import React, { ReactElement, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { INVOICE_TOKEN_IDS, TemplateEditorField } from 'src/rcm/features/invoicing/InvoiceTemplateEditor';
import {
  useGetOutreachConfigQuery,
  useSaveOutreachConfigMutation,
} from 'src/rcm/state/scheduled-outreach-config/scheduled-outreach-config.queries';
import { buildInvoicePlaceholders, InvoicePlaceholderInput } from 'utils';
import OutreachTasksReport from './OutreachTasksReport';

// ── Types ──────────────────────────────────────────────────────────────────

type TriggerEvent = 'date-of-visit' | 'invoice-issued' | 'invoice-due' | 'discharge-time' | 'patient-birthday';

type NotificationMedium = 'sms' | 'email' | 'paper-mail';

type ActionType = 'charge-card' | 'send-notification' | 'refer-to-collections' | 'log';

type TimeUnit = 'days' | 'hours' | 'minutes';

type TriggerDirection = 'after' | 'before';

type OutreachStatementType = 'standard' | 'past-due' | 'final-notice';

interface NotificationConfig {
  enabled: boolean;
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
  statementType?: OutreachStatementType;
}

interface ChargeCardConfig {
  onSuccess: NotificationConfig;
  onFailure: NotificationConfig;
  retryAttempts: number;
  retryIntervalDays: number;
}

interface SendNotificationConfig {
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
  statementType?: OutreachStatementType;
}

interface ReferToCollectionsConfig {
  agency: string;
  minimumBalance: number;
  includePaymentHistory: boolean;
}

interface BirthdayConfig {
  /** 'at' = only on this exact age; 'after' = from this age onward (up to maxAge). */
  ageMode?: 'at' | 'after';
  /** The target age (required when ageMode is set). */
  age?: number;
  /** Upper bound when ageMode is 'after'. Defaults to 100 if not specified. */
  maxAge?: number;
}

interface OutreachAction {
  id: string;
  trigger: {
    event: TriggerEvent;
    daysAfter: number;
    timeUnit?: TimeUnit;
    direction?: TriggerDirection;
  };
  actionType: ActionType;
  chargeCardConfig?: ChargeCardConfig;
  sendNotificationConfig?: SendNotificationConfig;
  referToCollectionsConfig?: ReferToCollectionsConfig;
  logConfig?: Record<string, never>;
  birthdayConfig?: BirthdayConfig;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TRIGGER_EVENT_LABELS: Record<TriggerEvent, string> = {
  'discharge-time': 'Discharge Time',
  'date-of-visit': 'Visit Date',
  'invoice-issued': 'Invoice Issue Date',
  'invoice-due': 'Invoice Due Date',
  'patient-birthday': 'Patient Birthday',
};

/** Which action types are allowed for each trigger event. */
const ALLOWED_ACTIONS: Record<TriggerEvent, ActionType[]> = {
  'date-of-visit': ['charge-card', 'send-notification', 'refer-to-collections', 'log'],
  'invoice-issued': ['charge-card', 'send-notification', 'refer-to-collections', 'log'],
  'invoice-due': ['charge-card', 'send-notification', 'refer-to-collections', 'log'],
  'discharge-time': ['send-notification', 'log'],
  'patient-birthday': ['send-notification', 'log'],
};

/** Which time units are available for each trigger event. */
const ALLOWED_TIME_UNITS: Record<TriggerEvent, TimeUnit[]> = {
  'date-of-visit': ['days'],
  'invoice-issued': ['days'],
  'invoice-due': ['days'],
  'discharge-time': ['days', 'hours', 'minutes'],
  'patient-birthday': ['days'],
};

/** Whether the trigger supports before/after direction. */
const SUPPORTS_DIRECTION: Record<TriggerEvent, boolean> = {
  'date-of-visit': false,
  'invoice-issued': false,
  'invoice-due': false,
  'discharge-time': false,
  'patient-birthday': true,
};

const TIME_UNIT_LABELS: Record<TimeUnit, string> = {
  days: 'Days',
  hours: 'Hours',
  minutes: 'Minutes',
};

const DIRECTION_LABELS: Record<TriggerDirection, string> = {
  after: 'After',
  before: 'Before',
};

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  'charge-card': 'Charge Credit Card on File',
  'send-notification': 'Send Notification',
  'refer-to-collections': 'Refer to Collections',
  log: 'Log',
};

const MEDIUM_LABELS: Record<NotificationMedium, string> = {
  sms: 'SMS',
  email: 'Email',
  'paper-mail': 'Mail Statement',
};

const STATEMENT_TYPE_LABELS: Record<OutreachStatementType, string> = {
  standard: 'Standard',
  'past-due': 'Past Due',
  'final-notice': 'Final Notice',
};

/** Returns the medium keys available to the current environment. */
function getAvailableMediums(): NotificationMedium[] {
  const mediums: NotificationMedium[] = ['sms', 'email'];
  if (FEATURE_FLAGS.MAILING_PAPER_STATEMENTS_ENABLED) {
    mediums.push('paper-mail');
  }
  return mediums;
}

const ACTION_CHIP_COLORS: Record<ActionType, string> = {
  'charge-card': '#e65100',
  'send-notification': '#2e7d32',
  'refer-to-collections': '#b71c1c',
  log: '#546e7a',
};

const MEDIUM_CHIP_COLORS: Record<NotificationMedium, string> = {
  sms: '#43a047',
  email: '#0277bd',
  'paper-mail': '#4e342e',
};

/** Normalise a trigger offset to a day-equivalent value for colour selection. */
function triggerToDayEquivalent(trigger: OutreachAction['trigger']): number {
  const unit = trigger.timeUnit || 'days';
  if (unit === 'hours') return trigger.daysAfter / 24;
  if (unit === 'minutes') return trigger.daysAfter / 1440;
  return trigger.daysAfter;
}

/** Returns a gradient background from light green (day 0) to light purple (day 90+). */
function dayChipBackground(trigger: OutreachAction['trigger']): string {
  const t = Math.min(triggerToDayEquivalent(trigger) / 90, 1);
  // Interpolate HSL: green (140°) → purple (280°)
  const h = Math.round(140 + t * 140);
  return `hsl(${h}, 60%, 90%)`;
}

function dayChipTextColor(trigger: OutreachAction['trigger']): string {
  const t = Math.min(triggerToDayEquivalent(trigger) / 90, 1);
  const h = Math.round(140 + t * 140);
  return `hsl(${h}, 50%, 30%)`;
}

/** Formats the trigger timing for display in chips and summaries. */
function formatTriggerTiming(trigger: OutreachAction['trigger']): { chipLabel: string; afterLabel: string } {
  const unit = trigger.timeUnit || 'days';
  const direction = trigger.direction || 'after';
  const value = trigger.daysAfter;

  const unitLabel = value === 1 ? unit.replace(/s$/, '') : unit;

  if (direction === 'before') {
    if (value === 0) return { chipLabel: 'On the day', afterLabel: `on ${TRIGGER_EVENT_LABELS[trigger.event]}` };
    return { chipLabel: `${value} ${unitLabel} before`, afterLabel: `before ${TRIGGER_EVENT_LABELS[trigger.event]}` };
  }

  if (unit === 'minutes') {
    return { chipLabel: `${value} min`, afterLabel: `after ${TRIGGER_EVENT_LABELS[trigger.event]}` };
  }
  if (unit === 'hours') {
    return { chipLabel: `${value} hr`, afterLabel: `after ${TRIGGER_EVENT_LABELS[trigger.event]}` };
  }
  return { chipLabel: `Day ${value}`, afterLabel: `after ${TRIGGER_EVENT_LABELS[trigger.event]}` };
}

/** Collects all unique mediums used by an action. */
interface ActionMediumsSummary {
  /** For non-charge-card: single list. For charge-card: split by outcome. */
  combined: NotificationMedium[];
  successMediums: NotificationMedium[];
  failureMediums: NotificationMedium[];
  isChargeCard: boolean;
}

function getActionMediumsSummary(action: OutreachAction): ActionMediumsSummary {
  if (action.actionType === 'charge-card' && action.chargeCardConfig) {
    const c = action.chargeCardConfig;
    const successMediums = c.onSuccess.enabled ? c.onSuccess.mediums : [];
    const failureMediums = c.onFailure.enabled ? c.onFailure.mediums : [];
    const set = new Set<NotificationMedium>([...successMediums, ...failureMediums]);
    return { combined: Array.from(set), successMediums, failureMediums, isChargeCard: true };
  }
  if (action.actionType === 'send-notification' && action.sendNotificationConfig) {
    return {
      combined: [...action.sendNotificationConfig.mediums],
      successMediums: [],
      failureMediums: [],
      isChargeCard: false,
    };
  }
  return { combined: [], successMediums: [], failureMediums: [], isChargeCard: false };
}

const SAMPLE_INPUT: InvoicePlaceholderInput = {
  patientFullName: 'Jane Smith',
  clinic: 'Ottehr Clinic',
  location: 'Washington, DC',
  visitDate: '2026-03-15',
  dueDate: '2026-03-29',
  amountCents: 12500,
  invoiceLink: 'https://payments.ottehr.com/inv/abc123',
  patientPortalLink: 'https://patient.ottehr.com/',
};

const OUTREACH_TOKEN_IDS = [...INVOICE_TOKEN_IDS, 'location-review-link'] as const;

const SAMPLE_PREVIEW_VALUES: Record<string, string> = {
  ...buildInvoicePlaceholders(SAMPLE_INPUT),
  'location-review-link': 'https://g.page/r/example-clinic/review',
};

const DEFAULT_SMS_TEMPLATE =
  'Hello {{patient-full-name}}, thank you for visiting {{clinic}} at {{location}} on {{visit-date}} and entrusting us with your care. You can view your information in the Patient Portal: {{patient-portal-link}}';
const DEFAULT_EMAIL_TEMPLATE =
  'Hello {{patient-full-name}},\n\nThank you for visiting {{clinic}} at {{location}} on {{visit-date}} and entrusting us with your care.\n\nYou can view your information in the [Patient Portal]({{patient-portal-link}}).\n\nThank you,\n{{clinic}}';

function defaultNotificationConfig(): NotificationConfig {
  return {
    enabled: true,
    mediums: ['email'],
    smsTemplate: DEFAULT_SMS_TEMPLATE,
    emailTemplate: DEFAULT_EMAIL_TEMPLATE,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Common props for numeric TextFields: select-all on focus. */
const numericFieldProps = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
};

function genId(): string {
  return crypto.randomUUID();
}

function buildDefaultConfig(actionType: ActionType): Partial<OutreachAction> {
  switch (actionType) {
    case 'charge-card':
      return {
        chargeCardConfig: {
          onSuccess: defaultNotificationConfig(),
          onFailure: defaultNotificationConfig(),
          retryAttempts: 1,
          retryIntervalDays: 3,
        },
      };
    case 'send-notification':
      return {
        sendNotificationConfig: {
          mediums: ['email'],
          smsTemplate: DEFAULT_SMS_TEMPLATE,
          emailTemplate: DEFAULT_EMAIL_TEMPLATE,
        },
      };
    case 'refer-to-collections':
      return {
        referToCollectionsConfig: {
          agency: '',
          minimumBalance: 0,
          includePaymentHistory: false,
        },
      };
    case 'log':
      return {};
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

/** Wrapper around TemplateEditorField that manages its own editor ref. */
function OutreachTemplateField({
  label,
  value,
  onChange,
  renderHtmlPreview,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  renderHtmlPreview?: boolean;
}): ReactElement {
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  return (
    <TemplateEditorField
      label={label}
      value={value}
      onChange={onChange}
      editorRef={editorRef}
      previewValues={SAMPLE_PREVIEW_VALUES}
      helperText="Type {{ to insert a placeholder. Use [link text]({{url-placeholder}}) for clickable links."
      renderHtmlPreview={renderHtmlPreview}
      tokenIds={OUTREACH_TOKEN_IDS}
    />
  );
}

function MediumCheckboxes({
  selected,
  onChange,
  excludeMediums = [],
}: {
  selected: NotificationMedium[];
  onChange: (mediums: NotificationMedium[]) => void;
  excludeMediums?: NotificationMedium[];
}): ReactElement {
  const toggle = (m: NotificationMedium): void => {
    onChange(selected.includes(m) ? selected.filter((x) => x !== m) : [...selected, m]);
  };
  return (
    <FormGroup row>
      {getAvailableMediums()
        .filter((m) => !excludeMediums.includes(m))
        .map((m) => (
          <FormControlLabel
            key={m}
            control={<Checkbox size="small" checked={selected.includes(m)} onChange={() => toggle(m)} />}
            label={MEDIUM_LABELS[m]}
          />
        ))}
    </FormGroup>
  );
}

/** Inline template editors shown for the selected mediums. */
function MediumTemplateEditors({
  mediums,
  smsTemplate,
  emailTemplate,
  onSmsChange,
  onEmailChange,
}: {
  mediums: NotificationMedium[];
  smsTemplate: string;
  emailTemplate: string;
  onSmsChange: (v: string) => void;
  onEmailChange: (v: string) => void;
}): ReactElement {
  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {mediums.includes('sms') && (
        <OutreachTemplateField label="SMS Template" value={smsTemplate} onChange={onSmsChange} />
      )}
      {mediums.includes('email') && (
        <OutreachTemplateField
          label="Email Template"
          value={emailTemplate}
          onChange={onEmailChange}
          renderHtmlPreview
        />
      )}
    </Stack>
  );
}

/** Tabbed channel configuration for a single notification outcome (success or failure). */
function ChannelTabs({
  config,
  onChange,
}: {
  config: NotificationConfig;
  onChange: (c: NotificationConfig) => void;
}): ReactElement {
  const [activeTab, setActiveTab] = useState<NotificationMedium>('sms');

  const isMediumEnabled = (m: NotificationMedium): boolean => config.mediums.includes(m);

  const toggleMedium = (m: NotificationMedium, enabled: boolean): void => {
    const mediums = enabled ? [...config.mediums, m] : config.mediums.filter((x) => x !== m);
    const updated = { ...config, mediums };
    if (enabled && m === 'sms' && !updated.smsTemplate) {
      updated.smsTemplate = DEFAULT_SMS_TEMPLATE;
    }
    if (enabled && m === 'email' && !updated.emailTemplate) {
      updated.emailTemplate = DEFAULT_EMAIL_TEMPLATE;
    }
    if (enabled && m === 'paper-mail' && !updated.statementType) {
      updated.statementType = 'standard';
    }
    onChange(updated);
  };

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <TabContext value={activeTab}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
          <TabList
            onChange={(_, v: NotificationMedium) => setActiveTab(v)}
            sx={{ minHeight: 36 }}
            aria-label="Notification channel tabs"
          >
            {getAvailableMediums().map((m) => (
              <Tab
                key={m}
                value={m}
                sx={{ textTransform: 'none', minHeight: 36, py: 0.5 }}
                label={
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="body2">{MEDIUM_LABELS[m]}</Typography>
                    {isMediumEnabled(m) && (
                      <Chip label="On" size="small" color="success" sx={{ height: 18, fontSize: '0.7rem' }} />
                    )}
                  </Stack>
                }
              />
            ))}
          </TabList>
        </Box>
        {getAvailableMediums().map((m) => (
          <TabPanel key={m} value={m} sx={{ p: 2 }}>
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={isMediumEnabled(m)}
                    onChange={(e) => toggleMedium(m, e.target.checked)}
                  />
                }
                label={
                  <Typography variant="subtitle2">
                    {isMediumEnabled(m) ? `${MEDIUM_LABELS[m]} enabled` : `${MEDIUM_LABELS[m]} disabled`}
                  </Typography>
                }
              />
              {isMediumEnabled(m) && m === 'sms' && (
                <OutreachTemplateField
                  label="SMS Template"
                  value={config.smsTemplate}
                  onChange={(smsTemplate) => onChange({ ...config, smsTemplate })}
                />
              )}
              {isMediumEnabled(m) && m === 'email' && (
                <OutreachTemplateField
                  label="Email Template"
                  value={config.emailTemplate}
                  onChange={(emailTemplate) => onChange({ ...config, emailTemplate })}
                  renderHtmlPreview
                />
              )}
              {isMediumEnabled(m) && m === 'paper-mail' && (
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    A printed statement will be generated and mailed to the patient&apos;s address on file.
                  </Typography>
                  <FormControl size="small" sx={{ maxWidth: 250 }}>
                    <InputLabel>Statement Type</InputLabel>
                    <Select
                      value={config.statementType || 'standard'}
                      label="Statement Type"
                      onChange={(e: SelectChangeEvent) =>
                        onChange({ ...config, statementType: e.target.value as OutreachStatementType })
                      }
                    >
                      {(Object.keys(STATEMENT_TYPE_LABELS) as OutreachStatementType[]).map((st) => (
                        <MenuItem key={st} value={st}>
                          {STATEMENT_TYPE_LABELS[st]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              )}
            </Stack>
          </TabPanel>
        ))}
      </TabContext>
    </Box>
  );
}

function ChargeCardConfigEditor({
  config,
  onChange,
}: {
  config: ChargeCardConfig;
  onChange: (c: ChargeCardConfig) => void;
}): ReactElement {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="body2">Retry</Typography>
        <TextField
          type="number"
          size="small"
          value={config.retryAttempts}
          onChange={(e) =>
            onChange({
              ...config,
              retryAttempts: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0),
            })
          }
          sx={{ width: 70 }}
          inputProps={{ min: 0, max: 10, ...numericFieldProps }}
        />
        <Typography variant="body2">time(s) every</Typography>
        <TextField
          type="number"
          size="small"
          value={config.retryIntervalDays}
          onChange={(e) =>
            onChange({
              ...config,
              retryIntervalDays: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0),
            })
          }
          sx={{ width: 70 }}
          inputProps={{ min: 0, max: 90, ...numericFieldProps }}
        />
        <Typography variant="body2">day(s)</Typography>
      </Stack>
      <Divider />
      <Box>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={config.onSuccess.enabled}
              onChange={(e) => onChange({ ...config, onSuccess: { ...config.onSuccess, enabled: e.target.checked } })}
            />
          }
          label={<Typography variant="subtitle2">Notify on Successful Charge</Typography>}
        />
        {config.onSuccess.enabled && (
          <Box sx={{ ml: 4, mt: 1 }}>
            <ChannelTabs config={config.onSuccess} onChange={(onSuccess) => onChange({ ...config, onSuccess })} />
          </Box>
        )}
      </Box>
      <Box>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={config.onFailure.enabled}
              onChange={(e) => onChange({ ...config, onFailure: { ...config.onFailure, enabled: e.target.checked } })}
            />
          }
          label={<Typography variant="subtitle2">Notify on Failed Charge</Typography>}
        />
        {config.onFailure.enabled && (
          <Box sx={{ ml: 4, mt: 1 }}>
            <ChannelTabs config={config.onFailure} onChange={(onFailure) => onChange({ ...config, onFailure })} />
          </Box>
        )}
      </Box>
    </Stack>
  );
}

function SendNotificationConfigEditor({
  config,
  onChange,
  excludeMediums = [],
}: {
  config: SendNotificationConfig;
  onChange: (c: SendNotificationConfig) => void;
  excludeMediums?: NotificationMedium[];
}): ReactElement {
  return (
    <Stack spacing={2}>
      <Box>
        <FormLabel component="legend" sx={{ fontSize: '0.8rem', mb: 0.5 }}>
          Notification channels
        </FormLabel>
        <MediumCheckboxes
          selected={config.mediums}
          excludeMediums={excludeMediums}
          onChange={(mediums) => {
            const updated = { ...config, mediums };
            if (mediums.includes('sms') && !updated.smsTemplate) {
              updated.smsTemplate = DEFAULT_SMS_TEMPLATE;
            }
            if (mediums.includes('email') && !updated.emailTemplate) {
              updated.emailTemplate = DEFAULT_EMAIL_TEMPLATE;
            }
            if (mediums.includes('paper-mail') && !updated.statementType) {
              updated.statementType = 'standard';
            }
            onChange(updated);
          }}
        />
      </Box>
      <MediumTemplateEditors
        mediums={config.mediums}
        smsTemplate={config.smsTemplate}
        emailTemplate={config.emailTemplate}
        onSmsChange={(smsTemplate) => onChange({ ...config, smsTemplate })}
        onEmailChange={(emailTemplate) => onChange({ ...config, emailTemplate })}
      />
      {config.mediums.includes('paper-mail') && (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            A printed statement will be generated and mailed to the patient&apos;s address on file.
          </Typography>
          <FormControl size="small" sx={{ maxWidth: 250 }}>
            <InputLabel>Statement Type</InputLabel>
            <Select
              value={config.statementType || 'standard'}
              label="Statement Type"
              onChange={(e: SelectChangeEvent) =>
                onChange({ ...config, statementType: e.target.value as OutreachStatementType })
              }
            >
              {(Object.keys(STATEMENT_TYPE_LABELS) as OutreachStatementType[]).map((st) => (
                <MenuItem key={st} value={st}>
                  {STATEMENT_TYPE_LABELS[st]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      )}
    </Stack>
  );
}

function CollectionsConfigEditor({
  config: _config,
  onChange: _onChange,
}: {
  config: ReferToCollectionsConfig;
  onChange: (c: ReferToCollectionsConfig) => void;
}): ReactElement {
  return (
    <Stack spacing={2}>
      <Alert severity="warning" icon={<WarningAmberIcon fontSize="inherit" />}>
        Automated referral to collections action is not yet available.
      </Alert>
      <Box sx={{ opacity: 0.4, pointerEvents: 'none' }}>
        <Stack spacing={2}>
          <FormControl size="small" sx={{ maxWidth: 350 }} disabled>
            <InputLabel>Collections Agency</InputLabel>
            <Select value="" label="Collections Agency" onChange={() => {}}>
              <MenuItem value="National Recovery Agency">National Recovery Agency</MenuItem>
              <MenuItem value="IC System">IC System</MenuItem>
              <MenuItem value="Transworld Systems">Transworld Systems</MenuItem>
              <MenuItem value="">— None —</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Minimum Balance ($)"
            type="number"
            size="small"
            value={0}
            disabled
            sx={{ width: 200 }}
            inputProps={{ min: 0, step: 5, ...numericFieldProps }}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={false} disabled />}
            label="Include payment history with referral"
            disabled
          />
        </Stack>
      </Box>
    </Stack>
  );
}

const selectAllOnFocus = (e: React.FocusEvent<HTMLInputElement>): void => e.target.select();

const stripNonNumeric = (val: string): string => val.replace(/[^0-9]/g, '');

function BirthdayConfigEditor({
  config,
  onChange,
}: {
  config: BirthdayConfig;
  onChange: (c: BirthdayConfig) => void;
}): ReactElement {
  const hasAgeFilter = config.ageMode != null;
  const [ageText, setAgeText] = React.useState(String(config.age ?? ''));
  const [maxAgeText, setMaxAgeText] = React.useState(String(config.maxAge ?? 100));

  // Sync local text when config changes externally (e.g. mode toggle)
  React.useEffect(() => {
    setAgeText(String(config.age ?? ''));
  }, [config.age]);
  React.useEffect(() => {
    setMaxAgeText(String(config.maxAge ?? 100));
  }, [config.maxAge]);

  const commitAge = (raw: string): void => {
    const num = parseInt(raw, 10);
    if (!raw || isNaN(num)) {
      onChange({ ...config, age: undefined });
    } else {
      onChange({ ...config, age: Math.max(1, Math.min(100, num)) });
    }
  };

  const commitMaxAge = (raw: string): void => {
    const num = parseInt(raw, 10);
    if (!raw || isNaN(num)) {
      onChange({ ...config, maxAge: undefined });
    } else {
      onChange({ ...config, maxAge: Math.max(config.age ?? 1, Math.min(150, num)) });
    }
  };

  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Switch
            checked={hasAgeFilter}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ ...config, ageMode: 'at', age: 1 });
              } else {
                onChange({ ageMode: undefined, age: undefined, maxAge: undefined });
              }
            }}
          />
        }
        label="Filter by age"
      />
      {hasAgeFilter && (
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Mode</InputLabel>
            <Select
              value={config.ageMode || 'at'}
              label="Mode"
              onChange={(e: SelectChangeEvent) => {
                const mode = e.target.value as 'at' | 'after';
                onChange({
                  ...config,
                  ageMode: mode,
                  maxAge: mode === 'after' ? config.maxAge ?? 100 : undefined,
                });
              }}
            >
              <MenuItem value="at">At age</MenuItem>
              <MenuItem value="after">After age</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Age"
            size="small"
            value={ageText}
            onFocus={selectAllOnFocus}
            onChange={(e) => setAgeText(stripNonNumeric(e.target.value))}
            onBlur={() => commitAge(ageText)}
            sx={{ width: 100 }}
            inputProps={{ inputMode: 'numeric' }}
          />
          {config.ageMode === 'after' && (
            <TextField
              label="Max Age"
              size="small"
              value={maxAgeText}
              onFocus={selectAllOnFocus}
              onChange={(e) => setMaxAgeText(stripNonNumeric(e.target.value))}
              onBlur={() => commitMaxAge(maxAgeText)}
              sx={{ width: 120 }}
              inputProps={{ inputMode: 'numeric' }}
            />
          )}
        </Stack>
      )}
    </Stack>
  );
}

function ActionConfigEditor({
  action,
  onChange,
}: {
  action: OutreachAction;
  onChange: (a: OutreachAction) => void;
}): ReactElement {
  switch (action.actionType) {
    case 'charge-card':
      return (
        <ChargeCardConfigEditor
          config={action.chargeCardConfig!}
          onChange={(chargeCardConfig) => onChange({ ...action, chargeCardConfig })}
        />
      );
    case 'send-notification':
      return (
        <SendNotificationConfigEditor
          config={action.sendNotificationConfig!}
          onChange={(sendNotificationConfig) => onChange({ ...action, sendNotificationConfig })}
          excludeMediums={action.trigger.event === 'patient-birthday' ? ['paper-mail'] : []}
        />
      );
    case 'refer-to-collections':
      return (
        <CollectionsConfigEditor
          config={action.referToCollectionsConfig!}
          onChange={(referToCollectionsConfig) => onChange({ ...action, referToCollectionsConfig })}
        />
      );
    case 'log':
      return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1, fontStyle: 'italic' }}>
          This action will log that it was executed. No additional configuration is needed.
        </Typography>
      );
  }
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ScheduledPatientOutreach({ outreachTab }: { outreachTab?: string }): ReactElement {
  const navigate = useNavigate();
  const pageTab = (outreachTab === 'tracker' ? 'tasks-report' : 'configuration') as 'configuration' | 'tasks-report';
  const { data: outreachConfigData, isLoading, error: loadError } = useGetOutreachConfigQuery();
  const saveMutation = useSaveOutreachConfigMutation();
  const [actions, setActions] = React.useState<OutreachAction[]>([]);
  const [hasLoadedFromServer, setHasLoadedFromServer] = React.useState(false);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [newActionType, setNewActionType] = React.useState<ActionType>('send-notification');
  const [newTriggerEvent, setNewTriggerEvent] = React.useState<TriggerEvent>('invoice-due');
  const [newDaysAfter, setNewDaysAfter] = React.useState(0);
  const [newTimeUnit, setNewTimeUnit] = React.useState<TimeUnit>('days');
  const [newDirection, setNewDirection] = React.useState<TriggerDirection>('after');
  const [deleteConfirmAction, setDeleteConfirmAction] = React.useState<OutreachAction | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = React.useState(false);
  const [expandedBlocks, setExpandedBlocks] = React.useState<Set<TriggerEvent>>(
    new Set(Object.keys(TRIGGER_EVENT_LABELS) as TriggerEvent[])
  );
  const [visibleEventTypes, setVisibleEventTypes] = React.useState<TriggerEvent[]>(
    Object.keys(TRIGGER_EVENT_LABELS) as TriggerEvent[]
  );
  const [notificationsTimeRestrictionEnabled, setNotificationsTimeRestrictionEnabled] = React.useState(false);
  const [smsAllowedAfter, setSmsAllowedAfter] = React.useState('09:00');
  const [smsAllowedBefore, setSmsAllowedBefore] = React.useState('21:00');
  const [smsTimezone, setSmsTimezone] = React.useState('America/New_York');
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Load actions and settings from server when data arrives
  React.useEffect(() => {
    if (outreachConfigData && !hasLoadedFromServer) {
      if (outreachConfigData.actions && outreachConfigData.actions.length > 0) {
        setActions(outreachConfigData.actions as OutreachAction[]);
      }
      if (outreachConfigData.notificationsTimeRestriction) {
        const r = outreachConfigData.notificationsTimeRestriction;
        setNotificationsTimeRestrictionEnabled(r.enabled);
        setSmsAllowedAfter(r.windowStart);
        setSmsAllowedBefore(r.windowEnd);
        setSmsTimezone(r.timezone);
      }
      setHasLoadedFromServer(true);
    }
  }, [outreachConfigData, hasLoadedFromServer]);

  const sortedActions = React.useMemo(() => {
    const eventOrder: Record<TriggerEvent, number> = {
      'discharge-time': 0,
      'date-of-visit': 1,
      'invoice-issued': 2,
      'invoice-due': 3,
      'patient-birthday': 4,
    };
    return [...actions].sort(
      (a, b) =>
        eventOrder[a.trigger.event] - eventOrder[b.trigger.event] ||
        triggerToDayEquivalent(a.trigger) - triggerToDayEquivalent(b.trigger)
    );
  }, [actions]);

  const updateAction = (updated: OutreachAction): void => {
    setActions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const deleteAction = (id: string): void => {
    const updated = actions.filter((a) => a.id !== id);
    setActions(updated);
    saveActions(updated);
  };

  const handleAddAction = (): void => {
    const action: OutreachAction = {
      id: genId(),
      trigger: {
        event: newTriggerEvent,
        daysAfter: newDaysAfter,
        timeUnit: ALLOWED_TIME_UNITS[newTriggerEvent].length > 1 ? newTimeUnit : undefined,
        direction: SUPPORTS_DIRECTION[newTriggerEvent] ? newDirection : undefined,
      },
      actionType: newActionType,
      ...buildDefaultConfig(newActionType),
    };
    const updated = [...actions, action];
    setActions(updated);
    setAddDialogOpen(false);
    setNewDaysAfter(0);
    setNewTimeUnit('days');
    setNewDirection('after');
    saveActions(updated);
  };

  const buildNotificationsTimeRestriction = (): {
    enabled: boolean;
    windowStart: string;
    windowEnd: string;
    timezone: string;
  } => ({
    enabled: notificationsTimeRestrictionEnabled,
    windowStart: smsAllowedAfter,
    windowEnd: smsAllowedBefore,
    timezone: smsTimezone,
  });

  const saveActions = (actionsToSave: OutreachAction[]): void => {
    saveMutation.mutate(
      { actions: actionsToSave, notificationsTimeRestriction: buildNotificationsTimeRestriction() },
      {
        onSuccess: () => setSnackbar({ open: true, message: 'Outreach configuration saved', severity: 'success' }),
        onError: (err) => setSnackbar({ open: true, message: `Failed to save: ${err.message}`, severity: 'error' }),
      }
    );
  };

  const handleSave = (): void => {
    saveActions(actions);
  };

  if (isLoading) {
    return (
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">Failed to load outreach configuration: {loadError.message}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h3" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
            Patient Outreach, Collections and Automation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure automated outreach and collection actions triggered relative to billing events. Actions execute in
            order of days from the trigger event.
          </Typography>
        </Box>
        {pageTab === 'configuration' && (
          <Stack direction="row" spacing={1}>
            <IconButton onClick={() => setSettingsDialogOpen(true)} sx={{ color: 'primary.main' }}>
              <SettingsOutlinedIcon />
            </IconButton>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
              sx={{ textTransform: 'none', borderRadius: 100 }}
            >
              Add Action
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              sx={{ textTransform: 'none', borderRadius: 100 }}
            >
              {saveMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save'}
            </Button>
          </Stack>
        )}
      </Stack>

      {/* ── Page Tabs ──────────────────────────────────────────────────── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <TabContext value={pageTab}>
          <TabList
            onChange={(_, v) => {
              const urlTab = v === 'tasks-report' ? 'tracker' : 'configuration';
              navigate(`/admin/billing/patient-outreach/${urlTab}`);
            }}
            aria-label="Outreach page tabs"
          >
            <Tab label="Configuration" value="configuration" />
            <Tab label="Outreach Tracker" value="tasks-report" />
          </TabList>
        </TabContext>
      </Box>

      {pageTab === 'tasks-report' && <OutreachTasksReport />}

      {pageTab === 'configuration' && (
        <>
          {/* ── Event Type Filter & Controls ──────────────────────────────── */}
          {sortedActions.length > 0 && (
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Autocomplete
                multiple
                size="small"
                limitTags={3}
                options={Object.keys(TRIGGER_EVENT_LABELS) as TriggerEvent[]}
                getOptionLabel={(opt) => TRIGGER_EVENT_LABELS[opt]}
                value={visibleEventTypes}
                onChange={(_, newValue) => setVisibleEventTypes(newValue)}
                disableCloseOnSelect
                renderInput={(params) => (
                  <TextField {...params} label="Filter by event type" placeholder="Event types" />
                )}
                renderOption={(props, option, { selected }) => (
                  <li {...props}>
                    <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                    {TRIGGER_EVENT_LABELS[option]}
                  </li>
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip {...getTagProps({ index })} key={option} label={TRIGGER_EVENT_LABELS[option]} size="small" />
                  ))
                }
                getLimitTagsText={(more) => `+${more} more`}
                sx={{ minWidth: 350, maxWidth: 600 }}
              />
              <Button
                size="small"
                startIcon={<UnfoldMoreIcon />}
                onClick={() => setExpandedBlocks(new Set(Object.keys(TRIGGER_EVENT_LABELS) as TriggerEvent[]))}
                sx={{ textTransform: 'none', color: 'primary.main', whiteSpace: 'nowrap' }}
              >
                Expand All
              </Button>
              <Button
                size="small"
                startIcon={<UnfoldLessIcon />}
                onClick={() => setExpandedBlocks(new Set())}
                sx={{ textTransform: 'none', color: 'primary.main', whiteSpace: 'nowrap' }}
              >
                Collapse All
              </Button>
            </Stack>
          )}

          {sortedActions.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No outreach actions configured. Click "Add Action" to get started.
              </Typography>
            </Paper>
          )}

          {(Object.keys(TRIGGER_EVENT_LABELS) as TriggerEvent[]).map((eventType) => {
            const groupActions = sortedActions.filter((a) => a.trigger.event === eventType);
            if (groupActions.length === 0) return null;
            if (!visibleEventTypes.includes(eventType)) return null;
            const isBlockExpanded = expandedBlocks.has(eventType);
            return (
              <Paper
                key={eventType}
                variant="outlined"
                sx={{ mb: 3, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  onClick={() => {
                    setExpandedBlocks((prev) => {
                      const next = new Set(prev);
                      if (next.has(eventType)) next.delete(eventType);
                      else next.add(eventType);
                      return next;
                    });
                  }}
                  sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.dark', flexGrow: 1 }}>
                    Triggered by {TRIGGER_EVENT_LABELS[eventType]}
                  </Typography>
                  <Chip
                    label={`${groupActions.length} action${groupActions.length > 1 ? 's' : ''}`}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  {isBlockExpanded ? <ExpandLessIcon color="action" /> : <ExpandMoreIcon color="action" />}
                </Stack>
                <Collapse in={isBlockExpanded}>
                  <Box sx={{ px: 2, pb: 2 }}>
                    {groupActions.map((action) => {
                      const ms = getActionMediumsSummary(action);
                      const timing = formatTriggerTiming(action.trigger);
                      return (
                        <Accordion key={action.id} defaultExpanded={false} sx={{ mb: 1 }}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={1}
                              sx={{ width: '100%', pr: 2, flexWrap: 'wrap', rowGap: 0.5 }}
                            >
                              <Chip
                                label={timing.chipLabel}
                                size="small"
                                sx={{
                                  fontWeight: 600,
                                  minWidth: 65,
                                  justifyContent: 'center',
                                  bgcolor: dayChipBackground(action.trigger),
                                  color: dayChipTextColor(action.trigger),
                                  border: 'none',
                                }}
                              />
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {timing.afterLabel}
                              </Typography>
                              <Chip
                                label={ACTION_TYPE_LABELS[action.actionType]}
                                size="small"
                                variant="outlined"
                                sx={{
                                  bgcolor: '#fff',
                                  color: ACTION_CHIP_COLORS[action.actionType],
                                  borderColor: ACTION_CHIP_COLORS[action.actionType],
                                  fontWeight: 500,
                                }}
                              />
                              {ms.isChargeCard ? (
                                <>
                                  {ms.successMediums.length > 0 && (
                                    <>
                                      <Typography variant="body2" color="text.secondary">
                                        · on success send
                                      </Typography>
                                      {ms.successMediums.map((m) => (
                                        <Chip
                                          key={`s-${m}`}
                                          label={MEDIUM_LABELS[m]}
                                          size="small"
                                          variant="outlined"
                                          sx={{
                                            bgcolor: '#fff',
                                            color: MEDIUM_CHIP_COLORS[m],
                                            borderColor: MEDIUM_CHIP_COLORS[m],
                                            fontWeight: 500,
                                            fontSize: '0.75rem',
                                          }}
                                        />
                                      ))}
                                    </>
                                  )}
                                  {ms.failureMediums.length > 0 && (
                                    <>
                                      <Typography variant="body2" color="text.secondary">
                                        · on failure send
                                      </Typography>
                                      {ms.failureMediums.map((m) => (
                                        <Chip
                                          key={`f-${m}`}
                                          label={MEDIUM_LABELS[m]}
                                          size="small"
                                          variant="outlined"
                                          sx={{
                                            bgcolor: '#fff',
                                            color: MEDIUM_CHIP_COLORS[m],
                                            borderColor: MEDIUM_CHIP_COLORS[m],
                                            fontWeight: 500,
                                            fontSize: '0.75rem',
                                          }}
                                        />
                                      ))}
                                    </>
                                  )}
                                </>
                              ) : action.actionType === 'refer-to-collections' && action.referToCollectionsConfig ? (
                                <Typography variant="body2" color="text.secondary">
                                  {action.referToCollectionsConfig.minimumBalance > 0 &&
                                    `when balance is greater than $${action.referToCollectionsConfig.minimumBalance}`}
                                  {action.referToCollectionsConfig.minimumBalance > 0 &&
                                    action.referToCollectionsConfig.agency &&
                                    '\u00a0\u00a0'}
                                  {action.referToCollectionsConfig.agency &&
                                    `via ${action.referToCollectionsConfig.agency}`}
                                </Typography>
                              ) : (
                                ms.combined.length > 0 && (
                                  <>
                                    <Typography variant="body2" color="text.secondary">
                                      via
                                    </Typography>
                                    {ms.combined.map((m) => (
                                      <Chip
                                        key={m}
                                        label={MEDIUM_LABELS[m]}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                          bgcolor: '#fff',
                                          color: MEDIUM_CHIP_COLORS[m],
                                          borderColor: MEDIUM_CHIP_COLORS[m],
                                          fontWeight: 500,
                                          fontSize: '0.75rem',
                                        }}
                                      />
                                    ))}
                                  </>
                                )
                              )}
                              <Box sx={{ flexGrow: 1 }} />
                              <Tooltip title="Delete action">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmAction(action);
                                  }}
                                  sx={{ color: 'error.main' }}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack spacing={2}>
                              <Stack
                                direction="row"
                                spacing={2}
                                alignItems="center"
                                sx={{ flexWrap: 'wrap', rowGap: 1 }}
                              >
                                <FormControl size="small" sx={{ minWidth: 200 }}>
                                  <InputLabel>Trigger Event</InputLabel>
                                  <Select
                                    value={action.trigger.event}
                                    label="Trigger Event"
                                    onChange={(e: SelectChangeEvent) => {
                                      const newEvent = e.target.value as TriggerEvent;
                                      const allowed = ALLOWED_ACTIONS[newEvent];
                                      const newActionType = allowed.includes(action.actionType)
                                        ? action.actionType
                                        : allowed[0];
                                      const timeUnits = ALLOWED_TIME_UNITS[newEvent];
                                      const newTimeUnit = timeUnits.includes(action.trigger.timeUnit || 'days')
                                        ? action.trigger.timeUnit || 'days'
                                        : timeUnits[0];
                                      updateAction({
                                        ...action,
                                        trigger: {
                                          ...action.trigger,
                                          event: newEvent,
                                          timeUnit: newTimeUnit,
                                          direction: SUPPORTS_DIRECTION[newEvent]
                                            ? action.trigger.direction || 'after'
                                            : undefined,
                                        },
                                        actionType: newActionType,
                                        ...(newActionType !== action.actionType
                                          ? {
                                              chargeCardConfig: undefined,
                                              sendNotificationConfig: undefined,
                                              referToCollectionsConfig: undefined,
                                              ...buildDefaultConfig(newActionType),
                                            }
                                          : {}),
                                      });
                                    }}
                                  >
                                    {(Object.keys(TRIGGER_EVENT_LABELS) as TriggerEvent[]).map((ev) => (
                                      <MenuItem key={ev} value={ev}>
                                        {TRIGGER_EVENT_LABELS[ev]}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                                {SUPPORTS_DIRECTION[action.trigger.event] && (
                                  <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>Direction</InputLabel>
                                    <Select
                                      value={action.trigger.direction || 'after'}
                                      label="Direction"
                                      onChange={(e: SelectChangeEvent) =>
                                        updateAction({
                                          ...action,
                                          trigger: { ...action.trigger, direction: e.target.value as TriggerDirection },
                                        })
                                      }
                                    >
                                      <MenuItem value="before">Before</MenuItem>
                                      <MenuItem value="after">After</MenuItem>
                                    </Select>
                                  </FormControl>
                                )}
                                <TextField
                                  label={
                                    SUPPORTS_DIRECTION[action.trigger.event]
                                      ? `${TIME_UNIT_LABELS[action.trigger.timeUnit || 'days']} ${
                                          DIRECTION_LABELS[action.trigger.direction || 'after']
                                        }`
                                      : `${TIME_UNIT_LABELS[action.trigger.timeUnit || 'days']} After Event`
                                  }
                                  type="number"
                                  size="small"
                                  value={action.trigger.daysAfter}
                                  onChange={(e) =>
                                    updateAction({
                                      ...action,
                                      trigger: {
                                        ...action.trigger,
                                        daysAfter:
                                          e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0),
                                      },
                                    })
                                  }
                                  sx={{ width: 180 }}
                                  inputProps={{ min: 0, ...numericFieldProps }}
                                />
                                {ALLOWED_TIME_UNITS[action.trigger.event].length > 1 && (
                                  <FormControl size="small" sx={{ minWidth: 160 }}>
                                    <InputLabel>Time Unit</InputLabel>
                                    <Select
                                      value={action.trigger.timeUnit || 'days'}
                                      label="Time Unit"
                                      onChange={(e: SelectChangeEvent) =>
                                        updateAction({
                                          ...action,
                                          trigger: { ...action.trigger, timeUnit: e.target.value as TimeUnit },
                                        })
                                      }
                                    >
                                      {ALLOWED_TIME_UNITS[action.trigger.event].map((u) => (
                                        <MenuItem key={u} value={u}>
                                          {TIME_UNIT_LABELS[u]}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                )}
                                <FormControl size="small" sx={{ minWidth: 240 }}>
                                  <InputLabel>Action Type</InputLabel>
                                  <Select
                                    value={action.actionType}
                                    label="Action Type"
                                    sx={{ color: ACTION_CHIP_COLORS[action.actionType], fontWeight: 500 }}
                                    onChange={(e: SelectChangeEvent) => {
                                      const newType = e.target.value as ActionType;
                                      updateAction({
                                        ...action,
                                        actionType: newType,
                                        chargeCardConfig: undefined,
                                        sendNotificationConfig: undefined,
                                        referToCollectionsConfig: undefined,
                                        ...buildDefaultConfig(newType),
                                      });
                                    }}
                                  >
                                    {ALLOWED_ACTIONS[action.trigger.event].map((at) => (
                                      <MenuItem
                                        key={at}
                                        value={at}
                                        sx={{ color: ACTION_CHIP_COLORS[at], fontWeight: 500 }}
                                      >
                                        {ACTION_TYPE_LABELS[at]}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Stack>
                              {action.trigger.event === 'patient-birthday' && (
                                <BirthdayConfigEditor
                                  config={action.birthdayConfig || {}}
                                  onChange={(birthdayConfig) => updateAction({ ...action, birthdayConfig })}
                                />
                              )}
                              <Divider />
                              <Typography variant="subtitle2" color="text.secondary">
                                Action Configuration
                              </Typography>
                              <ActionConfigEditor action={action} onChange={updateAction} />
                            </Stack>
                          </AccordionDetails>
                        </Accordion>
                      );
                    })}
                  </Box>
                </Collapse>
              </Paper>
            );
          })}

          {/* ── Delete Confirmation Dialog ─────────────────────────────────── */}
          <Dialog
            open={deleteConfirmAction !== null}
            onClose={() => setDeleteConfirmAction(null)}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle>Delete Outreach Action</DialogTitle>
            <DialogContent>
              {deleteConfirmAction &&
                (() => {
                  const action = deleteConfirmAction;
                  const ms = getActionMediumsSummary(action);
                  return (
                    <Stack spacing={2} sx={{ mt: 1 }}>
                      <Typography variant="body2">Are you sure you want to delete this action?</Typography>
                      <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                          {(() => {
                            const timing = formatTriggerTiming(action.trigger);
                            return (
                              <>
                                <Chip
                                  label={timing.chipLabel}
                                  size="small"
                                  sx={{
                                    fontWeight: 600,
                                    minWidth: 65,
                                    justifyContent: 'center',
                                    bgcolor: dayChipBackground(action.trigger),
                                    color: dayChipTextColor(action.trigger),
                                    border: 'none',
                                  }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {timing.afterLabel}
                                </Typography>
                              </>
                            );
                          })()}
                          <Chip
                            label={ACTION_TYPE_LABELS[action.actionType]}
                            size="small"
                            variant="outlined"
                            sx={{
                              bgcolor: '#fff',
                              color: ACTION_CHIP_COLORS[action.actionType],
                              borderColor: ACTION_CHIP_COLORS[action.actionType],
                              fontWeight: 500,
                            }}
                          />
                          {ms.isChargeCard ? (
                            <>
                              {ms.successMediums.length > 0 && (
                                <>
                                  <Typography variant="body2" color="text.secondary">
                                    · on success send
                                  </Typography>
                                  {ms.successMediums.map((m) => (
                                    <Chip
                                      key={`s-${m}`}
                                      label={MEDIUM_LABELS[m]}
                                      size="small"
                                      variant="outlined"
                                      sx={{
                                        bgcolor: '#fff',
                                        color: MEDIUM_CHIP_COLORS[m],
                                        borderColor: MEDIUM_CHIP_COLORS[m],
                                        fontWeight: 500,
                                        fontSize: '0.75rem',
                                      }}
                                    />
                                  ))}
                                </>
                              )}
                              {ms.failureMediums.length > 0 && (
                                <>
                                  <Typography variant="body2" color="text.secondary">
                                    · on failure send
                                  </Typography>
                                  {ms.failureMediums.map((m) => (
                                    <Chip
                                      key={`f-${m}`}
                                      label={MEDIUM_LABELS[m]}
                                      size="small"
                                      variant="outlined"
                                      sx={{
                                        bgcolor: '#fff',
                                        color: MEDIUM_CHIP_COLORS[m],
                                        borderColor: MEDIUM_CHIP_COLORS[m],
                                        fontWeight: 500,
                                        fontSize: '0.75rem',
                                      }}
                                    />
                                  ))}
                                </>
                              )}
                            </>
                          ) : action.actionType === 'refer-to-collections' && action.referToCollectionsConfig ? (
                            <Typography variant="body2" color="text.secondary">
                              {action.referToCollectionsConfig.minimumBalance > 0 &&
                                `when balance is greater than $${action.referToCollectionsConfig.minimumBalance}`}
                              {action.referToCollectionsConfig.minimumBalance > 0 &&
                                action.referToCollectionsConfig.agency &&
                                '\u00a0\u00a0'}
                              {action.referToCollectionsConfig.agency &&
                                `via ${action.referToCollectionsConfig.agency}`}
                            </Typography>
                          ) : (
                            ms.combined.length > 0 && (
                              <>
                                <Typography variant="body2" color="text.secondary">
                                  via
                                </Typography>
                                {ms.combined.map((m) => (
                                  <Chip
                                    key={m}
                                    label={MEDIUM_LABELS[m]}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      bgcolor: '#fff',
                                      color: MEDIUM_CHIP_COLORS[m],
                                      borderColor: MEDIUM_CHIP_COLORS[m],
                                      fontWeight: 500,
                                      fontSize: '0.75rem',
                                    }}
                                  />
                                ))}
                              </>
                            )
                          )}
                        </Stack>
                      </Paper>
                    </Stack>
                  );
                })()}
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
              <Button onClick={() => setDeleteConfirmAction(null)} sx={{ textTransform: 'none' }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => {
                  if (deleteConfirmAction) {
                    deleteAction(deleteConfirmAction.id);
                  }
                  setDeleteConfirmAction(null);
                }}
                sx={{ textTransform: 'none' }}
              >
                Delete
              </Button>
            </DialogActions>
          </Dialog>

          {/* ── Add Action Dialog ──────────────────────────────────────────── */}
          <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Add Outreach Action</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Trigger Event</InputLabel>
                  <Select
                    value={newTriggerEvent}
                    label="Trigger Event"
                    onChange={(e: SelectChangeEvent) => {
                      const ev = e.target.value as TriggerEvent;
                      setNewTriggerEvent(ev);
                      const allowed = ALLOWED_ACTIONS[ev];
                      if (!allowed.includes(newActionType)) setNewActionType(allowed[0]);
                      const timeUnits = ALLOWED_TIME_UNITS[ev];
                      if (!timeUnits.includes(newTimeUnit)) setNewTimeUnit(timeUnits[0]);
                      if (SUPPORTS_DIRECTION[ev]) setNewDirection('after');
                    }}
                  >
                    {(Object.keys(TRIGGER_EVENT_LABELS) as TriggerEvent[]).map((ev) => (
                      <MenuItem key={ev} value={ev}>
                        {TRIGGER_EVENT_LABELS[ev]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {SUPPORTS_DIRECTION[newTriggerEvent] && (
                  <FormControl size="small" fullWidth>
                    <InputLabel>Direction</InputLabel>
                    <Select
                      value={newDirection}
                      label="Direction"
                      onChange={(e: SelectChangeEvent) => setNewDirection(e.target.value as TriggerDirection)}
                    >
                      <MenuItem value="before">Before</MenuItem>
                      <MenuItem value="after">After</MenuItem>
                    </Select>
                  </FormControl>
                )}
                <Stack direction="row" spacing={2}>
                  <TextField
                    label={
                      SUPPORTS_DIRECTION[newTriggerEvent]
                        ? `${TIME_UNIT_LABELS[newTimeUnit]} ${DIRECTION_LABELS[newDirection]}`
                        : `${TIME_UNIT_LABELS[newTimeUnit]} After Event`
                    }
                    type="number"
                    size="small"
                    fullWidth
                    value={newDaysAfter}
                    onChange={(e) =>
                      setNewDaysAfter(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0))
                    }
                    inputProps={{ min: 0, ...numericFieldProps }}
                  />
                  {ALLOWED_TIME_UNITS[newTriggerEvent].length > 1 && (
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel>Time Unit</InputLabel>
                      <Select
                        value={newTimeUnit}
                        label="Time Unit"
                        onChange={(e: SelectChangeEvent) => setNewTimeUnit(e.target.value as TimeUnit)}
                      >
                        {ALLOWED_TIME_UNITS[newTriggerEvent].map((u) => (
                          <MenuItem key={u} value={u}>
                            {TIME_UNIT_LABELS[u]}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Stack>
                <FormControl size="small" fullWidth>
                  <InputLabel>Action Type</InputLabel>
                  <Select
                    value={newActionType}
                    label="Action Type"
                    sx={{ color: ACTION_CHIP_COLORS[newActionType], fontWeight: 500 }}
                    onChange={(e: SelectChangeEvent) => setNewActionType(e.target.value as ActionType)}
                  >
                    {ALLOWED_ACTIONS[newTriggerEvent].map((at) => (
                      <MenuItem key={at} value={at} sx={{ color: ACTION_CHIP_COLORS[at], fontWeight: 500 }}>
                        {ACTION_TYPE_LABELS[at]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAddDialogOpen(false)} sx={{ textTransform: 'none' }}>
                Cancel
              </Button>
              <Button variant="contained" onClick={handleAddAction} sx={{ textTransform: 'none' }}>
                Add
              </Button>
            </DialogActions>
          </Dialog>

          {/* ── Notification Settings Dialog ───────────────────────────────── */}
          <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>
              <Typography variant="h3" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                Patient Notification Settings
              </Typography>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={notificationsTimeRestrictionEnabled}
                      onChange={(e) => setNotificationsTimeRestrictionEnabled(e.target.checked)}
                    />
                  }
                  label="Restrict notifications to specific hours"
                />
                <Stack spacing={2} sx={{ ml: 4 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      label="Send after"
                      type="time"
                      size="small"
                      disabled={!notificationsTimeRestrictionEnabled}
                      value={smsAllowedAfter}
                      onChange={(e) => setSmsAllowedAfter(e.target.value)}
                      sx={{ width: 160 }}
                      inputProps={{ step: 900 }}
                    />
                    <TextField
                      label="Send before"
                      type="time"
                      size="small"
                      disabled={!notificationsTimeRestrictionEnabled}
                      value={smsAllowedBefore}
                      onChange={(e) => setSmsAllowedBefore(e.target.value)}
                      sx={{ width: 160 }}
                      inputProps={{ step: 900 }}
                    />
                  </Stack>
                  <FormControl size="small" sx={{ maxWidth: 300 }} disabled={!notificationsTimeRestrictionEnabled}>
                    <InputLabel>Timezone</InputLabel>
                    <Select
                      value={smsTimezone}
                      label="Timezone"
                      onChange={(e: SelectChangeEvent) => setSmsTimezone(e.target.value)}
                    >
                      <MenuItem value="America/New_York">Eastern (America/New_York)</MenuItem>
                      <MenuItem value="America/Chicago">Central (America/Chicago)</MenuItem>
                      <MenuItem value="America/Denver">Mountain (America/Denver)</MenuItem>
                      <MenuItem value="America/Los_Angeles">Pacific (America/Los_Angeles)</MenuItem>
                      <MenuItem value="America/Anchorage">Alaska (America/Anchorage)</MenuItem>
                      <MenuItem value="Pacific/Honolulu">Hawaii (Pacific/Honolulu)</MenuItem>
                      <MenuItem value="UTC">UTC</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary">
                    Notifications will only be sent between {smsAllowedAfter} and {smsAllowedBefore} in the selected
                    timezone. Messages outside this window will be queued until the next allowed time.
                  </Typography>
                </Stack>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSettingsDialogOpen(false)} sx={{ textTransform: 'none' }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  setSettingsDialogOpen(false);
                  saveActions(actions);
                }}
                sx={{ textTransform: 'none' }}
              >
                Done
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {outreachConfigData?.planDefinition?.id && <OutreachConfigId value={outreachConfigData.planDefinition.id} />}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// OutreachConfigId — copyable FHIR resource ID footer
// ---------------------------------------------------------------------------

function OutreachConfigId({ value }: { value: string }): ReactElement {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip title={copied ? 'Copied!' : 'Click to copy'}>
      <Typography
        variant="caption"
        color="text.disabled"
        onClick={handleCopy}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          mt: 3,
          cursor: 'pointer',
          userSelect: 'none',
          fontFamily: 'monospace',
        }}
      >
        Outreach Configuration ID: {value}
        {copied ? (
          <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} />
        ) : (
          <ContentCopyIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
        )}
      </Typography>
    </Tooltip>
  );
}
