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
  MenuItem,
  Select,
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
  CreateLabCoverageInfo,
  CreateLabPaymentMethod,
  groupExamFindingsBySection,
  isTemplateCptCodeInfo,
  LAB_PAYMENT_METHOD_DISPLAY,
  LabPaymentMethod,
  nameLabTest,
  RosFindingState,
  RosFindingStateLabel,
  TEMPLATE_SECTION_DEFAULT_ACTIONS,
  TEMPLATE_SECTIONS_IN_ORDER,
  TEMPLATE_SECTIONS_NO_APPEND,
  TEMPLATE_SECTIONS_NO_OVERWRITE,
  TemplateCodeInfo,
  TemplateCptCodeInfo,
  TemplateExternalLabPlanDetail,
  TemplateInHouseLabPlanDetail,
  TemplateInHouseMedicationDetail,
  TemplatePreviewApplyOptions,
  TemplateProcedurePlan,
  TemplateSectionAction,
  TemplateSectionActions,
  TemplateSectionDescriptor,
  TemplateSectionKey,
} from 'utils';
import { useGetCreateExternalLabResources } from '../../stores/appointment/appointment.queries';
import { useAppointmentData } from '../../stores/appointment/appointment.store';

interface TemplatePreviewDialogProps {
  open: boolean;
  templateId: string | null;
  templateName: string;
  isApplying: boolean;
  onCancel: () => void;
  onApply: (actions: TemplateSectionActions, options?: TemplatePreviewApplyOptions) => void;
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
const getItemsToShowAndExtraCount = (items: any[], accessItem: (item: any) => any): string => {
  const itemsToShow = items
    .slice(0, NUM_ITEMS_IN_SECTION_TO_SHOW)
    .map((elm: any) => accessItem(elm))
    .join(', ');
  const extraCount = items.length - NUM_ITEMS_IN_SECTION_TO_SHOW;
  return extraCount > 0 ? `${itemsToShow} +${extraCount} more` : itemsToShow;
};

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
      return getItemsToShowAndExtraCount(sections.diagnoses, (item: TemplateCodeInfo) => item.code);
    }
    case 'patientInstructions':
      return pluralize(sections.patientInstructions.length, 'instruction');
    case 'cptCodes': {
      return getItemsToShowAndExtraCount(sections.cptCodes, (item: TemplateCptCodeInfo) => item.code);
    }
    case 'emCode':
      return sections.emCode ? sections.emCode.code : '';
    case 'inHouseLabs': {
      const summary = getItemsToShowAndExtraCount(
        sections.inHouseLabs,
        (item: TemplateInHouseLabPlanDetail) => item.testName
      );
      const missing = sections.inHouseLabs.filter((p) => p.missing).length;
      return missing > 0 ? `${summary} (${missing} unavailable)` : summary;
    }
    case 'externalLabs': {
      const summary = getItemsToShowAndExtraCount(sections.externalLabs, (item: TemplateExternalLabPlanDetail) =>
        nameLabTest(item.testName, item.testCode, item.labName, false)
      );
      const missing = sections.externalLabs.filter((p) => p.missing).length;
      return missing > 0 ? `${summary} (${missing} unavailable)` : summary;
    }
    case 'procedures': {
      // Use whatever short label we have for each plan: procedureType code if
      // it's there, otherwise fall back to the first CPT code so the summary
      // still says something concrete. "Unnamed procedure" is a last resort for
      // very sparse template entries.
      return getItemsToShowAndExtraCount(
        sections.procedures,
        (p: TemplateProcedurePlan) => p.procedureType ?? p.cptCodes[0]?.code ?? 'Unnamed procedure'
      );
    }
    case 'inHouseMedications': {
      return getItemsToShowAndExtraCount(
        sections.inHouseMedications,
        (item: TemplateInHouseMedicationDetail) => item.medicationName
      );
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
    case 'externalLabs':
      return sections.externalLabs.length > 0;
    case 'procedures':
      return sections.procedures.length > 0;
    case 'inHouseMedications':
      return sections.inHouseMedications.length > 0;
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
      // (e.g. comment fields with custom keys) falls into a trailing "Other" bucket.
      const groups = groupExamFindingsBySection(sections.examFindings);
      return (
        <Stack spacing={1.5}>
          {groups.map((group) => (
            <Box key={group.sectionKey}>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
                {group.sectionLabel}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                {group.findings.map((f) => (
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
          ))}
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
    case 'externalLabs':
      return <ExternalLabPlansList plans={sections.externalLabs} />;
    case 'procedures':
      return <ProcedurePlansList plans={sections.procedures} />;
    case 'inHouseMedications':
      return <InHouseMedicationList meds={sections.inHouseMedications} />;
    default:
      return null;
  }
};

const InHouseMedicationList: React.FC<{ meds: TemplateInHouseMedicationDetail[] }> = ({ meds }) => (
  <Stack spacing={1.5}>
    {meds.map((med) => (
      <Box key={med.planId}>
        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
          {med.medicationName}, {med.dose} {med.units}, {med.route}
        </Typography>
        {med.diagnoses.length > 0 ? (
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
            {med.diagnoses.map((d, idx) => (
              <Chip
                key={`${med.planId}-dx-${idx}`}
                size="small"
                variant="outlined"
                label={d.display ? `${d.code} — ${d.display}` : d.code}
              />
            ))}
          </Stack>
        ) : null}
        {med.cptCodes.length > 0 ? (
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
            {med.cptCodes.map((c, idx) => (
              <Chip
                key={`${med.planId}-cpt-${idx}`}
                size="small"
                variant="outlined"
                color="primary"
                label={`CPT ${formatCptCodeAndModifiersForDisplay(c)}${c.display ? ` — ${c.display}` : ''}`}
              />
            ))}
          </Stack>
        ) : null}
      </Box>
    ))}
  </Stack>
);

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

// Each external lab plan renders the test + lab combo with the saved ordering
// details (Dx chips, PSC chip, clinical info note) underneath. Plans whose
// test no longer resolves in the lab's compendium render muted so the
// provider knows they'll be skipped at apply-time. The ordering office and
// the (required) payment method selector live in the card's expanded
// controls, not here - they're apply inputs, not template content.
const ExternalLabPlansList: React.FC<{ plans: TemplateExternalLabPlanDetail[] }> = ({ plans }) => (
  <Stack spacing={1.5}>
    {plans.map((plan) => (
      <Box key={plan.planId} sx={{ opacity: plan.missing ? 0.55 : 1 }}>
        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
          {nameLabTest(plan.testName, plan.testCode, plan.labName, false)}
          {plan.missing ? (
            <Typography component="span" variant="caption" sx={{ ml: 1, color: 'warning.main', fontStyle: 'italic' }}>
              unavailable in this environment — will be skipped
            </Typography>
          ) : null}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
          {plan.psc ? <Chip size="small" color="primary" variant="outlined" label="PSC Hold" /> : null}
          {plan.diagnoses.map((d, idx) => (
            <Chip
              key={`${plan.planId}-dx-${idx}`}
              size="small"
              variant="outlined"
              label={d.display ? `${d.code} — ${d.display}` : d.code}
            />
          ))}
        </Stack>
        {plan.note ? (
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.5, color: 'text.secondary', whiteSpace: 'pre-wrap' }}
          >
            Note: {plan.note}
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
  // Extra text prepended to the header summary (separator included by the
  // caller) - e.g. the external labs card shows the payment method that will
  // be used so the user gets a reminder without expanding the card.
  summaryPrefix?: string;
  // Apply inputs rendered at the top of the expanded body, above the preview -
  // e.g. the external labs ordering office + payment method selector. Most
  // users never need to change these, so they live behind the expand toggle.
  expandedContent?: React.ReactNode;
}> = ({ descriptor, sections, action, onActionChange, disabled, summaryPrefix, expandedContent }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const noAppend = TEMPLATE_SECTIONS_NO_APPEND.has(descriptor.key);
  const noOverwrite = TEMPLATE_SECTIONS_NO_OVERWRITE.has(descriptor.key);
  const summary = `${summaryPrefix ?? ''}${getSectionSummary(sections, descriptor.key)}`;

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
          {expandedContent ? (
            <Box data-testid={`template-section-${descriptor.key}-controls`} sx={{ mb: 2 }}>
              {expandedContent}
            </Box>
          ) : null}
          <SectionPreview sectionKey={descriptor.key} sections={sections} />
        </Box>
      </Collapse>
    </Box>
  );
};

// The apply-time inputs for the External Lab Orders section: the ordering
// office (auto-selected from the visit's location, display-only) and the
// payment method the created orders will use (required before the section can
// be appended). The selection defaults from the visit's payment details and
// is echoed in the card's header summary, so most users never need to open
// this - it lives in the card's expanded body for the rare change. Payment
// options mirror the chart's create-order page: Insurance only when the
// patient has coverage, Workers' Comp only when the appointment is flagged
// workers comp, Self Pay and Client Bill always.
const ExternalLabsApplyControls: React.FC<{
  resourcesLoading: boolean;
  resourcesError: boolean;
  hasInsurance: boolean;
  isWorkersComp: boolean;
  coverageInfo: CreateLabCoverageInfo[] | undefined;
  orderingOfficeName: string | undefined;
  paymentMethod: CreateLabPaymentMethod | '';
  onPaymentMethodChange: (method: CreateLabPaymentMethod) => void;
  disabled: boolean;
}> = ({
  resourcesLoading,
  resourcesError,
  hasInsurance,
  isWorkersComp,
  coverageInfo,
  orderingOfficeName,
  paymentMethod,
  onPaymentMethodChange,
  disabled,
}) => {
  if (resourcesLoading) {
    return (
      <Stack direction="row" alignItems="center" spacing={1}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Loading ordering options…
        </Typography>
      </Stack>
    );
  }

  if (resourcesError) {
    return (
      <Alert severity="warning" sx={{ py: 0 }} data-testid="template-external-labs-resources-error">
        Couldn't load payment options for external lab orders — this usually means the patient's responsible party or
        payment information is incomplete. Set this section to Skip to apply the rest of the template.
      </Alert>
    );
  }

  return (
    <Stack spacing={1}>
      {orderingOfficeName ? (
        <Typography variant="body2" data-testid="template-external-labs-ordering-office">
          <strong>Ordering Office:</strong> {orderingOfficeName}{' '}
          <Typography component="span" variant="caption" color="text.secondary">
            (from this visit)
          </Typography>
        </Typography>
      ) : (
        <Alert severity="warning" sx={{ py: 0 }} data-testid="template-external-labs-office-warning">
          This visit's office is not configured for external lab ordering — external lab orders will be skipped.
        </Alert>
      )}
      {orderingOfficeName ? (
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Typography variant="body2">
            <strong>Payment Method</strong> (required):
          </Typography>
          <Select
            size="small"
            displayEmpty
            value={paymentMethod}
            onChange={(e) => onPaymentMethodChange(e.target.value as CreateLabPaymentMethod)}
            disabled={disabled}
            sx={{ minWidth: 180 }}
            data-testid="template-external-labs-payment-method"
            renderValue={(value) =>
              value ? (
                LAB_PAYMENT_METHOD_DISPLAY[value as CreateLabPaymentMethod]
              ) : (
                <Typography component="span" variant="body2" color="text.secondary">
                  Select payment method
                </Typography>
              )
            }
          >
            {hasInsurance && (
              <MenuItem value={LabPaymentMethod.Insurance}>
                {LAB_PAYMENT_METHOD_DISPLAY[LabPaymentMethod.Insurance]}
              </MenuItem>
            )}
            {isWorkersComp && (
              <MenuItem value={LabPaymentMethod.WorkersComp}>
                {LAB_PAYMENT_METHOD_DISPLAY[LabPaymentMethod.WorkersComp]}
              </MenuItem>
            )}
            <MenuItem value={LabPaymentMethod.SelfPay}>{LAB_PAYMENT_METHOD_DISPLAY[LabPaymentMethod.SelfPay]}</MenuItem>
            <MenuItem value={LabPaymentMethod.ClientBill}>
              {LAB_PAYMENT_METHOD_DISPLAY[LabPaymentMethod.ClientBill]}
            </MenuItem>
          </Select>
        </Stack>
      ) : null}
      {orderingOfficeName && paymentMethod === LabPaymentMethod.Insurance && coverageInfo?.length ? (
        <Box>
          {coverageInfo.map((coverage, idx) => (
            <Typography key={`coverage-name-${idx}`} variant="caption" sx={{ display: 'block' }}>
              {`${coverage.coverageName}${coverage.isPrimary ? ' (primary)' : ''}`}
            </Typography>
          ))}
        </Box>
      ) : null}
    </Stack>
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
  const { patient, location: apptLocation, encounter } = useAppointmentData();
  const [actions, setActions] = useState<Record<TemplateSectionKey, TemplateSectionAction>>({
    ...TEMPLATE_SECTION_DEFAULT_ACTIONS,
  });
  const [externalLabPaymentMethod, setExternalLabPaymentMethod] = useState<CreateLabPaymentMethod | ''>('');

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
      setExternalLabPaymentMethod('');
    }
  }, [open, templateId]);

  const sectionsWithContent = useMemo(() => {
    if (!detailQuery.data) return [];
    return TEMPLATE_SECTIONS_IN_ORDER.filter((s) => sectionHasContent(detailQuery.data.sections, s.key));
  }, [detailQuery.data]);

  // External labs apply inputs: the payment method options depend on the
  // patient's coverage and the appointment's workers comp flag, fetched via
  // the same resource endpoint the chart's create-order page uses. Only
  // fetched when the open template actually carries external lab plans.
  const externalLabPlans = detailQuery.data?.sections.externalLabs;
  const hasExternalLabs = (externalLabPlans?.length ?? 0) > 0;
  const externalLabResourcesQuery = useGetCreateExternalLabResources({
    patientId: open && hasExternalLabs ? patient?.id : undefined,
    encounterId: encounter.id,
  });
  const externalLabResources = externalLabResourcesQuery.data;
  const coverageInfo = externalLabResources?.coverages;
  const hasInsurance = !!coverageInfo?.length;
  const isWorkersComp = !!externalLabResources?.appointmentIsWorkersComp;

  // The ordering office is auto-selected from the visit's location; undefined
  // means the location isn't configured for external lab ordering (orders will
  // be skipped server-side with a warning).
  const orderingOfficeName = useMemo(() => {
    if (!apptLocation?.id || !externalLabResources) return undefined;
    return externalLabResources.orderingLocations.find((loc) => loc.id === apptLocation.id)?.name;
  }, [apptLocation?.id, externalLabResources]);

  // Pre-select the payment method from the visit's payment details, using the
  // same auto-default the chart's create-order page uses: workers comp when
  // the appointment is flagged, otherwise insurance when the patient has
  // coverage, otherwise self pay. Templates intentionally don't carry a
  // payment method - it's visit-specific.
  useEffect(() => {
    if (!open || !hasExternalLabs || !externalLabResources) return;
    setExternalLabPaymentMethod((current) => {
      if (current) return current;
      if (isWorkersComp) return LabPaymentMethod.WorkersComp;
      if (hasInsurance) return LabPaymentMethod.Insurance;
      if (coverageInfo) return LabPaymentMethod.SelfPay;
      return current;
    });
  }, [open, hasExternalLabs, externalLabResources, hasInsurance, isWorkersComp, coverageInfo]);

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
    const options: TemplatePreviewApplyOptions | undefined =
      payload.externalLabs === 'append' && externalLabPaymentMethod
        ? { externalLabs: { paymentMethod: externalLabPaymentMethod } }
        : undefined;
    onApply(payload, options);
  };

  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  const allSkipped = sectionsWithContent.length > 0 && sectionsWithContent.every((s) => actions[s.key] === 'skip');

  // Appending external lab orders requires a confirmed payment method before
  // the template can be applied. Templates don't carry one, so when the
  // payment options can't be loaded the section must be skipped to proceed.
  // When the office isn't lab-configured there's nothing to require - the
  // orders are skipped server-side with a warning.
  const externalLabsAppendSelected = hasExternalLabs && actions.externalLabs === 'append';
  const externalLabsRequirementUnmet =
    externalLabsAppendSelected &&
    (externalLabResourcesQuery.isLoading ||
      externalLabResourcesQuery.isError ||
      (Boolean(orderingOfficeName) && !externalLabPaymentMethod));

  // Echo the payment selection in the card's header summary so the user gets
  // a reminder of what the orders will use without expanding the card (the
  // selector itself lives in the expanded body - it rarely needs changing).
  const externalLabsSummaryPrefix = ((): string | undefined => {
    const separator = ' · ';
    let prefixString: string | undefined = undefined;
    if (!hasExternalLabs) return prefixString;
    else if (externalLabResourcesQuery.isError) prefixString = 'Payment options unavailable';
    else if (externalLabPaymentMethod)
      prefixString = `Payment: ${LAB_PAYMENT_METHOD_DISPLAY[externalLabPaymentMethod]}`;
    else if (!externalLabResourcesQuery.isLoading && orderingOfficeName) prefixString = 'payment method needed';
    else return undefined;
    return prefixString + separator;
  })();

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
                summaryPrefix={section.key === 'externalLabs' ? externalLabsSummaryPrefix : undefined}
                expandedContent={
                  section.key === 'externalLabs' ? (
                    <ExternalLabsApplyControls
                      resourcesLoading={externalLabResourcesQuery.isLoading}
                      resourcesError={externalLabResourcesQuery.isError}
                      hasInsurance={hasInsurance}
                      isWorkersComp={isWorkersComp}
                      coverageInfo={coverageInfo}
                      orderingOfficeName={orderingOfficeName}
                      paymentMethod={externalLabPaymentMethod}
                      onPaymentMethodChange={setExternalLabPaymentMethod}
                      disabled={isApplying || actions.externalLabs === 'skip'}
                    />
                  ) : undefined
                }
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
          disabled={
            detailQuery.isLoading ||
            !!detailQuery.error ||
            sectionsWithContent.length === 0 ||
            allSkipped ||
            externalLabsRequirementUnmet
          }
        >
          Apply Template
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
