import CalculateIcon from '@mui/icons-material/Calculate';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Grid,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { QuestionnaireItem, QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useMemo } from 'react';
import { Controller, FormProvider, UseFormReturn, useWatch } from 'react-hook-form';

// ── FHIR extension helpers ──────────────────────────────────────────────────

function getExtension(extensions: any[] | undefined, url: string): any | undefined {
  return extensions?.find((e: any) => e.url === url);
}

export function getItemControl(item: QuestionnaireItem): string | undefined {
  const ext = getExtension(item.extension, 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl');
  return ext?.valueCodeableConcept?.coding?.[0]?.code;
}

export function getOptionWeight(option: any): number | undefined {
  const ext = getExtension(option.extension, 'http://hl7.org/fhir/StructureDefinition/itemWeight');
  return ext?.valueDecimal;
}

export function getOptionPrefix(option: any): string | undefined {
  const ext = getExtension(option.extension, 'http://hl7.org/fhir/StructureDefinition/questionnaire-optionPrefix');
  return ext?.valueString;
}

export function getOptionDisplay(option: any): string {
  if (option.valueCoding?.display) return option.valueCoding.display;
  if (option.valueString) return option.valueString;
  return option.valueCoding?.code || 'Option';
}

export function isScoreItem(item: QuestionnaireItem): boolean {
  const unitExt = getExtension(item.extension, 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit');
  return unitExt?.valueCoding?.code === '{score}';
}

// ── Styling constants ───────────────────────────────────────────────────────

const COLORS = {
  primaryMain: '#0F347C',
  secondaryMain: '#2169F5',
  textPrimary: '#212130',
  textSecondary: '#4F4F4F',
  selectedBg: '#E2F0FF',
  border: '#E0E0E0',
  cardBg: '#F7F8F9',
};

const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: '8px' } };

// ── ScoreField ──────────────────────────────────────────────────────────────

const ScoreField: FC<{ item: QuestionnaireItem; siblingItems: QuestionnaireItem[]; control: any }> = ({
  item,
  siblingItems,
  control,
}) => {
  const choiceItems = siblingItems.filter(
    (s) => s.type === 'choice' && s.answerOption?.some((o: any) => getOptionWeight(o) !== undefined)
  );
  const choiceLinkIds = choiceItems.map((s) => s.linkId);
  const watchedValues = useWatch({ control, name: choiceLinkIds });

  const totalScore = useMemo(() => {
    let score = 0;
    choiceItems.forEach((ci, idx) => {
      const selectedValue = watchedValues?.[idx];
      if (!selectedValue) return;
      const matchingOpt = (ci.answerOption || []).find(
        (opt: any) => (opt.valueCoding?.code || opt.valueString) === selectedValue
      );
      if (matchingOpt) {
        const weight = getOptionWeight(matchingOpt);
        if (weight !== undefined) score += weight;
      }
    });
    return score;
  }, [choiceItems, watchedValues]);

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: COLORS.cardBg,
        borderRadius: '8px',
        border: '1px solid',
        borderColor: COLORS.border,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <CalculateIcon sx={{ color: COLORS.secondaryMain, fontSize: 28 }} />
      <Box sx={{ flex: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 600, color: COLORS.primaryMain }}>
          {item.text}
        </Typography>
        <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
          Total: <strong>{totalScore}</strong>
        </Typography>
      </Box>
      <Chip
        label={`${totalScore}`}
        sx={{ bgcolor: COLORS.secondaryMain, color: '#fff', fontWeight: 700, fontSize: 16 }}
      />
    </Box>
  );
};

// ── QuestionnaireFormField ──────────────────────────────────────────────────

export interface QuestionnaireFormFieldProps {
  item: QuestionnaireItem;
  control: any;
  siblingItems?: QuestionnaireItem[];
}

