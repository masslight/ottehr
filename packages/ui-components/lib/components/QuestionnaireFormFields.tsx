import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormHelperText,
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

// Evaluate an item's `enableWhen` against the current (flat) form values. Returns true when the
// item should be shown. Supports the operators the admin builder emits (=, !=, >, <, >=, <=,
// exists) and enableBehavior (all|any). Values here are the react-hook-form field values keyed by
// linkId — for `choice` items that is the selected option's code/valueString.
function evalItemEnableWhen(item: QuestionnaireItem, values: Record<string, any>): boolean {
  const enableWhen = (item as any).enableWhen as
    | Array<{
        question: string;
        operator: 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<=';
        answerBoolean?: boolean;
        answerString?: string;
        answerInteger?: number;
        answerDecimal?: number;
        answerCoding?: { code?: string };
      }>
    | undefined;
  if (!enableWhen || enableWhen.length === 0) return true;
  const behavior = ((item as any).enableBehavior as 'all' | 'any' | undefined) ?? 'all';

  const evalOne = (ew: (typeof enableWhen)[number]): boolean => {
    const actual = values[ew.question];
    if (ew.operator === 'exists') {
      const present = actual !== undefined && actual !== null && actual !== '';
      return ew.answerBoolean === false ? !present : present;
    }
    // Determine the expected value (whichever answer[x] is provided).
    const expected =
      ew.answerString ??
      ew.answerCoding?.code ??
      (ew.answerBoolean !== undefined ? ew.answerBoolean : undefined) ??
      ew.answerInteger ??
      ew.answerDecimal;
    if (expected === undefined) return true;

    if (ew.operator === '=') return String(actual) === String(expected);
    if (ew.operator === '!=') return String(actual) !== String(expected);

    // Numeric comparisons
    const a = Number(actual);
    const b = Number(expected);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    if (ew.operator === '>') return a > b;
    if (ew.operator === '<') return a < b;
    if (ew.operator === '>=') return a >= b;
    if (ew.operator === '<=') return a <= b;
    return true;
  };

  return behavior === 'any' ? enableWhen.some(evalOne) : enableWhen.every(evalOne);
}

export function isHiddenItem(item: QuestionnaireItem): boolean {
  const ext = getExtension(item.extension, 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden');
  return ext?.valueBoolean === true;
}

export function getCalculatedExpression(item: QuestionnaireItem): string | undefined {
  const ext = getExtension(
    item.extension,
    'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression'
  );
  if (ext?.valueExpression?.language === 'text/javascript') {
    return ext.valueExpression.expression;
  }
  return undefined;
}

/**
 * Evaluates all calculated expressions in a questionnaire against the current answers.
 * Returns a map of linkId → computed value for items with JavaScript calculated expressions.
 *
 * Choice answers come back from the form as strings (the option's valueCoding.code).
 * For scoring expressions (sums, comparisons), numeric strings must be coerced to
 * numbers — otherwise reduce((a,b)=>a+b) string-concatenates.
 */
export function evaluateCalculatedExpressions(
  items: QuestionnaireItem[],
  answers: Record<string, any>
): Record<string, any> {
  // Coerce numeric-string answers to numbers. Non-numeric strings (e.g. "female")
  // pass through unchanged so equality checks still work.
  const normalizedAnswers: Record<string, any> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
      normalizedAnswers[k] = Number(v);
    } else {
      normalizedAnswers[k] = v;
    }
  }

  const results: Record<string, any> = {};
  const allItems: QuestionnaireItem[] = [];

  // Flatten all items (including nested groups)
  const walk = (list: QuestionnaireItem[]): void => {
    for (const item of list) {
      allItems.push(item);
      if (item.item) walk(item.item);
    }
  };
  walk(items);

  // First pass: evaluate expressions that depend only on answers
  // Second pass: evaluate expressions that depend on other computed values
  // Two passes handles one level of dependency (computed item referencing another computed item)
  for (let pass = 0; pass < 2; pass++) {
    for (const item of allItems) {
      const expression = getCalculatedExpression(item);
      if (!expression) continue;

      try {
        // Build a combined context: normalized answers + previously computed results
        const context = { ...normalizedAnswers, ...results };
        const fn = new Function('answers', `with(answers) { return (${expression}); }`);
        results[item.linkId] = fn(context);
      } catch (e) {
        console.warn(`Failed to evaluate expression for ${item.linkId}:`, e);
      }
    }
  }

  return results;
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

