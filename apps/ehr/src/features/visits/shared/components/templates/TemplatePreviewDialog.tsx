import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { LoadingButton } from '@mui/lab';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { getTemplateDetail } from 'src/api/api';
import { ContainedPrimaryToggleButton } from 'src/components/ContainedPrimaryToggleButton';
import { formatCptCodeAndModifiersForDisplay, getProcedureDisplayFields } from 'src/helpers/templates';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  AdminGetTemplateDetailOutput,
  buildExamFieldToSectionMap,
  isTemplateCptCodeInfo,
  RosFindingState,
  RosFindingStateLabel,
  TEMPLATE_SECTION_DEFAULT_ACTIONS,
  TEMPLATE_SECTIONS_IN_ORDER,
  TEMPLATE_SECTIONS_NO_APPEND,
  TEMPLATE_SECTIONS_NO_OVERWRITE,
  TemplateCptCodeInfo,
  TemplateInHouseLabPlanDetail,
  TemplateProcedurePlan,
  TemplateSectionAction,
  TemplateSectionActions,
  TemplateSectionDescriptor,
  TemplateSectionKey,
} from 'utils';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';

// Maps an exam field name (e.g. "soft", "tender") to the body-system section it
// belongs to ("Abdomen"). Built once at module load from
// `DefaultExamComponentsConfig` so the preview can group finding chips under their
// owning section header.
const DEFAULT_EXAM_FIELD_TO_SECTION = buildExamFieldToSectionMap(DefaultExamComponentsConfig);

const EXAM_SECTION_KEYS_IN_ORDER = Object.keys(DefaultExamComponentsConfig);

const EXAM_OTHER_SECTION_KEY = '__other__';

interface TemplatePreviewDialogProps {
  open: boolean;
  templateId: string | null;
  templateName: string;
  isApplying: boolean;
  onCancel: () => void;
  onApply: (actions: TemplateSectionActions) => void;
}

const ACTION_LABELS: Record<TemplateSectionAction, string> = {
  skip: 'Skip',
  append: 'Append',
  overwrite: 'Overwrite',
};

const ACTION_TOOLTIPS: Record<TemplateSectionAction, string> = {
  skip: "Don't apply this section.",
  append: 'Keep existing content and add the template content.',
  overwrite: 'Replace existing content with the template content.',
};

// Per-section overrides for the action tooltips. Used when a section's append/overwrite
// semantics diverge from the generic copy - e.g. ROS append keeps the existing note text
// but still replaces the structured findings, which the default tooltip doesn't convey.
const SECTION_ACTION_TOOLTIP_OVERRIDES: Partial<
  Record<TemplateSectionKey, Partial<Record<TemplateSectionAction, string>>>
> = {
  ros: {
    append: 'Add the template note to your existing note. Structured ROS findings will be replaced by the template.',
  },
};

const getActionTooltip = (sectionKey: TemplateSectionKey, action: TemplateSectionAction): string =>
  SECTION_ACTION_TOOLTIP_OVERRIDES[sectionKey]?.[action] ?? ACTION_TOOLTIPS[action];

const truncate = (s: string, n = 80): string => {
  const collapsed = s.replace(/\s+/g, ' ').trim();
  return collapsed.length <= n ? collapsed : `${collapsed.slice(0, n).trim()}…`;
};

const pluralize = (n: number, singular: string, plural = `${singular}s`): string =>
  `${n} ${n === 1 ? singular : plural}`;