export const QuestionnaireFormField: FC<QuestionnaireFormFieldProps> = ({ item, control, siblingItems }) => {
  const label = (
    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 16, color: COLORS.primaryMain, mb: 0.5 }}>
      {item.text}
      {item.required && <span style={{ color: '#EC6930' }}> *</span>}
    </Typography>
  );

  switch (item.type) {
    case 'boolean':
      return (
        <Controller
          name={item.linkId}
          control={control}
          defaultValue={false}
          render={({ field }) => (
            <FormControlLabel control={<Checkbox {...field} checked={field.value || false} />} label={item.text} />
          )}
        />
      );

    case 'choice': {
      const itemControl = getItemControl(item);
      const useDropdown = itemControl === 'drop-down' || (item.answerOption?.length || 0) > 6;
      const options = item.answerOption || [];
      const hasWeights = options.some((opt: any) => getOptionWeight(opt) !== undefined);

      if (useDropdown) {
        return (
          <Box>
            {label}
            <Controller
              name={item.linkId}
              control={control}
              defaultValue=""
              render={({ field }) => (
                <Select {...field} size="small" fullWidth displayEmpty sx={{ borderRadius: '8px' }}>
                  <MenuItem value="">Select...</MenuItem>
                  {options.map((opt: any, i: number) => {
                    const prefix = getOptionPrefix(opt);
                    const display = getOptionDisplay(opt);
                    const weight = getOptionWeight(opt);
                    const value = opt.valueCoding?.code || opt.valueString || '';
                    return (
                      <MenuItem key={i} value={value}>
                        {prefix !== undefined ? `${prefix}. ` : ''}
                        {display}
                        {hasWeights && weight !== undefined ? ` (${weight})` : ''}
                      </MenuItem>
                    );
                  })}
                </Select>
              )}
            />
          </Box>
        );
      }

      return (
        <Box>
          {label}
          <Controller
            name={item.linkId}
            control={control}
            defaultValue=""
            render={({ field }) => (
              <RadioGroup value={field.value} onChange={field.onChange}>
                {options.map((opt: any, i: number) => {
                  const prefix = getOptionPrefix(opt);
                  const display = getOptionDisplay(opt);
                  const weight = getOptionWeight(opt);
                  const value = opt.valueCoding?.code || opt.valueString || '';
                  const optLabel = `${prefix !== undefined ? `${prefix}. ` : ''}${display}${
                    hasWeights && weight !== undefined ? ` (${weight})` : ''
                  }`;
                  const isSelected = field.value === value;
                  return (
                    <Box
                      key={i}
                      sx={{
                        border: '1px solid',
                        borderColor: isSelected ? COLORS.secondaryMain : COLORS.border,
                        borderRadius: '8px',
                        minHeight: 46,
                        px: 2,
                        py: 1,
                        mb: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        bgcolor: isSelected ? COLORS.selectedBg : '#fff',
                        cursor: 'pointer',
                      }}
                      onClick={() => field.onChange(value)}
                    >
                      <Radio
                        checked={isSelected}
                        size="small"
                        icon={<RadioButtonUncheckedIcon sx={{ fontSize: 24, color: COLORS.border }} />}
                        checkedIcon={<RadioButtonCheckedIcon sx={{ fontSize: 24, color: COLORS.secondaryMain }} />}
                        sx={{ p: 0.5, mr: 1 }}
                        value={value}
                      />
                      <Typography variant="body1" sx={{ fontWeight: 500, color: COLORS.textPrimary }}>
                        {optLabel}
                      </Typography>
                    </Box>
                  );
                })}
              </RadioGroup>
            )}
          />
        </Box>
      );
    }

    case 'text':
      return (
        <Box>
          {label}
          <Controller
            name={item.linkId}
            control={control}
            defaultValue=""
            render={({ field }) => <TextField {...field} size="small" fullWidth multiline minRows={3} sx={inputSx} />}
          />
        </Box>
      );

    case 'date':
      return (
        <Box>
          {label}
          <Controller
            name={item.linkId}
            control={control}
            defaultValue=""
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                sx={inputSx}
              />
            )}
          />
        </Box>
      );

    case 'integer':
      return (
        <Box>
          {label}
          <Controller
            name={item.linkId}
            control={control}
            defaultValue=""
            render={({ field }) => <TextField {...field} size="small" type="number" fullWidth sx={inputSx} />}
          />
        </Box>
      );

    case 'decimal':
      if (isScoreItem(item) && siblingItems) {
        return <ScoreField item={item} siblingItems={siblingItems} control={control} />;
      }
      return (
        <Box>
          {label}
          <Controller
            name={item.linkId}
            control={control}
            defaultValue=""
            render={({ field }) => <TextField {...field} size="small" type="number" fullWidth sx={inputSx} />}
          />
        </Box>
      );

    case 'display':
      return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          {item.text}
        </Typography>
      );

    default:
      return (
        <Box>
          {label}
          <Controller
            name={item.linkId}
            control={control}
            defaultValue=""
            render={({ field }) => <TextField {...field} size="small" fullWidth sx={inputSx} />}
          />
        </Box>
      );
  }
};