/**
 * Prefix safe to show patients. Purely numeric prefixes are scoring artifacts on standard
 * instruments (e.g. "0" on "Not at all") and must not display — patients must never see
 * numeric scores on option labels.
 */
export function getDisplayOptionPrefix(option: any): string | undefined {
  const prefix = getOptionPrefix(option);
  if (prefix === undefined) return undefined;
  return /^\d+(\.\d+)?$/.test(String(prefix).trim()) ? undefined : prefix;
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

// ── QuestionnaireFormField ──────────────────────────────────────────────────

export interface QuestionnaireFormFieldProps {
  item: QuestionnaireItem;
  control: any;
}

export const QuestionnaireFormField: FC<QuestionnaireFormFieldProps> = ({ item, control }) => {
  const label = (
    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 16, color: COLORS.primaryMain, mb: 0.5 }}>
      {item.text}
      {item.required && <span style={{ color: '#EC6930' }}> *</span>}
    </Typography>
  );
  // Enforced at submit by react-hook-form; the asterisk alone validates nothing.
  // (Booleans are exempt: a required yes/no checkbox can't express an answered "no".)
  const requiredRule = item.required ? { required: 'This field is required' } : undefined;

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

      if (useDropdown) {
        return (
          <Box>
            {label}
            <Controller
              name={item.linkId}
              control={control}
              defaultValue=""
              rules={requiredRule}
              render={({ field, fieldState }) => (
                <>
                  <Select
                    {...field}
                    size="small"
                    fullWidth
                    displayEmpty
                    error={!!fieldState.error}
                    sx={{ borderRadius: '8px' }}
                  >
                    <MenuItem value="">Select...</MenuItem>
                    {options.map((opt: any, i: number) => {
                      const prefix = getDisplayOptionPrefix(opt);
                      const display = getOptionDisplay(opt);
                      const value = opt.valueCoding?.code || opt.valueString || '';
                      return (
                        <MenuItem key={i} value={value}>
                          {prefix !== undefined ? `${prefix}. ` : ''}
                          {display}
                        </MenuItem>
                      );
                    })}
                  </Select>
                  {fieldState.error && <FormHelperText error>{fieldState.error.message}</FormHelperText>}
                </>
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
            rules={requiredRule}
            render={({ field, fieldState }) => (
              <RadioGroup value={field.value} onChange={field.onChange}>
                {options.map((opt: any, i: number) => {
                  const prefix = getDisplayOptionPrefix(opt);
                  const display = getOptionDisplay(opt);
                  const value = opt.valueCoding?.code || opt.valueString || '';
                  const optLabel = `${prefix !== undefined ? `${prefix}. ` : ''}${display}`;
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
                {fieldState.error && <FormHelperText error>{fieldState.error.message}</FormHelperText>}
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
            rules={requiredRule}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                size="small"
                fullWidth
                multiline
                minRows={3}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                sx={inputSx}
              />
            )}
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
            rules={requiredRule}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                size="small"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
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
            rules={requiredRule}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                size="small"
                type="number"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                sx={inputSx}
              />
            )}
          />
        </Box>
      );

    case 'decimal':
      if (isScoreItem(item)) {
        // Score items never render to the patient (no visible numeric scores). Their value
        // is computed via calculatedExpressions and written to the QR on the final save.
        return null;
      }
      return (
        <Box>
          {label}
          <Controller
            name={item.linkId}
            control={control}
            defaultValue=""
            rules={requiredRule}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                size="small"
                type="number"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                sx={inputSx}
              />
            )}
          />
        </Box>
      );

    case 'display':
      return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          {item.text}
        </Typography>
      );

    case 'group':
      return (
        <Box sx={{ mb: 1 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              color: COLORS.primaryMain,
              mb: 1,
              borderBottom: '1px solid',
              borderColor: COLORS.border,
              pb: 0.5,
            }}
          >
            {item.text}
          </Typography>
          <Grid container spacing={2}>
            {(item.item || []).map((child) => (
              <Grid item xs={12} key={child.linkId}>
                <QuestionnaireFormField item={child} control={control} />
              </Grid>
            ))}
          </Grid>
        </Box>
      );

    default:
      return (
        <Box>
          {label}
          <Controller
            name={item.linkId}
            control={control}
            defaultValue=""
            rules={requiredRule}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                size="small"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                sx={inputSx}
              />
            )}
          />
        </Box>
      );
  }
};