// the slices are because we show the names of the first two items "+ n more"
const NUM_ITEMS_IN_SECTION_TO_SHOW = 2;
const getSectionSummary = (sections: AdminGetTemplateDetailOutput['sections'], key: TemplateSectionKey): string => {
  switch (key) {
    case 'hpi':
      return sections.hpiNote ? truncate(sections.hpiNote) : '';
    case 'moi':
      return sections.moiNote ? truncate(sections.moiNote) : '';
    case 'ros': {
      const parts: string[] = [];
      if (sections.rosNote) parts.push(`note: "${truncate(sections.rosNote, 40)}"`);
      if (sections.rosFindings.length > 0) parts.push(pluralize(sections.rosFindings.length, 'finding'));
      return parts.join(' · ');
    }
    case 'examFindings': {
      const abnormal = sections.examFindings.filter((f) => f.isAbnormal).length;
      const normal = sections.examFindings.length - abnormal;
      const parts: string[] = [];
      if (abnormal) parts.push(`${abnormal} abnormal`);
      if (normal) parts.push(`${normal} normal`);
      return parts.join(', ');
    }
    case 'mdm':
      return sections.mdm ? truncate(sections.mdm) : '';
    case 'diagnoses': {
      const codes = sections.diagnoses
        .slice(0, NUM_ITEMS_IN_SECTION_TO_SHOW)
        .map((d) => d.code)
        .join(', ');
      const extra = sections.diagnoses.length - NUM_ITEMS_IN_SECTION_TO_SHOW;
      return extra > 0 ? `${codes} +${extra} more` : codes;
    }
    case 'patientInstructions':
      return pluralize(sections.patientInstructions.length, 'instruction');
    case 'cptCodes': {
      const codes = sections.cptCodes
        .slice(0, NUM_ITEMS_IN_SECTION_TO_SHOW)
        .map((c) => c.code)
        .join(', ');
      const extra = sections.cptCodes.length - NUM_ITEMS_IN_SECTION_TO_SHOW;
      return extra > 0 ? `${codes} +${extra} more` : codes;
    }
    case 'emCode':
      return sections.emCode ? sections.emCode.code : '';
    case 'inHouseLabs': {
      const names = sections.inHouseLabs
        .slice(0, NUM_ITEMS_IN_SECTION_TO_SHOW)
        .map((p) => p.testName)
        .join(', ');
      const extra = sections.inHouseLabs.length - NUM_ITEMS_IN_SECTION_TO_SHOW;
      const summary = extra > 0 ? `${names} +${extra} more` : names;
      const missing = sections.inHouseLabs.filter((p) => p.missing).length;
      return missing > 0 ? `${summary} (${missing} unavailable)` : summary;
    }
    case 'procedures': {
      // Use whatever short label we have for each plan: procedureType code if
      // it's there, otherwise fall back to the first CPT code so the summary
      // still says something concrete. "Unnamed procedure" is a last resort for
      // very sparse template entries.
      const labels = sections.procedures
        .slice(0, NUM_ITEMS_IN_SECTION_TO_SHOW)
        .map((p) => p.procedureType ?? p.cptCodes[0]?.code ?? 'Unnamed procedure');
      const extra = sections.procedures.length - NUM_ITEMS_IN_SECTION_TO_SHOW;
      return extra > 0 ? `${labels.join(', ')} +${extra} more` : labels.join(', ');
    }
    default:
      return '';
  }
};

const sectionHasContent = (sections: AdminGetTemplateDetailOutput['sections'], key: TemplateSectionKey): boolean => {
  switch (key) {
    case 'hpi':
      return Boolean(sections.hpiNote);
    case 'moi':
      return Boolean(sections.moiNote);
    case 'ros':
      return Boolean(sections.rosNote) || sections.rosFindings.length > 0;
    case 'examFindings':
      return sections.examFindings.length > 0;
    case 'mdm':
      return Boolean(sections.mdm);
    case 'diagnoses':
      return sections.diagnoses.length > 0;
    case 'patientInstructions':
      return sections.patientInstructions.length > 0;
    case 'cptCodes':
      return sections.cptCodes.length > 0;
    case 'emCode':
      return Boolean(sections.emCode);
    case 'inHouseLabs':
      return sections.inHouseLabs.length > 0;
    case 'procedures':
      return sections.procedures.length > 0;
    default:
      return false;
  }
};

// Strip leading/trailing whitespace so section bodies render flush with the top of
// the collapse area regardless of how a provider entered the template text.
const stripOuterWhitespace = (s: string): string => s.replace(/^\s+|\s+$/g, '');