// ── Helper: build pages from questionnaire items ────────────────────────────

export function buildQuestionnairePages(items: QuestionnaireItem[], title?: string): QuestionnaireItem[] {
  const groups = items.filter((item) => item.type === 'group');
  if (groups.length > 0) return groups;
  if (items.length > 0) {
    return [{ linkId: '_all', type: 'group' as const, text: title, item: items } as QuestionnaireItem];
  }
  return [];
}

// ── Helper: convert form data to QuestionnaireResponseItem ──────────────────

export function formDataToResponseItem(data: Record<string, any>, page: QuestionnaireItem): QuestionnaireResponseItem {
  const pageItems = page.item || [];
  return {
    linkId: page.linkId,
    item: Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([linkId, value]) => {
        const sourceItem = pageItems.find((pi) => pi.linkId === linkId);
        if (sourceItem?.type === 'choice' && typeof value === 'string') {
          const matchingOpt = (sourceItem.answerOption || []).find((opt: any) => opt.valueCoding?.code === value);
          if (matchingOpt?.valueCoding) {
            return { linkId, answer: [{ valueCoding: matchingOpt.valueCoding }] };
          }
        }
        return {
          linkId,
          answer: [typeof value === 'boolean' ? { valueBoolean: value } : { valueString: String(value) }],
        };
      }),
  };
}

// ── QuestionnaireFormPage: renders a single page of items with nav ───────────

export interface QuestionnaireFormPageProps {
  page: QuestionnaireItem;
  title?: string;
  subtitle?: string;
  methods: UseFormReturn<any>;
  onSubmit: (data: Record<string, any>) => void;
  onBack?: () => void;
  isLastPage?: boolean;
  saving?: boolean;
  submitLabel?: string;
}

export const QuestionnaireFormPage: FC<QuestionnaireFormPageProps> = ({
  page,
  title,
  subtitle,
  methods,
  onSubmit,
  onBack,
  isLastPage,
  saving,
  submitLabel,
}) => {
  const items = (page.item || []).filter((item) => item.type !== 'display' || item.text);

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {title && (
          <Typography variant="h5" sx={{ color: COLORS.primaryMain, fontWeight: 700, mb: 0.5 }}>
            {title}
          </Typography>
        )}
        {subtitle && (
          <Typography variant="body2" sx={{ color: COLORS.secondaryMain, fontSize: 14, mb: 3 }}>
            {subtitle}
          </Typography>
        )}

        <Grid container spacing={2}>
          {items.map((item) => (
            <Grid item xs={12} key={item.linkId}>
              <QuestionnaireFormField item={item} control={methods.control} siblingItems={page.item || []} />
            </Grid>
          ))}
        </Grid>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mt: 4,
            pt: 2,
            borderTop: '1px solid',
            borderColor: COLORS.border,
          }}
        >
          {onBack ? (
            <Button
              variant="outlined"
              color="secondary"
              size="large"
              onClick={onBack}
              sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
            >
              Back
            </Button>
          ) : (
            <Box />
          )}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={saving}
            sx={{
              borderRadius: '50px',
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: COLORS.secondaryMain,
              px: 4,
              '&:hover': { bgcolor: COLORS.primaryMain },
            }}
          >
            {saving ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              submitLabel || (isLastPage ? 'Submit' : 'Continue')
            )}
          </Button>
        </Box>
      </form>
    </FormProvider>
  );
};