// ── Helper: build pages from questionnaire items ────────────────────────────

// Recursively true when a group/page has any descendant that would render to
// the patient. Used to skip pages that are pure scoring containers (e.g. a
// final `results` group whose items are all hidden computed expressions).
function hasVisibleContent(item: QuestionnaireItem): boolean {
  if (isHiddenItem(item)) return false;
  if (item.type === 'group') return (item.item || []).some(hasVisibleContent);
  // display items only render if they have text
  if (item.type === 'display') return !!item.text;
  return true;
}

export function buildQuestionnairePages(items: QuestionnaireItem[], title?: string): QuestionnaireItem[] {
  const groups = items.filter((item) => item.type === 'group' && hasVisibleContent(item));
  if (groups.length > 0) return groups;
  const visibleNonGroup = items.filter((item) => item.type !== 'group' && hasVisibleContent(item));
  if (visibleNonGroup.length > 0) {
    return [{ linkId: '_all', type: 'group' as const, text: title, item: visibleNonGroup } as QuestionnaireItem];
  }
  return [];
}

// ── Helper: convert form data to QuestionnaireResponseItem ──────────────────

/**
 * Flatten a saved QuestionnaireResponse item tree back into form values keyed by linkId,
 * so reopening an in-progress form resumes instead of silently overwriting prior pages.
 */
export function responseItemsToFormValues(items: QuestionnaireResponseItem[] | undefined): Record<string, any> {
  const values: Record<string, any> = {};
  const walk = (list: QuestionnaireResponseItem[]): void => {
    for (const it of list) {
      const a = it.answer?.[0];
      if (a !== undefined) {
        if (a.valueCoding?.code !== undefined) values[it.linkId] = a.valueCoding.code;
        else if (a.valueBoolean !== undefined) values[it.linkId] = a.valueBoolean;
        else if (a.valueDecimal !== undefined) values[it.linkId] = String(a.valueDecimal);
        else if (a.valueInteger !== undefined) values[it.linkId] = String(a.valueInteger);
        else if (a.valueString !== undefined) values[it.linkId] = a.valueString;
      }
      if (it.item) walk(it.item);
    }
  };
  walk(items ?? []);
  return values;
}

/** Recursively index every descendant item of a page by linkId (groups can nest). */
function collectPageItems(
  items: QuestionnaireItem[],
  map: Map<string, QuestionnaireItem> = new Map()
): Map<string, QuestionnaireItem> {
  for (const item of items) {
    map.set(item.linkId, item);
    if (item.item) collectPageItems(item.item, map);
  }
  return map;
}