const TextBlock: React.FC<{ value: string | null | undefined }> = ({ value }) => {
  if (!value) return null;
  return (
    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary' }}>
      {stripOuterWhitespace(value)}
    </Typography>
  );
};

const CodeList: React.FC<{ items: { code: string; display: string }[] | TemplateCptCodeInfo[] }> = ({ items }) => (
  <Stack spacing={0.5}>
    {items.map((item, idx) => (
      <Typography key={`${item.code}-${idx}`} variant="body2" sx={{ color: 'text.primary' }}>
        {isTemplateCptCodeInfo(item) ? (
          <strong>{formatCptCodeAndModifiersForDisplay(item)}</strong>
        ) : (
          <strong>{item.code}</strong>
        )}
        {item.display ? ` — ${item.display}` : ''}
      </Typography>
    ))}
  </Stack>
);

const SectionPreview: React.FC<{
  sectionKey: TemplateSectionKey;
  sections: AdminGetTemplateDetailOutput['sections'];
}> = ({ sectionKey, sections }) => {
  switch (sectionKey) {
    case 'hpi':
      return <TextBlock value={sections.hpiNote} />;
    case 'moi':
      return <TextBlock value={sections.moiNote} />;
    case 'ros': {
      const reported = sections.rosFindings.filter((f) => f.findingState === RosFindingState.Reports);
      const denied = sections.rosFindings.filter((f) => f.findingState === RosFindingState.Denies);
      return (
        <Stack spacing={1}>
          {sections.rosNote ? (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
                Note
              </Typography>
              <TextBlock value={sections.rosNote} />
            </Box>
          ) : null}
          {reported.length > 0 ? (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
                {RosFindingStateLabel[RosFindingState.Reports]}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                {reported.map((f) => (
                  <Chip key={f.fieldName} label={f.label} size="small" color="warning" />
                ))}
              </Stack>
            </Box>
          ) : null}
          {denied.length > 0 ? (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
                {RosFindingStateLabel[RosFindingState.Denies]}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                {denied.map((f) => (
                  <Chip key={f.fieldName} label={f.label} size="small" variant="outlined" />
                ))}
              </Stack>
            </Box>
          ) : null}
        </Stack>
      );
    }
    case 'examFindings': {
      // Group findings by body-system section so each chip is anchored under a
      // header like "Abdomen". Anything whose fieldName isn't in the exam config
      // (e.g. comment fields with custom keys) falls into an "Other" bucket.
      const groupedByKey = new Map<string, typeof sections.examFindings>();
      for (const finding of sections.examFindings) {
        const info = DEFAULT_EXAM_FIELD_TO_SECTION.get(finding.fieldName);
        const key = info?.sectionKey ?? EXAM_OTHER_SECTION_KEY;
        const existing = groupedByKey.get(key);
        if (existing) existing.push(finding);
        else groupedByKey.set(key, [finding]);
      }

      const orderedKeys = [
        ...EXAM_SECTION_KEYS_IN_ORDER.filter((k) => groupedByKey.has(k)),
        ...(groupedByKey.has(EXAM_OTHER_SECTION_KEY) ? [EXAM_OTHER_SECTION_KEY] : []),
      ];

      return (
        <Stack spacing={1.5}>
          {orderedKeys.map((key) => {
            const findings = groupedByKey.get(key)!;
            const label =
              key === EXAM_OTHER_SECTION_KEY
                ? 'Other'
                : DEFAULT_EXAM_FIELD_TO_SECTION.get(findings[0].fieldName)?.sectionLabel ?? key;
            return (
              <Box key={key}>
                <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
                  {label}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                  {findings.map((f) => (
                    <Chip
                      key={f.fieldName}
                      label={f.note ? `${f.label}: ${f.note}` : f.label}
                      size="small"
                      color={f.isAbnormal ? 'warning' : undefined}
                      variant={f.isAbnormal ? 'filled' : 'outlined'}
                    />
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      );
    }
    case 'mdm':
      return <TextBlock value={sections.mdm} />;
    case 'diagnoses':
      return <CodeList items={sections.diagnoses} />;
    case 'patientInstructions':
      return (
        <Stack spacing={1.5}>
          {sections.patientInstructions.map((item, idx) => (
            <Box key={idx}>
              {item.title ? (
                <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>
                  {item.title}
                </Typography>
              ) : null}
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary' }}>
                {stripOuterWhitespace(item.text)}
              </Typography>
            </Box>
          ))}
        </Stack>
      );
    case 'cptCodes':
      return <CodeList items={sections.cptCodes} />;
    case 'emCode':
      return sections.emCode ? <CodeList items={[sections.emCode]} /> : null;
    case 'inHouseLabs':
      return <InHouseLabPlansList plans={sections.inHouseLabs} />;
    case 'procedures':
      return <ProcedurePlansList plans={sections.procedures} />;
    default:
      return null;
  }
};

// Each plan renders as a row with the test name and any reasonCode ICDs as
// little chips below. Plans whose ActivityDefinition couldn't be resolved on
// this environment render muted so the provider knows they'll be skipped at
// apply-time.
const InHouseLabPlansList: React.FC<{ plans: TemplateInHouseLabPlanDetail[] }> = ({ plans }) => (
  <Stack spacing={1.5}>
    {plans.map((plan) => (
      <Box key={plan.planId} sx={{ opacity: plan.missing ? 0.55 : 1 }}>
        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
          {plan.testName}
          {plan.missing ? (
            <Typography component="span" variant="caption" sx={{ ml: 1, color: 'warning.main', fontStyle: 'italic' }}>
              unavailable in this environment — will be skipped
            </Typography>
          ) : null}
        </Typography>
        {plan.diagnoses.length > 0 ? (
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
            {plan.diagnoses.map((d, idx) => (
              <Chip
                key={`${plan.planId}-dx-${idx}`}
                size="small"
                variant="outlined"
                label={d.display ? `${d.code} — ${d.display}` : d.code}
              />
            ))}
          </Stack>
        ) : null}
        {plan.cptCodes.length > 0 ? (
          // CPT codes are surfaced here so providers see what the lab section
          // delivers. If the same CPT also appears in the CPT Codes section,
          // apply-template dedupes - whichever section is appended wins, both
          // appended produces one Procedure not two.
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
            {plan.cptCodes.map((c, idx) => (
              <Chip
                key={`${plan.planId}-cpt-${idx}`}
                size="small"
                variant="outlined"
                color="primary"
                label={`CPT ${formatCptCodeAndModifiersForDisplay(c)}${c.display ? ` — ${c.display}` : ''}`}
              />
            ))}
          </Stack>
        ) : null}
        {plan.notes.length > 0 ? (
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.5, color: 'text.secondary', whiteSpace: 'pre-wrap' }}
          >
            Notes: {plan.notes.join('\n\n')}
          </Typography>
        ) : null}
      </Box>
    ))}
  </Stack>
);

// Procedure cards show the procedure type as a clear subheading, then a
// left-indented block of details: labeled CPT and diagnosis lists (with the
// uppercase-caption section labels the ROS preview uses, so the codes
// underneath visibly belong to them) and the form-field rows. We only render
// fields the template actually carried - the procedure form has a lot of
// optional inputs and a template that didn't fill them in would look noisy
// with a wall of empty rows.
const ProcedurePlansList: React.FC<{ plans: TemplateProcedurePlan[] }> = ({ plans }) => (
  <Stack spacing={2}>
    {plans.map((plan) => (
      <Box key={plan.planId}>
        <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
          {plan.procedureType ?? plan.cptCodes[0]?.display ?? plan.cptCodes[0]?.code ?? 'Procedure'}
        </Typography>
        <Stack spacing={1} sx={{ mt: 0.5, pl: 2 }}>
          {plan.cptCodes.length > 0 ? (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
                CPT codes
              </Typography>
              <CodeList items={plan.cptCodes} />
            </Box>
          ) : null}
          {plan.diagnoses.length > 0 ? (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
                Diagnoses
              </Typography>
              <CodeList items={plan.diagnoses} />
            </Box>
          ) : null}
          <ProcedurePlanFields plan={plan} />
        </Stack>
      </Box>
    ))}
  </Stack>
);

// Renders the procedure form fields as a compact label/value list, with the
// `multiline` flag selecting whiteSpace: pre-wrap so free-text fields wrap
// cleanly without being forced onto their own line for short values.
const ProcedurePlanFields: React.FC<{ plan: TemplateProcedurePlan }> = ({ plan }) => {
  const fields = getProcedureDisplayFields(plan);
  if (fields.length === 0) return null;
  return (
    <Stack spacing={0.75}>
      {fields.map((f) => (
        <Typography
          key={f.label}
          variant="body2"
          sx={{ color: 'text.primary', ...(f.multiline ? { whiteSpace: 'pre-wrap' } : {}) }}
        >
          <strong>{f.label}:</strong> {f.value}
        </Typography>
      ))}
    </Stack>
  );
};

const SectionCard: React.FC<{
  descriptor: TemplateSectionDescriptor;
  sections: AdminGetTemplateDetailOutput['sections'];
  action: TemplateSectionAction;
  onActionChange: (action: TemplateSectionAction) => void;
  disabled: boolean;
}> = ({ descriptor, sections, action, onActionChange, disabled }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const noAppend = TEMPLATE_SECTIONS_NO_APPEND.has(descriptor.key);
  const noOverwrite = TEMPLATE_SECTIONS_NO_OVERWRITE.has(descriptor.key);
  const summary = getSectionSummary(sections, descriptor.key);

  const previewSx = {
    opacity: action === 'skip' ? 0.5 : 1,
    transition: 'opacity 120ms ease-in-out',
  };

  return (
    <Box
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        overflow: 'hidden',
      }}
      data-testid={`template-section-${descriptor.key}`}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={`template-section-${descriptor.key}-body`}
        data-testid={`template-section-${descriptor.key}-header`}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.5,
          py: 1,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { backgroundColor: theme.palette.action.hover },
        }}
      >
        <IconButton
          size="small"
          aria-label={expanded ? 'Collapse section' : 'Expand section'}
          sx={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease-in-out',
          }}
          tabIndex={-1}
        >
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.3, color: 'primary.dark' }}
          >
            {descriptor.label}
          </Typography>
          {summary ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}
            >
              {summary}
            </Typography>
          ) : null}
        </Box>
        <Box onClick={(e) => e.stopPropagation()} sx={{ flexShrink: 0 }}>
          <ToggleButtonGroup
            value={action}
            exclusive
            size="small"
            onChange={(_, next: TemplateSectionAction | null) => {
              if (next) onActionChange(next);
            }}
            disabled={disabled}
            aria-label={`Action for ${descriptor.label}`}
          >
            <ContainedPrimaryToggleButton value="skip" title={getActionTooltip(descriptor.key, 'skip')}>
              {ACTION_LABELS.skip}
            </ContainedPrimaryToggleButton>
            {noAppend ? null : (
              <ContainedPrimaryToggleButton value="append" title={getActionTooltip(descriptor.key, 'append')}>
                {ACTION_LABELS.append}
              </ContainedPrimaryToggleButton>
            )}
            {noOverwrite ? null : (
              <ContainedPrimaryToggleButton value="overwrite" title={getActionTooltip(descriptor.key, 'overwrite')}>
                {ACTION_LABELS.overwrite}
              </ContainedPrimaryToggleButton>
            )}
          </ToggleButtonGroup>
        </Box>
      </Box>
      <Collapse in={expanded} unmountOnExit>
        <Box
          id={`template-section-${descriptor.key}-body`}
          sx={{ px: 2, pb: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}`, ...previewSx }}
        >
          <SectionPreview sectionKey={descriptor.key} sections={sections} />
        </Box>
      </Collapse>
    </Box>
  );
};

export const TemplatePreviewDialog: React.FC<TemplatePreviewDialogProps> = ({
  open,
  templateId,
  templateName,
  isApplying,
  onCancel,
  onApply,
}) => {
  const { oystehrZambda } = useApiClients();
  const [actions, setActions] = useState<Record<TemplateSectionKey, TemplateSectionAction>>({
    ...TEMPLATE_SECTION_DEFAULT_ACTIONS,
  });

  const detailQuery = useQuery({
    queryKey: ['admin-get-template-detail', templateId],
    enabled: open && !!templateId && !!oystehrZambda,
    queryFn: async () => {
      if (!oystehrZambda || !templateId) throw new Error('API client or templateId not available');
      return getTemplateDetail(oystehrZambda, { templateId });
    },
  });

  useEffect(() => {
    if (open) {
      setActions({ ...TEMPLATE_SECTION_DEFAULT_ACTIONS });
    }
  }, [open, templateId]);

  const sectionsWithContent = useMemo(() => {
    if (!detailQuery.data) return [];
    return TEMPLATE_SECTIONS_IN_ORDER.filter((s) => sectionHasContent(detailQuery.data.sections, s.key));
  }, [detailQuery.data]);

  const handleActionChange = (key: TemplateSectionKey, action: TemplateSectionAction): void => {
    setActions((prev) => ({ ...prev, [key]: action }));
  };

  const handleApply = (): void => {
    // Build a complete action map covering every known section key. Sections the
    // template doesn't carry content for - and therefore weren't shown to the user -
    // are explicitly set to 'skip'. Without this, the server's default action map
    // would fill those keys with their per-section defaults (e.g. examFindings,
    // patientInstructions default to 'overwrite'), which would silently delete the
    // user's existing chart data for sections they never saw a control for.
    const payload: TemplateSectionActions = {};
    const visibleKeys = new Set(sectionsWithContent.map((s) => s.key));
    for (const key of Object.keys(TEMPLATE_SECTION_DEFAULT_ACTIONS) as TemplateSectionKey[]) {
      payload[key] = visibleKeys.has(key) ? actions[key] : 'skip';
    }
    onApply(payload);
  };

  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  const allSkipped = sectionsWithContent.length > 0 && sectionsWithContent.every((s) => actions[s.key] === 'skip');

  return (
    <Dialog
      open={open}
      onClose={isApplying ? undefined : onCancel}
      disableScrollLock
      maxWidth="md"
      fullWidth
      sx={{
        '.MuiPaper-root': {
          padding: 2,
        },
      }}
    >
      <DialogTitle variant="h4" color="primary.dark">
        Apply Template: {templateName}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ color: 'text.primary', mb: 2 }}>
          Review what will be applied and choose how each section should be merged with the current note.
        </Typography>
        {detailQuery.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : detailQuery.error ? (
          <Alert severity="error">
            Failed to load template preview: {(detailQuery.error as Error).message ?? 'Unknown error'}
          </Alert>
        ) : sectionsWithContent.length === 0 ? (
          <Alert severity="info">This template is empty — nothing to apply.</Alert>
        ) : (
          <Stack spacing={1}>
            {sectionsWithContent.map((section) => (
              <SectionCard
                key={section.key}
                descriptor={section}
                sections={detailQuery.data!.sections}
                action={actions[section.key]}
                onActionChange={(action) => handleActionChange(section.key, action)}
                disabled={isApplying}
              />
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Button variant="outlined" onClick={onCancel} size="medium" sx={buttonSx} disabled={isApplying}>
          Cancel
        </Button>
        <LoadingButton
          variant="contained"
          onClick={handleApply}
          size="medium"
          sx={buttonSx}
          loading={isApplying}
          disabled={detailQuery.isLoading || !!detailQuery.error || sectionsWithContent.length === 0 || allSkipped}
        >
          Apply Template
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