// ── QuestionnaireResponseViewer: read-only display of completed responses ────

export interface QuestionnaireResponseViewerProps {
  /** The questionnaire definition (with items, answerOptions, extensions) */
  questionnaire: { item?: QuestionnaireItem[]; title?: string };
  /** The completed response items */
  responseItems: QuestionnaireResponseItem[];
}

export const QuestionnaireResponseViewer: FC<QuestionnaireResponseViewerProps> = ({ questionnaire, responseItems }) => {
  // Build a flat map of linkId → answer from the response
  const answerMap = useMemo(() => {
    const map = new Map<string, any>();
    const walkItems = (items: QuestionnaireResponseItem[]): void => {
      for (const item of items) {
        if (item.answer && item.answer.length > 0) {
          map.set(item.linkId, item.answer[0]);
        }
        if (item.item) walkItems(item.item);
      }
    };
    walkItems(responseItems);
    return map;
  }, [responseItems]);

  // Flatten questionnaire items (handle both grouped and flat)
  const allItems = useMemo(() => {
    const items = questionnaire.item || [];
    const flat: QuestionnaireItem[] = [];
    const walk = (list: QuestionnaireItem[]): void => {
      for (const item of list) {
        if (item.type === 'group' && item.item) {
          walk(item.item);
        } else {
          flat.push(item);
        }
      }
    };
    walk(items);
    return flat;
  }, [questionnaire.item]);

  // Calculate total score if there are scored items
  const totalScore = useMemo(() => {
    let hasScoring = false;
    let score = 0;
    for (const item of allItems) {
      if (isScoreItem(item)) {
        hasScoring = true;
        continue;
      }
      if (item.type !== 'choice' || !item.answerOption) continue;
      const hasWeights = item.answerOption.some((o: any) => getOptionWeight(o) !== undefined);
      if (!hasWeights) continue;
      hasScoring = true;

      const answer = answerMap.get(item.linkId);
      if (!answer) continue;
      const selectedCode = answer.valueCoding?.code || answer.valueString;
      if (!selectedCode) continue;

      const matchingOpt = item.answerOption.find((o: any) => (o.valueCoding?.code || o.valueString) === selectedCode);
      if (matchingOpt) {
        const weight = getOptionWeight(matchingOpt);
        if (weight !== undefined) score += weight;
      }
    }
    return hasScoring ? score : null;
  }, [allItems, answerMap]);

  return (
    <Box>
      {allItems
        .filter((item) => !isScoreItem(item))
        .map((item) => {
          const answer = answerMap.get(item.linkId);
          if (!answer) return null;

          let displayValue = '';
          if (answer.valueCoding?.display) {
            displayValue = answer.valueCoding.display;
          } else if (answer.valueString) {
            displayValue = answer.valueString;
          } else if (answer.valueBoolean !== undefined) {
            displayValue = answer.valueBoolean ? 'Yes' : 'No';
          } else if (answer.valueInteger !== undefined) {
            displayValue = String(answer.valueInteger);
          } else if (answer.valueDecimal !== undefined) {
            displayValue = String(answer.valueDecimal);
          } else if (answer.valueDate) {
            displayValue = answer.valueDate;
          }

          if (!displayValue) return null;

          return (
            <Box key={item.linkId} sx={{ py: 0.5 }}>
              <Typography variant="body2">
                <Box component="span" sx={{ fontWeight: 600, color: COLORS.primaryMain }}>
                  {item.text}:
                </Box>{' '}
                {displayValue}
              </Typography>
            </Box>
          );
        })}
      {totalScore !== null && (
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: COLORS.border }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: COLORS.primaryMain }}>
            Total Score: {totalScore}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