export function formDataToResponseItem(data: Record<string, any>, page: QuestionnaireItem): QuestionnaireResponseItem {
  // The RHF store holds values for EVERY page the patient has visited (values are
  // deliberately retained across pages so Back/Continue doesn't lose answers). Only
  // entries whose linkId belongs to THIS page may be written into this page's response
  // item — otherwise answers duplicate across page items and, because the source item
  // lookup fails for foreign linkIds, coded answers degrade to raw valueString codes.
  const itemsByLinkId = collectPageItems(page.item || []);
  return {
    linkId: page.linkId,
    item: Object.entries(data)
      .filter(([linkId, value]) => {
        const sourceItem = itemsByLinkId.get(linkId);
        if (!sourceItem || value === undefined || value === '') return false;
        // FHIR: answers to enableWhen-disabled items must not appear in the response —
        // a patient may answer a conditional question, then flip the controlling answer.
        return evalItemEnableWhen(sourceItem, data);
      })
      .map(([linkId, value]) => {
        const sourceItem = itemsByLinkId.get(linkId);
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
  // Watch all answers on this page so enableWhen conditions re-evaluate live as the user fills it
  // in. (Subscribing to the whole form is fine here — pages are small.)
  const watchedValues = useWatch({ control: methods.control });

  const items = (page.item || []).filter(
    (item) =>
      !isHiddenItem(item) &&
      (item.type !== 'display' || item.text) &&
      evalItemEnableWhen(item, (watchedValues as Record<string, any>) || {})
  );

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
              <QuestionnaireFormField item={item} control={methods.control} />
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
              color="primary"
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

  // Build raw answers for expression evaluation (linkId → numeric code)
  const rawAnswers = useMemo(() => {
    const raw: Record<string, any> = {};
    answerMap.forEach((answer, linkId) => {
      if (answer.valueCoding?.code) raw[linkId] = parseInt(answer.valueCoding.code, 10) || answer.valueCoding.code;
      else if (answer.valueString) raw[linkId] = answer.valueString;
      else if (answer.valueBoolean !== undefined) raw[linkId] = answer.valueBoolean;
      else if (answer.valueInteger !== undefined) raw[linkId] = answer.valueInteger;
      else if (answer.valueDecimal !== undefined) raw[linkId] = answer.valueDecimal;
    });
    return raw;
  }, [answerMap]);

  // Evaluate calculated expressions for computed items
  const computedValues = useMemo(
    () => evaluateCalculatedExpressions(questionnaire.item || [], rawAnswers),
    [questionnaire.item, rawAnswers]
  );

  // Calculate total score if there are scored items (sum-based like GAD-7)
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

  // Separate visible answer items from computed items.
  // Rationale items (linkId ending in -rationale) are rendered inline beneath their parent result.
  const answerItems = allItems.filter((item) => !isScoreItem(item) && !isHiddenItem(item));
  const computedItems = allItems.filter(
    (item) => isHiddenItem(item) && getCalculatedExpression(item) && !item.linkId.endsWith('-rationale')
  );
  const rationaleFor = (linkId: string): string | undefined => {
    const val = computedValues[`${linkId}-rationale`];
    return typeof val === 'string' && val.length > 0 ? val : undefined;
  };

  return (
    <Box>
      {answerItems.map((item) => {
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
      {computedItems.length > 0 && (
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: COLORS.border }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: COLORS.primaryMain, mb: 0.5 }}>
            Screening Results
          </Typography>
          {computedItems.map((item) => {
            const value = computedValues[item.linkId];
            if (value === undefined) return null;
            const displayValue = typeof value === 'boolean' ? (value ? 'Positive' : 'Negative') : String(value);
            const rationale = rationaleFor(item.linkId);
            return (
              <Box key={item.linkId} sx={{ py: 0.25 }}>
                <Typography variant="body2">
                  <Box component="span" sx={{ fontWeight: 600, color: COLORS.primaryMain }}>
                    {item.text}:
                  </Box>{' '}
                  <Box component="span" sx={{ color: value === true ? 'error.main' : 'success.main', fontWeight: 600 }}>
                    {displayValue}
                  </Box>
                </Typography>
                {rationale && (
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', color: COLORS.textSecondary, fontFamily: 'monospace', ml: 1 }}
                  >
                    {rationale}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
