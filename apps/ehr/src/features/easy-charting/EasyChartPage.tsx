import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  IconButton,
  keyframes,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Oystehr from '@oystehr/sdk';
import type { ExamItemConfig } from 'config-types';
import type { Encounter } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApiClients } from 'src/hooks/useAppClients';
import { useCommandPaletteSource } from 'src/hooks/useCommandPaletteSource';
import { useMergedProcedureQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { CommandPaletteItem } from 'src/state/command-palette.store';
import {
  AllergyDTO,
  BODY_SIDES_VALUE_SET_URL,
  BODY_SITES_VALUE_SET_URL,
  COMPLICATIONS_VALUE_SET_URL,
  CPTCodeDTO,
  EasyChartAgentIntent,
  examConfig,
  type ExamObservationDTO,
  GetChartDataResponse,
  HospitalizationDTO,
  InPersonRosConfig,
  MedicalConditionDTO,
  MedicationDTO,
  MEDICATIONS_USED_VALUE_SET_URL,
  PATIENT_RESPONSES_VALUE_SET_URL,
  POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL,
  PROCEDURE_TYPES_VALUE_SET_URL,
  ProcedureDTO,
  ProcedureQuickPickData,
  progressNoteChartDataRequestedFields,
  rosField,
  RosFindingState,
  SaveChartDataRequest,
  SUPPLIES_VALUE_SET_URL,
  TECHNIQUES_VALUE_SET_URL,
  TIME_SPENT_VALUE_SET_URL,
  VitalsObservationDTO,
} from 'utils';
import { applyTemplate, easyChartAgent, easyChartPlanner, icd10Search, listTemplates } from '../../api/api';
import { showEnvironmentBanner } from '../../App';
import { HospitalizationOptions } from '../visits/in-person/components/hospitalization/hospitalizationOptions';
import { SURGICAL_HISTORY_OPTIONS } from '../visits/shared/components/medical-history-tab/SurgicalHistory/surgicalHistoryOptions';
import { useEMCodes } from '../visits/shared/hooks/useEMCodes';
import { useOystehrAPIClient } from '../visits/shared/hooks/useOystehrAPIClient';
import { AiAlternative, AiChartedItem } from './AiChartedItem';
import InlineNoteField from './InlineNoteField';
import { useEasyChartQuickPicks } from './useEasyChartQuickPicks';

// Walk examConfig once to map every leaf exam field name to its most-specific section label
// (e.g. "Right ear" inside the "Ears" card) so we can group abnormal findings by body section.
function buildFieldToSectionLabel(config: ExamItemConfig): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [, section] of Object.entries(config)) {
    const walk = (components: Record<string, unknown>, currentLabel: string): void => {
      for (const [key, comp] of Object.entries(components)) {
        const c = comp as { type?: string; label?: string; components?: Record<string, unknown> };
        if ((c?.type === 'column' || c?.type === 'dropdown') && c.components) {
          walk(c.components, c.label ?? currentLabel);
        } else {
          map[key] = currentLabel;
        }
      }
    };
    walk(section.components.normal as Record<string, unknown>, section.label);
    walk(section.components.abnormal as Record<string, unknown>, section.label);
    walk(section.components.comment as Record<string, unknown>, section.label);
  }
  return map;
}

const FIELD_TO_SECTION_LABEL = buildFieldToSectionLabel(examConfig.default.components);

// Flat index of every CHECKBOX leaf in the exam template, keyed by the field code so the
// refine-bar "add exam finding" handler can fuzzy-match the provider's phrasing against
// labels and present the closest candidates.
interface ExamLeaf {
  field: string;
  label: string;
  section: string;
  normalAbnormal: 'normal' | 'abnormal';
  // For modal-option leaves: `field` is the PARENT checkbox code (that's where the
  // ServiceRequest/Observation lives); the picker writes this option as a `components`
  // entry on that parent observation rather than as a separate field.
  modalOption?: {
    optionCode: string;
    optionLabel: string;
    groupLabel: string;
    columnLabel?: string;
    abnormal: boolean;
    parentLabel: string;
  };
}
// Stable, unique key for a leaf. Modal-option leaves share a parent `field`, so the option
// code must be part of the key (otherwise two options under one checkbox collide in the
// multi-select picker and in React list keys).
function leafKey(leaf: ExamLeaf): string {
  return leaf.modalOption ? `${leaf.field}::${leaf.modalOption.optionCode}` : leaf.field;
}
function buildExamLeafIndex(config: ExamItemConfig): ExamLeaf[] {
  const out: ExamLeaf[] = [];
  // Walk arbitrary nested objects looking for modal "options" leaves (each is { label }).
  // Picks any { options: { code: { label } } } leaf and emits a virtual leaf per option.
  // Carries the path of intermediate `label`s (e.g. group/column labels like "Frontal" or
  // "Maxillary") into the leaf's display so distinct-but-similarly-named options (e.g.
  // sinus-frontal-l vs sinus-maxillary-l both have option label "Left") don't render as
  // duplicates in the picker.
  const walkModalOptions = (
    node: unknown,
    parentCheckboxKey: string,
    parentCheckboxLabel: string,
    labelPath: string[],
    columnLabel: string | undefined,
    groupLabel: string | undefined,
    section: string,
    normalAbnormal: 'normal' | 'abnormal'
  ): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (obj.options && typeof obj.options === 'object') {
      for (const [optKey, optVal] of Object.entries(obj.options as Record<string, unknown>)) {
        const opt = optVal as { label?: unknown; abnormal?: unknown } | undefined;
        const optLabel = opt?.label;
        if (typeof optLabel === 'string') {
          out.push({
            field: parentCheckboxKey,
            label: [...labelPath, optLabel].filter(Boolean).join(' — '),
            section,
            normalAbnormal,
            modalOption: {
              optionCode: optKey,
              optionLabel: optLabel,
              groupLabel: groupLabel ?? '',
              columnLabel,
              abnormal: typeof opt?.abnormal === 'boolean' ? opt.abnormal : normalAbnormal === 'abnormal',
              parentLabel: parentCheckboxLabel,
            },
          });
        }
      }
    }
    for (const containerKey of ['columns', 'groups', 'components']) {
      const container = obj[containerKey];
      if (container && typeof container === 'object') {
        for (const child of Object.values(container as Record<string, unknown>)) {
          const childObj = child as { label?: unknown; header?: unknown } | undefined;
          const childLabel = typeof childObj?.label === 'string' ? childObj.label : undefined;
          const childHeader = typeof childObj?.header === 'string' ? childObj.header : undefined;
          // 'columns' nodes typically expose laterality via `header` (e.g. "Left"/"Right");
          // 'groups' and 'components' use `label`. Prefer the right field per container
          // scope so the display path always includes laterality.
          const pathEntry = containerKey === 'columns' ? childHeader ?? childLabel : childLabel ?? childHeader;
          const useful = !!pathEntry && !/^single[-_]?column$/i.test(pathEntry);
          // Avoid consecutive duplicates in the path (e.g. modal section "Status" containing
          // a group also called "Status").
          const nextPath =
            useful && pathEntry !== labelPath[labelPath.length - 1] ? [...labelPath, pathEntry!] : labelPath;
          const nextColumn = containerKey === 'columns' ? childHeader ?? childLabel ?? columnLabel : columnLabel;
          const nextGroup = containerKey === 'groups' ? childLabel ?? groupLabel : groupLabel;
          walkModalOptions(
            child,
            parentCheckboxKey,
            parentCheckboxLabel,
            nextPath,
            nextColumn,
            nextGroup,
            section,
            normalAbnormal
          );
        }
      }
    }
  };

  for (const [, section] of Object.entries(config)) {
    const walk = (
      components: Record<string, unknown>,
      currentSectionLabel: string,
      normalAbnormal: 'normal' | 'abnormal'
    ): void => {
      for (const [key, comp] of Object.entries(components)) {
        const c = comp as {
          type?: string;
          label?: string;
          components?: Record<string, unknown>;
          modal?: Record<string, unknown>;
        };
        if ((c?.type === 'column' || c?.type === 'dropdown') && c.components) {
          walk(c.components, c.label ?? currentSectionLabel, normalAbnormal);
        } else if (c?.type === 'checkbox' && c.label) {
          out.push({ field: key, label: c.label, section: currentSectionLabel, normalAbnormal });
        } else if (c?.type === 'checkbox-with-modal' && c.label && c.modal) {
          // Surface the parent checkbox itself…
          out.push({ field: key, label: c.label, section: currentSectionLabel, normalAbnormal });
          // …plus every nested modal option as its own pickable item.
          for (const modalNode of Object.values(c.modal)) {
            walkModalOptions(
              modalNode,
              key,
              c.label,
              [c.label],
              undefined,
              undefined,
              currentSectionLabel,
              normalAbnormal
            );
          }
        }
      }
    };
    walk(section.components.normal as Record<string, unknown>, section.label, 'normal');
    walk(section.components.abnormal as Record<string, unknown>, section.label, 'abnormal');
  }
  return out;
}
const EXAM_LEAVES = buildExamLeafIndex(examConfig.default.components);

// ROS catalog — one leaf per Review-of-Systems item (baseKey + label + system), built from the
// practice's ROS config. The denies/reports state is applied at save time via the field suffix.
interface RosLeaf {
  baseKey: string;
  label: string;
  system: string;
}
function buildRosLeafIndex(): RosLeaf[] {
  const out: RosLeaf[] = [];
  for (const card of Object.values(InPersonRosConfig)) {
    for (const [baseKey, item] of Object.entries(card.items)) {
      out.push({ baseKey, label: item.label, system: card.label });
    }
  }
  return out;
}
const ROS_LEAVES = buildRosLeafIndex();

const VITAL_LABEL: Record<string, string> = {
  'vital-temperature': 'Temp',
  'vital-heartbeat': 'HR',
  'vital-blood-pressure': 'BP',
  'vital-oxygen-sat': 'O₂ sat',
  'vital-respiration-rate': 'RR',
  'vital-weight': 'Weight',
  'vital-height': 'Height',
  'vital-vision': 'Vision',
  'vital-last-menstrual-period': 'LMP',
};

const VITAL_UNIT: Record<string, string> = {
  'vital-oxygen-sat': '%',
  'vital-respiration-rate': '/min',
  'vital-heartbeat': 'bpm',
};

function formatVital(v: VitalsObservationDTO): string {
  const label = VITAL_LABEL[v.field] ?? v.field;
  if (v.field === 'vital-blood-pressure') {
    return `${label}: ${v.systolicPressure}/${v.diastolicPressure} mmHg`;
  }
  if (v.field === 'vital-vision') {
    const eyes = [
      v.bothEyesVisionText ? `OU ${v.bothEyesVisionText}` : null,
      v.rightEyeVisionText ? `OD ${v.rightEyeVisionText}` : null,
      v.leftEyeVisionText ? `OS ${v.leftEyeVisionText}` : null,
    ].filter(Boolean);
    return `${label}: ${eyes.join(', ')}`;
  }
  if (v.field === 'vital-weight' && 'extraWeightOptions' in v && v.extraWeightOptions?.includes('patient_refused')) {
    return `${label}: patient refused`;
  }
  if ('value' in v && v.value !== undefined && v.value !== null) {
    const unit = VITAL_UNIT[v.field] ?? '';
    return `${label}: ${v.value}${unit ? ` ${unit}` : ''}`;
  }
  return label;
}

// Shared section-header styling so each band in the note reads like a real section header
// rather than a flat label. Underlined + bolded primary-color text on a hairline divider.
const sectionHeaderSx = {
  color: 'primary.dark',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase' as const,
  lineHeight: 1.4,
  pb: 0.5,
  borderBottom: '1px solid',
  borderColor: 'divider',
};

// Convert a ProcedureType code like "laceration-repair" into a human label "Laceration Repair".
// Procedure types are stored on the ServiceRequest as the FHIR coding code (kebab-case), but
// providers expect to see a Title Case display name in the rendered note.
function formatProcedureType(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return code
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <Box sx={{ py: 1.25 }}>
      <Typography variant="subtitle2" sx={sectionHeaderSx}>
        {title}
      </Typography>
      <Box sx={{ mt: 0.75 }}>{children}</Box>
    </Box>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ py: 1.25 }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        onClick={() => setOpen((o) => !o)}
        sx={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <Typography variant="subtitle2" sx={{ ...sectionHeaderSx, flex: 1 }}>
          {title}
        </Typography>
        <IconButton size="small" sx={{ p: 0.25 }} aria-label={open ? 'Collapse section' : 'Expand section'}>
          <ExpandMoreIcon
            fontSize="small"
            sx={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          />
        </IconButton>
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ mt: 0.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

// The five free-text note fields, keyed by their actual chart-data key (NOT the display label —
// the CC↔HPI label swap is applied at the render site, so these are already the storage keys).
type ChartNoteKey = 'chiefComplaint' | 'historyOfPresentIllness' | 'mechanismOfInjury' | 'ros' | 'medicalDecision';

// The structured, SEARCH-based chart-data fields (resolved via runIntentSearch + buildIntentPayload).
export type ChartedField =
  | 'allergies'
  | 'conditions'
  | 'medications'
  | 'surgicalHistory'
  | 'episodeOfCare'
  | 'diagnosis';
// All fields that support AI click-to-correct — adds the CODE-based billing fields (E&M is a scalar,
// CPT is an array) which use a terminology search and their own replace logic.
export type AiField = ChartedField | 'cptCodes' | 'emCode';

// Provenance for an item the assistant auto-charted and that still needs the provider's review.
// `field` ties it to the chart-data; `lowConfidence` is set when the auto-pick was ambiguous.
export interface AiChartedMeta {
  field: AiField;
  display: string;
  searchTerms: string[];
  lowConfidence: boolean;
}

interface NoteSectionsProps {
  data: GetChartDataResponse;
  freshlyAdded: Set<string>;
  removingItems: Set<string>;
  // When true, the left pane is directly editable: free-text fields become text areas and
  // structured items get an inline remove control. Omitted/false → read-only (legacy behavior).
  editable?: boolean;
  onSaveField?: (key: ChartNoteKey, text: string) => void;
  onRemoveItem?: (field: string, dto: { resourceId?: string }) => void;
  // AI-charted items needing review (keyed by resourceId), plus the correction callbacks. When a
  // row's resourceId is in this map it renders as a clickable <AiChartedItem> instead of a row.
  aiCharted?: Map<string, AiChartedMeta>;
  onAiSearch?: (field: AiField, query: string) => Promise<AiAlternative[]>;
  onAiReplace?: (field: AiField, dto: { resourceId?: string }, key: string, dosageUnconfirmed?: boolean) => void;
  onAiRemove?: (field: AiField, dto: { resourceId?: string }) => void;
  onAiDiscuss?: (field: AiField, dto: { resourceId?: string }, meta: AiChartedMeta) => void;
  onAiSetMedDosage?: (dto: { resourceId?: string }, value: boolean) => void;
}

// Keyframes defined at module level so the animation runs reliably whether `flashSx` is
// passed directly to `sx` or spread into a larger sx object. The animation pulses a bold
// yellow + outline so it's hard to miss against a white note background.
const flashKeyframe = keyframes`
  0% {
    background-color: rgba(255, 193, 7, 0.85);
    outline: 2px solid rgba(245, 124, 0, 1);
    outline-offset: 2px;
  }
  60% {
    background-color: rgba(255, 235, 59, 0.5);
    outline: 2px solid rgba(245, 124, 0, 0.4);
    outline-offset: 2px;
  }
  100% {
    background-color: transparent;
    outline: 2px solid rgba(245, 124, 0, 0);
    outline-offset: 2px;
  }
`;

const flashSx = {
  animation: `${flashKeyframe} 3s ease-out`,
  borderRadius: '4px',
  px: 0.5,
  mx: -0.5,
};

// For removes, we briefly highlight the item in red so the user sees what's about to be
// deleted, then unmount it. The animation duration is matched to the removal delay in
// flashAndRemoveItem (1.5s) so the flash plays to completion just as the item disappears.
const removeFlashKeyframe = keyframes`
  0% {
    background-color: rgba(244, 67, 54, 0.85);
    outline: 2px solid rgba(198, 40, 40, 1);
    outline-offset: 2px;
  }
  60% {
    background-color: rgba(244, 67, 54, 0.55);
    outline: 2px solid rgba(198, 40, 40, 0.6);
    outline-offset: 2px;
  }
  100% {
    background-color: rgba(244, 67, 54, 0.3);
    outline: 2px solid rgba(198, 40, 40, 0.3);
    outline-offset: 2px;
  }
`;

const removeFlashSx = {
  animation: `${removeFlashKeyframe} 1.5s ease-out forwards`,
  borderRadius: '4px',
  px: 0.5,
  mx: -0.5,
};

// Wraps a structured note item with a hover-revealed remove control when the note is editable.
// The removal flash (`flashSx`) and the `data-easy-chart-id` hook move onto this row so the whole
// item flashes red as it's deleted. Read-only mode renders the children unchanged.
function DeletableRow({
  editable,
  resourceId,
  onDelete,
  flashSx: rowFlashSx,
  children,
}: {
  editable?: boolean;
  resourceId?: string;
  onDelete?: () => void;
  flashSx?: object;
  children: React.ReactNode;
}): JSX.Element {
  if (!editable || !onDelete) {
    return (
      <Box data-easy-chart-id={resourceId} sx={rowFlashSx}>
        {children}
      </Box>
    );
  }
  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      spacing={0.5}
      data-easy-chart-id={resourceId}
      sx={{ ...(rowFlashSx ?? {}), '&:hover .ec-del-btn': { opacity: 1 } }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      <IconButton
        className="ec-del-btn"
        size="small"
        aria-label="Remove"
        onClick={onDelete}
        // Always visible on touch (no hover); hover-revealed on md+ to keep the note clean.
        sx={{ opacity: { xs: 1, md: 0 }, transition: 'opacity 0.15s', p: 0.25, mt: '-2px' }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Stack>
  );
}

function NoteSections({
  data,
  freshlyAdded,
  removingItems,
  editable = false,
  onSaveField,
  onRemoveItem,
  aiCharted,
  onAiSearch,
  onAiReplace,
  onAiRemove,
  onAiDiscuss,
  onAiSetMedDosage,
}: NoteSectionsProps): JSX.Element {
  const removeHandler = (field: string, dto: { resourceId?: string }): (() => void) | undefined =>
    editable && onRemoveItem && dto.resourceId ? () => onRemoveItem(field, dto) : undefined;
  // Render an allergy/diagnosis row that the assistant charted as a clickable, highlighted
  // AiChartedItem (review affordance); fall back to `fallback` (the normal row) when it's a
  // provider-entered item or the AI-review wiring isn't supplied.
  const aiMeta = (dto: { resourceId?: string }): AiChartedMeta | undefined =>
    dto.resourceId ? aiCharted?.get(dto.resourceId) : undefined;
  const renderAiChartable = (
    field: AiField,
    dto: { resourceId?: string },
    label: React.ReactNode,
    fallback: JSX.Element
  ): JSX.Element => {
    const meta = aiMeta(dto);
    if (!editable || !meta || !onAiSearch || !onAiReplace || !onAiRemove || !onAiDiscuss) return fallback;
    const isMed = field === 'medications';
    const isCode = field === 'cptCodes' || field === 'emCode';
    const medDosage = isMed ? !!(dto as MedicationDTO).intakeInfo?.patientCouldNotConfirmDosage : undefined;
    return (
      <AiChartedItem
        key={dto.resourceId}
        lowConfidence={meta.lowConfidence}
        initialQuery={meta.display}
        onSearch={(q) => onAiSearch(field, q)}
        onReplace={(key, dosage) => onAiReplace(field, dto, key, dosage)}
        onRemove={() => onAiRemove(field, dto)}
        onDiscuss={() => onAiDiscuss(field, dto, meta)}
        hideDiscuss={isCode}
        showDosageOption={isMed}
        dosageUnconfirmed={medDosage}
        onDosageUnconfirmedChange={isMed && onAiSetMedDosage ? (v) => onAiSetMedDosage(dto, v) : undefined}
      >
        {label}
      </AiChartedItem>
    );
  };
  // Pick the right flash style: red if the item is being removed, yellow if it was just added,
  // none otherwise. Removing wins so adding-then-immediately-removing still reads as a removal.
  const itemSx = (resourceId: string | undefined): typeof flashSx | undefined => {
    if (!resourceId) return undefined;
    if (removingItems.has(resourceId)) return removeFlashSx;
    if (freshlyAdded.has(resourceId)) return flashSx;
    return undefined;
  };
  // In-person CC ↔ HPI swap: the textareas labelled "Chief Complaint" and "History of Present Illness"
  // are backed by the historyOfPresentIllness and chiefComplaint chart-data keys respectively.
  const chiefComplaint = data.historyOfPresentIllness?.text;
  const hpi = data.chiefComplaint?.text;
  const moi = data.mechanismOfInjury?.text;
  const rosText = data.ros?.text;
  const mdm = data.medicalDecision?.text;

  const positiveRos = (data.rosObservations ?? []).filter((o) => o.value === true);
  const abnormalExam = (data.examObservations ?? []).filter((o) => o.value === true);
  const examWithNotes = (data.examObservations ?? []).filter((o) => o.note && o.note.trim());

  const dx = data.diagnosis ?? [];
  const cptCodes = data.cptCodes ?? [];
  const emCode = data.emCode;
  const procedures = data.procedures ?? [];
  const instructions = data.instructions ?? [];
  const conditions = data.conditions ?? [];
  const allergies = data.allergies ?? [];
  const medications = data.medications ?? [];
  const surgicalHistory = data.surgicalHistory ?? [];
  const hospitalizations = data.episodeOfCare ?? [];
  const vitals = data.vitalsObservations ?? [];

  const examBySection = new Map<string, typeof abnormalExam>();
  abnormalExam.forEach((o) => {
    const label = FIELD_TO_SECTION_LABEL[o.field] ?? 'Other';
    if (!examBySection.has(label)) examBySection.set(label, []);
    examBySection.get(label)!.push(o);
  });

  const anything =
    chiefComplaint ||
    hpi ||
    moi ||
    rosText ||
    positiveRos.length ||
    abnormalExam.length ||
    examWithNotes.length ||
    mdm ||
    dx.length ||
    cptCodes.length ||
    emCode ||
    instructions.length ||
    conditions.length ||
    allergies.length ||
    medications.length ||
    surgicalHistory.length ||
    hospitalizations.length ||
    vitals.length ||
    procedures.length;

  // In editable mode we always render so the free-text editors are available to type into even
  // on a brand-new encounter; read-only mode keeps the original empty placeholder.
  if (!anything && !editable) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No chart data yet for this encounter.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack divider={<Divider flexItem />}>
        {allergies.length > 0 && (
          <Section title="Allergies">
            <Stack spacing={0.25}>
              {allergies.map((a, i) =>
                renderAiChartable(
                  'allergies',
                  a,
                  <Typography variant="body2">• {a.name ?? '(unnamed)'}</Typography>,
                  <DeletableRow
                    key={a.resourceId ?? i}
                    editable={editable}
                    resourceId={a.resourceId}
                    flashSx={itemSx(a.resourceId)}
                    onDelete={removeHandler('allergies', a)}
                  >
                    <Typography variant="body2">• {a.name ?? '(unnamed)'}</Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
          </Section>
        )}

        {medications.length > 0 && (
          <Section title="Medications">
            <Stack spacing={0.25}>
              {medications.map((m, i) =>
                renderAiChartable(
                  'medications',
                  m,
                  <Typography variant="body2">
                    • {m.name}
                    {m.intakeInfo?.dose ? ` — ${m.intakeInfo.dose}` : ''}
                    {m.intakeInfo?.patientCouldNotConfirmDosage && (
                      <Typography component="span" variant="caption" color="text.secondary">
                        {' '}
                        (dosage unconfirmed)
                      </Typography>
                    )}
                  </Typography>,
                  <DeletableRow
                    key={m.resourceId ?? i}
                    editable={editable}
                    resourceId={m.resourceId}
                    flashSx={itemSx(m.resourceId)}
                    onDelete={removeHandler('medications', m)}
                  >
                    <Typography variant="body2">
                      • {m.name}
                      {m.intakeInfo?.dose ? ` — ${m.intakeInfo.dose}` : ''}
                      {m.intakeInfo?.patientCouldNotConfirmDosage && (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {' '}
                          (dosage unconfirmed)
                        </Typography>
                      )}
                    </Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
          </Section>
        )}

        {conditions.length > 0 && (
          <Section title="Medical History">
            <Stack spacing={0.25}>
              {conditions.map((c, i) =>
                renderAiChartable(
                  'conditions',
                  c,
                  <Typography variant="body2">
                    {c.code ? <strong>{c.code}</strong> : null}
                    {c.code ? ' — ' : ''}
                    {c.display ?? '(no display)'}
                  </Typography>,
                  <DeletableRow
                    key={c.resourceId ?? i}
                    editable={editable}
                    resourceId={c.resourceId}
                    flashSx={itemSx(c.resourceId)}
                    onDelete={removeHandler('conditions', c)}
                  >
                    <Typography variant="body2">
                      {c.code ? <strong>{c.code}</strong> : null}
                      {c.code ? ' — ' : ''}
                      {c.display ?? '(no display)'}
                    </Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
          </Section>
        )}

        {surgicalHistory.length > 0 && (
          <Section title="Surgical History">
            <Stack spacing={0.25}>
              {surgicalHistory.map((s, i) =>
                renderAiChartable(
                  'surgicalHistory',
                  s,
                  <Typography variant="body2">
                    <strong>{s.code}</strong>
                    {s.display ? ` — ${s.display}` : ''}
                  </Typography>,
                  <DeletableRow
                    key={s.resourceId ?? i}
                    editable={editable}
                    resourceId={s.resourceId}
                    flashSx={itemSx(s.resourceId)}
                    onDelete={removeHandler('surgicalHistory', s)}
                  >
                    <Typography variant="body2">
                      <strong>{s.code}</strong>
                      {s.display ? ` — ${s.display}` : ''}
                    </Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
          </Section>
        )}

        {hospitalizations.length > 0 && (
          <Section title="Hospitalizations">
            <Stack spacing={0.25}>
              {hospitalizations.map((h, i) =>
                renderAiChartable(
                  'episodeOfCare',
                  h,
                  <Typography variant="body2">
                    <strong>{h.code}</strong>
                    {h.display ? ` — ${h.display}` : ''}
                  </Typography>,
                  <DeletableRow
                    key={h.resourceId ?? i}
                    editable={editable}
                    resourceId={h.resourceId}
                    flashSx={itemSx(h.resourceId)}
                    onDelete={removeHandler('episodeOfCare', h)}
                  >
                    <Typography variant="body2">
                      <strong>{h.code}</strong>
                      {h.display ? ` — ${h.display}` : ''}
                    </Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
          </Section>
        )}

        {(editable || chiefComplaint) && (
          <Section title="Chief Complaint">
            {editable && onSaveField ? (
              // CC↔HPI swap: the "Chief Complaint" textarea is backed by the historyOfPresentIllness key.
              <InlineNoteField
                label="Chief Complaint"
                value={chiefComplaint ?? ''}
                minRows={1}
                onSave={(text) => onSaveField('historyOfPresentIllness', text)}
              />
            ) : (
              <Typography
                variant="body2"
                data-easy-chart-id={data.historyOfPresentIllness?.resourceId}
                sx={{
                  whiteSpace: 'pre-wrap',
                  ...(itemSx(data.historyOfPresentIllness?.resourceId) ?? {}),
                }}
              >
                {chiefComplaint}
              </Typography>
            )}
          </Section>
        )}

        {(editable || hpi) && (
          <Section title="History of Present Illness">
            {editable && onSaveField ? (
              <InlineNoteField
                label="History of Present Illness"
                value={hpi ?? ''}
                minRows={3}
                onSave={(text) => onSaveField('chiefComplaint', text)}
              />
            ) : (
              <Typography
                variant="body2"
                data-easy-chart-id={data.chiefComplaint?.resourceId}
                sx={{
                  whiteSpace: 'pre-wrap',
                  ...(itemSx(data.chiefComplaint?.resourceId) ?? {}),
                }}
              >
                {hpi}
              </Typography>
            )}
          </Section>
        )}

        {(editable || moi) && (
          <Section title="Mechanism of Injury">
            {editable && onSaveField ? (
              <InlineNoteField
                label="Mechanism of Injury"
                value={moi ?? ''}
                minRows={2}
                onSave={(text) => onSaveField('mechanismOfInjury', text)}
              />
            ) : (
              <Typography
                variant="body2"
                data-easy-chart-id={data.mechanismOfInjury?.resourceId}
                sx={{
                  whiteSpace: 'pre-wrap',
                  ...(itemSx(data.mechanismOfInjury?.resourceId) ?? {}),
                }}
              >
                {moi}
              </Typography>
            )}
          </Section>
        )}

        {/* ROS is a structured Observation collection (rosObservations) — the same shape as the
            exam findings — NOT a free-text field. Present the positive findings like Examination,
            with inline delete. The free-text `ros` is legacy; show it read-only only if present. */}
        {(rosText || positiveRos.length > 0) && (
          <Section title="Review of Systems">
            {positiveRos.length > 0 && (
              <Stack spacing={0.25}>
                {positiveRos.map((o) => (
                  <DeletableRow
                    key={o.field}
                    editable={editable}
                    resourceId={o.resourceId}
                    flashSx={itemSx(o.resourceId)}
                    onDelete={removeHandler('rosObservations', o)}
                  >
                    <Typography variant="body2">
                      • {o.label ?? o.field}
                      {o.note ? ` — ${o.note}` : ''}
                    </Typography>
                  </DeletableRow>
                ))}
              </Stack>
            )}
            {rosText && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: positiveRos.length ? 1 : 0 }}>
                {rosText}
              </Typography>
            )}
          </Section>
        )}

        {vitals.length > 0 && (
          <Section title="Vitals">
            <Stack spacing={0.25}>
              {vitals.map((v, i) => (
                <Typography key={v.resourceId ?? i} variant="body2">
                  • {formatVital(v)}
                </Typography>
              ))}
            </Stack>
          </Section>
        )}

        {(abnormalExam.length > 0 || examWithNotes.length > 0) && (
          <Section title="Examination">
            {abnormalExam.length > 0 && (
              <Box sx={{ mb: examWithNotes.length ? 1 : 0 }}>
                <Typography variant="caption" color="text.secondary">
                  Abnormal findings
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  {Array.from(examBySection.entries()).map(([label, findings]) => (
                    <Box key={label}>
                      <Typography variant="body2" fontWeight={600}>
                        {label}
                      </Typography>
                      <Stack spacing={0.25}>
                        {findings.map((f) => {
                          const checkedComponents = (f.components ?? []).filter((c) => c.value);
                          // Group component labels by their groupLabel so checked options read like the
                          // regular ExamCheckboxWithModal summary ("Frontal: Left, Right").
                          const componentsByGroup = new Map<string, string[]>();
                          for (const c of checkedComponents) {
                            const key = c.groupLabel || '';
                            const labels = componentsByGroup.get(key) ?? [];
                            labels.push(c.label);
                            componentsByGroup.set(key, labels);
                          }
                          const componentSummary = Array.from(componentsByGroup.entries())
                            .map(([g, labels]) => (g ? `${g}: ${labels.join(', ')}` : labels.join(', ')))
                            .join('; ');
                          return (
                            <DeletableRow
                              key={f.field}
                              editable={editable}
                              resourceId={f.resourceId}
                              flashSx={itemSx(f.resourceId)}
                              onDelete={removeHandler('examObservations', f)}
                            >
                              <Typography variant="body2">
                                • {f.label ?? f.field}
                                {componentSummary ? ` — ${componentSummary}` : ''}
                                {f.note ? ` — ${f.note}` : ''}
                              </Typography>
                            </DeletableRow>
                          );
                        })}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
            {examWithNotes
              .filter((f) => !abnormalExam.find((a) => a.field === f.field))
              .map((f) => (
                <Typography key={f.field} variant="body2">
                  • {FIELD_TO_SECTION_LABEL[f.field] ? `${FIELD_TO_SECTION_LABEL[f.field]}: ` : ''}
                  {f.label ?? f.field}: {f.note}
                </Typography>
              ))}
          </Section>
        )}

        {procedures.length > 0 && (
          <Section title="Procedures">
            <Stack spacing={1}>
              {procedures.map((p, i) => (
                <DeletableRow
                  key={p.resourceId ?? `${p.procedureType}-${i}`}
                  editable={editable}
                  resourceId={p.resourceId}
                  flashSx={itemSx(p.resourceId)}
                  onDelete={removeHandler('procedures', p)}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {formatProcedureType(p.procedureType) ?? '(unnamed procedure)'}
                  </Typography>
                  {(p.cptCodes ?? []).length > 0 && (
                    <Typography variant="body2">
                      <strong>CPT:</strong> {p.cptCodes!.map((c) => `${c.code} ${c.display ?? ''}`.trim()).join('; ')}
                    </Typography>
                  )}
                  {(p.diagnoses ?? []).length > 0 && (
                    <Typography variant="body2">
                      <strong>Dx:</strong> {p.diagnoses!.map((d) => `${d.code} ${d.display ?? ''}`.trim()).join('; ')}
                    </Typography>
                  )}
                  {p.bodySite && (
                    <Typography variant="body2">
                      <strong>Site:</strong> {p.bodySite}
                      {p.bodySide ? ` (${p.bodySide})` : ''}
                    </Typography>
                  )}
                  {p.medicationUsed && (
                    <Typography variant="body2">
                      <strong>Anesthesia / medication:</strong> {p.medicationUsed}
                    </Typography>
                  )}
                  {p.technique && p.technique.length > 0 && (
                    <Typography variant="body2">
                      <strong>Technique:</strong> {p.technique.join(', ')}
                    </Typography>
                  )}
                  {p.suppliesUsed && (
                    <Typography variant="body2">
                      <strong>Supplies:</strong> {p.suppliesUsed}
                    </Typography>
                  )}
                  {p.procedureDetails && (
                    <Typography variant="body2">
                      <strong>Details:</strong> {p.procedureDetails}
                    </Typography>
                  )}
                  {p.complications && (
                    <Typography variant="body2">
                      <strong>Complications:</strong> {p.complications}
                    </Typography>
                  )}
                  {p.patientResponse && (
                    <Typography variant="body2">
                      <strong>Patient response:</strong> {p.patientResponse}
                    </Typography>
                  )}
                  {p.postInstructions && (
                    <Typography variant="body2">
                      <strong>Post-procedure instructions:</strong> {p.postInstructions}
                    </Typography>
                  )}
                  {p.timeSpent && (
                    <Typography variant="body2">
                      <strong>Time spent:</strong> {p.timeSpent}
                    </Typography>
                  )}
                  {p.specimenSent !== undefined && (
                    <Typography variant="body2">
                      <strong>Specimen sent:</strong> {p.specimenSent ? 'Yes' : 'No'}
                    </Typography>
                  )}
                </DeletableRow>
              ))}
            </Stack>
          </Section>
        )}

        {dx.length > 0 && (
          <Section title="Assessment / Diagnoses">
            <Stack spacing={0.25}>
              {dx.map((d, i) =>
                renderAiChartable(
                  'diagnosis',
                  d,
                  <Typography variant="body2">
                    <strong>{d.code}</strong> — {d.display}
                    {d.isPrimary && ' (primary)'}
                  </Typography>,
                  <DeletableRow
                    key={d.resourceId ?? `${d.code}-${i}`}
                    editable={editable}
                    resourceId={d.resourceId}
                    flashSx={itemSx(d.resourceId)}
                    onDelete={removeHandler('diagnosis', d)}
                  >
                    <Typography variant="body2">
                      <strong>{d.code}</strong> — {d.display}
                      {d.isPrimary && ' (primary)'}
                    </Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
          </Section>
        )}

        {(editable || mdm) && (
          <Section title="Medical Decision Making">
            {editable && onSaveField ? (
              <InlineNoteField
                label="Medical Decision Making"
                value={mdm ?? ''}
                minRows={3}
                onSave={(text) => onSaveField('medicalDecision', text)}
              />
            ) : (
              <Typography
                variant="body2"
                data-easy-chart-id={data.medicalDecision?.resourceId}
                sx={{
                  whiteSpace: 'pre-wrap',
                  ...(itemSx(data.medicalDecision?.resourceId) ?? {}),
                }}
              >
                {mdm}
              </Typography>
            )}
          </Section>
        )}

        {emCode && (
          <Section title="E&M Code">
            {renderAiChartable(
              'emCode',
              emCode,
              <Typography variant="body2">
                <strong>{emCode.code}</strong>
                {emCode.display ? ` — ${emCode.display}` : ''}
              </Typography>,
              <DeletableRow
                editable={editable}
                resourceId={emCode.resourceId}
                flashSx={itemSx(emCode.resourceId)}
                onDelete={removeHandler('emCode', emCode)}
              >
                <Typography variant="body2">
                  <strong>{emCode.code}</strong>
                  {emCode.display ? ` — ${emCode.display}` : ''}
                </Typography>
              </DeletableRow>
            )}
          </Section>
        )}

        {cptCodes.length > 0 && (
          <Section title="CPT Codes">
            <Stack spacing={0.25}>
              {cptCodes.map((c, i) =>
                renderAiChartable(
                  'cptCodes',
                  c,
                  <Typography variant="body2">
                    <strong>{c.code}</strong>
                    {c.display ? ` — ${c.display}` : ''}
                  </Typography>,
                  <DeletableRow
                    key={c.resourceId ?? `${c.code}-${i}`}
                    editable={editable}
                    resourceId={c.resourceId}
                    flashSx={itemSx(c.resourceId)}
                    onDelete={removeHandler('cptCodes', c)}
                  >
                    <Typography variant="body2">
                      <strong>{c.code}</strong>
                      {c.display ? ` — ${c.display}` : ''}
                    </Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
          </Section>
        )}

        {instructions.length > 0 && (
          <CollapsibleSection title={`Patient Instructions (${instructions.length})`}>
            <Stack spacing={0.5}>
              {instructions.map((c, i) => (
                <Box key={c.resourceId ?? i}>
                  {c.title && (
                    <Typography variant="body2" fontWeight={600}>
                      {c.title}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {c.text}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CollapsibleSection>
        )}
      </Stack>
    </Paper>
  );
}

async function fetchEasyChartData(
  apiClient: NonNullable<ReturnType<typeof useOystehrAPIClient>>,
  encounterId: string
): Promise<GetChartDataResponse> {
  // The note-style fields (CC/HPI/MOI/ROS/MDM) are only returned with explicit requestedFields,
  // while diagnosis/exam/ros observations only return from a full unscoped call. Fetch both.
  const [noteFields, fullChart] = await Promise.all([
    apiClient.getChartData({ encounterId, requestedFields: progressNoteChartDataRequestedFields }),
    apiClient.getChartData({ encounterId }),
  ]);
  return { ...fullChart, ...noteFields };
}

// ===== Refine-bar agent helpers ===========================================================

// Intents that go through the canonical search → confirm/choose flow (display + searchTerms).
type AddSearchIntent = Extract<
  EasyChartAgentIntent,
  | { kind: 'add-allergy' }
  | { kind: 'add-condition' }
  | { kind: 'add-medication' }
  | { kind: 'add-surgical-history' }
  | { kind: 'add-hospitalization' }
  | { kind: 'add-diagnosis' }
>;

interface SearchResult {
  id?: string | number;
  code?: string;
  name: string;
  strength?: string;
}

type ConvStep =
  | { kind: 'thinking'; user: string }
  | { kind: 'unknown'; user: string; reply: string }
  | { kind: 'no-match'; user: string; intent: AddSearchIntent }
  | { kind: 'choose'; user: string; intent: AddSearchIntent; results: SearchResult[] }
  | { kind: 'saving'; user: string; chosenName: string }
  | { kind: 'done'; user: string; chosenName: string }
  | { kind: 'removed'; user: string; chosenName: string }
  | { kind: 'no-match-remove'; user: string; intent: RemoveIntent }
  | { kind: 'choose-remove'; user: string; intent: RemoveIntent; matches: RemoveMatch[] }
  | { kind: 'removing'; user: string; chosenName: string }
  | { kind: 'no-match-template'; user: string; intent: ApplyTemplateIntent }
  | { kind: 'choose-template'; user: string; intent: ApplyTemplateIntent; matches: TemplateMatch[] }
  | { kind: 'applying-template'; user: string; chosenName: string }
  | { kind: 'applied-template'; user: string; chosenName: string }
  | { kind: 'no-match-procedure'; user: string; intent: AddProcedureIntent }
  | { kind: 'choose-procedure'; user: string; intent: AddProcedureIntent; matches: ProcedureQuickPickData[] }
  | { kind: 'no-procedure-to-update'; user: string; intent: UpdateProcedureIntent }
  | {
      kind: 'choose-procedure-to-update';
      user: string;
      intent: UpdateProcedureIntent;
      candidates: ProcedureDTO[];
    }
  | { kind: 'updating-procedure'; user: string; chosenName: string }
  | { kind: 'updated-procedure'; user: string; chosenName: string; summary: string }
  | { kind: 'editing-note-text'; user: string; fieldLabel: string }
  | { kind: 'edited-note-text'; user: string; fieldLabel: string }
  | { kind: 'no-match-exam'; user: string; intent: AddExamFindingIntent }
  | { kind: 'choose-exam'; user: string; intent: AddExamFindingIntent; matches: ExamLeaf[] }
  | { kind: 'no-match-exam-remove'; user: string; intent: RemoveExamFindingIntent }
  | {
      kind: 'choose-exam-remove';
      user: string;
      intent: RemoveExamFindingIntent;
      matches: ExamRemoveItem[];
    }
  | { kind: 'error'; user: string; reply: string }
  // Provider chose to skip the current picker without picking. Terminal — advances the plan
  // cursor with status="skipped" so the running step list shows ⏭.
  | { kind: 'skipped'; user: string }
  // Plan preview: planner has returned a decomposed step list; provider sees it and clicks
  // Approve to kick off execution. Holds the narrative + steps so we can pass them on to
  // setPlan when approved. Not a terminal state in the plan-progression sense — there's no
  // plan active yet.
  | { kind: 'plan-preview'; user: string; narrative: string; steps: EasyChartAgentIntent[] };

// A removable exam item — either a whole observation or one of its checked components.
interface ExamRemoveItem {
  resourceId: string;
  observationField: string;
  observationLabel?: string;
  displayName: string;
  // Body-system label the observation lives under (e.g. "Nose") so the picker can show the
  // same context the note's exam section uses.
  section: string;
  // Set only when this item represents one component on a multi-component observation.
  componentCode?: string;
}

type ApplyTemplateIntent = Extract<EasyChartAgentIntent, { kind: 'apply-template' }>;
type AddProcedureIntent = Extract<EasyChartAgentIntent, { kind: 'add-procedure' }>;
type UpdateProcedureIntent = Extract<EasyChartAgentIntent, { kind: 'update-procedure' }>;
type AddExamFindingIntent = Extract<EasyChartAgentIntent, { kind: 'add-exam-finding' }>;
type RemoveExamFindingIntent = Extract<EasyChartAgentIntent, { kind: 'remove-exam-finding' }>;
type AddRosFindingIntent = Extract<EasyChartAgentIntent, { kind: 'add-ros-finding' }>;
interface TemplateMatch {
  id: string;
  title: string;
}

type RemoveIntent = Extract<
  EasyChartAgentIntent,
  | { kind: 'remove-allergy' }
  | { kind: 'remove-condition' }
  | { kind: 'remove-medication' }
  | { kind: 'remove-surgical-history' }
  | { kind: 'remove-hospitalization' }
  | { kind: 'remove-diagnosis' }
>;

// A candidate item in the patient's chart that matches a remove intent.
interface RemoveMatch {
  resourceId: string;
  displayName: string;
  // Payload passed to deleteChartData
  field: 'allergies' | 'conditions' | 'medications' | 'surgicalHistory' | 'episodeOfCare' | 'diagnosis';
  dto: unknown;
}

function isRemoveIntent(intent: EasyChartAgentIntent): intent is RemoveIntent {
  return (
    intent.kind === 'remove-allergy' ||
    intent.kind === 'remove-condition' ||
    intent.kind === 'remove-medication' ||
    intent.kind === 'remove-surgical-history' ||
    intent.kind === 'remove-hospitalization' ||
    intent.kind === 'remove-diagnosis'
  );
}

function findRemoveMatches(intent: RemoveIntent, data: GetChartDataResponse | null): RemoveMatch[] {
  if (!data) return [];
  const terms = [intent.display, ...intent.searchTerms].map((t) => t.toLowerCase()).filter(Boolean);
  const nameMatches = (haystack: string | undefined | null): boolean => {
    if (!haystack) return false;
    const h = haystack.toLowerCase();
    return terms.some((t) => h.includes(t) || t.includes(h));
  };

  const out: RemoveMatch[] = [];
  if (intent.kind === 'remove-allergy') {
    (data.allergies ?? []).forEach((a) => {
      if (a.resourceId && nameMatches(a.name)) {
        out.push({ resourceId: a.resourceId, displayName: a.name ?? '(unnamed)', field: 'allergies', dto: a });
      }
    });
  } else if (intent.kind === 'remove-condition') {
    (data.conditions ?? []).forEach((c) => {
      if (c.resourceId && (nameMatches(c.display) || (c.code && terms.some((t) => c.code!.toLowerCase() === t)))) {
        out.push({
          resourceId: c.resourceId,
          displayName: c.display ?? c.code ?? '(unnamed)',
          field: 'conditions',
          dto: c,
        });
      }
    });
  } else if (intent.kind === 'remove-medication') {
    (data.medications ?? []).forEach((m) => {
      if (m.resourceId && nameMatches(m.name)) {
        out.push({ resourceId: m.resourceId, displayName: m.name, field: 'medications', dto: m });
      }
    });
  } else if (intent.kind === 'remove-surgical-history') {
    (data.surgicalHistory ?? []).forEach((s) => {
      if (s.resourceId && (nameMatches(s.display) || terms.some((t) => s.code === t))) {
        out.push({
          resourceId: s.resourceId,
          displayName: s.display ?? s.code ?? '(unnamed)',
          field: 'surgicalHistory',
          dto: s,
        });
      }
    });
  } else if (intent.kind === 'remove-hospitalization') {
    (data.episodeOfCare ?? []).forEach((h) => {
      if (h.resourceId && (nameMatches(h.display) || terms.some((t) => h.code === t))) {
        out.push({
          resourceId: h.resourceId,
          displayName: h.display ?? h.code ?? '(unnamed)',
          field: 'episodeOfCare',
          dto: h,
        });
      }
    });
  } else if (intent.kind === 'remove-diagnosis') {
    (data.diagnosis ?? []).forEach((d) => {
      if (d.resourceId && (nameMatches(d.display) || terms.some((t) => d.code.toLowerCase() === t))) {
        out.push({ resourceId: d.resourceId, displayName: `${d.code} — ${d.display}`, field: 'diagnosis', dto: d });
      }
    });
  }
  return out;
}

function filterStaticOptions(options: { display: string; code: string }[], term: string): SearchResult[] {
  const lower = term.toLowerCase();
  return options.filter((o) => o.display.toLowerCase().includes(lower)).map((o) => ({ name: o.display, code: o.code }));
}

// Walk every list + scalar field on a chart-data snapshot and return the union of resourceIds.
// Used to diff before/after apply-template so we can flash everything the template just added.
function collectResourceIds(data: GetChartDataResponse | null): Set<string> {
  const ids = new Set<string>();
  if (!data) return ids;
  const arr = (xs: { resourceId?: string }[] | undefined): void => {
    (xs ?? []).forEach((x) => x.resourceId && ids.add(x.resourceId));
  };
  arr(data.diagnosis);
  arr(data.conditions);
  arr(data.allergies);
  arr(data.medications);
  arr(data.surgicalHistory);
  arr(data.episodeOfCare);
  arr(data.examObservations);
  arr(data.rosObservations);
  arr(data.vitalsObservations);
  arr(data.instructions);
  arr(data.cptCodes);
  arr(data.procedures);
  for (const scalar of [
    data.chiefComplaint,
    data.historyOfPresentIllness,
    data.mechanismOfInjury,
    data.ros,
    data.medicalDecision,
    data.emCode,
  ]) {
    if (scalar?.resourceId) ids.add(scalar.resourceId);
  }
  return ids;
}

// Match a template against the user's intent. Tokenize on non-word characters and accept
// substring matches in either direction so "lac repair" matches "Laceration, Scalp" via
// "lac" ⊂ "laceration", and "laceration" matches "lac" too. A template matches when ANY
// query token (across display + searchTerms) substring-matches ANY title token. Lenient by
// design — with a small template list it's better to over-suggest and let the provider pick.
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}
// Words a provider often says when asking for a template that aren't part of any title.
// Filtering these prevents "apply lac repair template" from matching every title containing
// the word "template" (e.g. "Athena's Empty Template").
const TEMPLATE_QUERY_STOPWORDS = new Set([
  'apply',
  'use',
  'template',
  'templates',
  'for',
  'the',
  'a',
  'an',
  'of',
  'and',
  'please',
  'to',
]);
function findTemplateMatches(intent: ApplyTemplateIntent, templates: TemplateMatch[]): TemplateMatch[] {
  // Use only the provider's display phrase, not the LLM-supplied searchTerms — the model
  // tends to over-expand (e.g. emitting "ankle laceration" for "lac repair"). Prefix match
  // on title tokens (≥2 chars) so "lac" matches "laceration" but NOT "placement" — substring
  // matching was too loose (placement contains "lac" inside p-lac-ement).
  const queryTokens = tokenize(intent.display)
    .filter((tok) => tok.length >= 2)
    .filter((tok) => !TEMPLATE_QUERY_STOPWORDS.has(tok));
  if (queryTokens.length === 0) return [];
  const queryDisplay = intent.display.trim().toLowerCase();
  // Score each template title:
  //   - 1000 if title (case-insensitive) equals the provider's display verbatim — perfect match.
  //   - +20 per query token that has an EXACT match (whole-token) in the title.
  //   - +5 per query token that has a PREFIX match in the title (partial).
  //   - +10 if every query token matched (allMatched bonus).
  //   - −10 length penalty per extra title token beyond what the query asked for, so
  //     "AOM Right" outranks "AOM Right (acute otitis media) with watch and wait" when the
  //     provider just asked for "AOM Right".
  const scored = templates
    .map((t) => {
      const titleTokens = tokenize(t.title);
      const titleLower = t.title.trim().toLowerCase();
      let score = 0;
      let allMatched = true;
      for (const qt of queryTokens) {
        const exact = titleTokens.includes(qt);
        const prefix = !exact && titleTokens.some((tt) => tt.startsWith(qt));
        if (exact) score += 20;
        else if (prefix) score += 5;
        else allMatched = false;
      }
      if (allMatched && queryTokens.length > 1) score += 10;
      if (titleLower === queryDisplay) score += 1000;
      // Length penalty: extra tokens in the title beyond the query length are noise.
      const extraTokens = Math.max(0, titleTokens.length - queryTokens.length);
      score -= extraTokens * 2;
      return { t, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.t);
}

// Same shape as template matching: forward substring match against quick-pick names,
// stopwords stripped so "add lac repair procedure" doesn't pollute results.
const PROCEDURE_QUERY_STOPWORDS = new Set([
  'add',
  'do',
  'perform',
  'procedure',
  'procedures',
  'a',
  'an',
  'the',
  'of',
  'for',
  'and',
  'please',
  'to',
]);
// Same prefix-token strategy used for templates/procedures, plus a few exam-specific
// noise words. Each search term (display + LLM searchTerms) is tested independently; a leaf
// matches if any of its label OR section tokens has a prefix-match for at least one of the
// search term's non-stopword tokens. Score = number of matching tokens, used to rank.
const EXAM_QUERY_STOPWORDS = new Set([
  'add',
  'exam',
  'finding',
  'abnormal',
  'normal',
  'the',
  'a',
  'an',
  'on',
  'of',
  'has',
  'patient',
  'check',
  'to',
  'and',
]);
// Body-region equivalence classes — every token in a list collapses to the same region key.
// Used by findExamLeafMatches to constrain candidates to the body region the provider named.
// "throat" should match the "Oral Cavity" section's "Erythematous pharynx" leaf because
// throat/pharynx/oral cavity are the same clinical region; an exact-token gate misses that.
const EXAM_BODY_REGION_CLASSES: string[][] = [
  ['throat', 'pharynx', 'oropharynx', 'oral', 'mouth', 'tonsils', 'tonsillar', 'palate', 'uvula', 'dentition'],
  ['lungs', 'lung', 'pulmonary', 'chest', 'wheezing', 'rales', 'rhonchi'],
  ['heart', 'cardiac', 'cv', 'cardiovascular'],
  ['abdomen', 'abdominal', 'belly', 'gi', 'rectum', 'genitourinary', 'gu', 'cva'],
  ['ears', 'ear', 'tm', 'tympanic', 'auditory', 'auricle'],
  ['nose', 'nasal', 'sinus', 'sinuses', 'rhinoscopy', 'septum', 'turbinate'],
  ['eyes', 'eye', 'conjunctiva', 'sclera', 'pupil', 'pupils', 'ocular'],
  ['skin', 'dermatologic', 'dermatology', 'rash'],
  ['neck', 'lymph', 'cervical'],
  ['head', 'scalp'],
  ['extremities', 'extremity', 'limbs', 'arm', 'leg', 'ankle', 'knee', 'shoulder', 'hip', 'foot', 'hand', 'wrist'],
  ['back', 'spine', 'spinal'],
  ['neurologic', 'neuro', 'neurological'],
  ['musculoskeletal', 'msk'],
  ['general', 'appearance'],
];
const EXAM_BODY_REGION_OF: Map<string, number> = new Map();
EXAM_BODY_REGION_CLASSES.forEach((cls, i) => cls.forEach((t) => EXAM_BODY_REGION_OF.set(t, i)));

// Clinical descriptor synonyms. Provider says one word, catalog uses another — without a
// synonym map, "throat injected" finds nothing because the catalog says "Erythematous pharynx".
// Each row collapses to one canonical key; tokens map to it. Used by findExamLeafMatches to
// expand query tokens before scoring.
const EXAM_DESCRIPTOR_SYNONYMS: string[][] = [
  ['injected', 'erythematous', 'erythema', 'red', 'reddened', 'inflamed'],
  ['tender', 'tenderness', 'painful'],
  ['swollen', 'edematous', 'edema', 'swelling'],
  ['bulging', 'bulge'],
  ['exudate', 'pus', 'purulent'],
  ['rales', 'crackles'],
  ['discharge', 'drainage'],
  ['lesion', 'ulcer', 'ulcers', 'vesicle', 'vesicles'],
  ['rash', 'eruption', 'dermatitis'],
];
const EXAM_DESCRIPTOR_CLASS_OF: Map<string, number> = new Map();
EXAM_DESCRIPTOR_SYNONYMS.forEach((cls, i) => cls.forEach((t) => EXAM_DESCRIPTOR_CLASS_OF.set(t, i)));

const EXAM_NEGATION_TOKENS = new Set(['no', 'non', 'without', 'denies', 'absent', 'negative']);

// Tokens that, when in the query, signal the provider is asking about an abnormal/lost/reduced
// version of a finding. Catalog labels typically describe the POSITIVE/INTACT form ("pearly with
// good light reflex", "reactive to light"). When the query has a negator like "loss" near a
// descriptor token, we should NOT pick a positive-form leaf containing that descriptor.
// Distinct from EXAM_NEGATION_TOKENS (which is about labels being structurally negated, like
// "non-injected"); these are query-level negators that flip the polarity of the WHOLE finding.
const EXAM_QUERY_NEGATORS = new Set([
  'loss',
  'lost',
  'absent',
  'absence',
  'no',
  'non',
  'without',
  'denies',
  'reduced',
  'decreased',
  'diminished',
  'impaired',
  'poor',
  'weak',
  'abnormal',
  'abnormality',
  'abnormalities',
]);

function findExamLeafMatches(intent: AddExamFindingIntent, leaves: ExamLeaf[]): ExamLeaf[] {
  // Use only the provider's display phrase — LLM-expanded searchTerms produced too many ties.
  const queryTokens = tokenize(intent.display).filter((tok) => tok.length >= 2 && !EXAM_QUERY_STOPWORDS.has(tok));
  if (queryTokens.length === 0) return [];

  // Body-region constraint: if the provider named a region, require the leaf's section (or its
  // label) to overlap with the SAME equivalence class. "throat" → matches leaves under "Oral
  // Cavity" with labels like "Erythematous pharynx" because throat/pharynx/oral are clinically
  // synonymous. Without this gate, "Throat injected" can match "Eyes — non-injected" because
  // "injected" is a substring of "non-injected" once tokenized.
  const queryRegionClasses = new Set<number>();
  for (const t of queryTokens) {
    const cls = EXAM_BODY_REGION_OF.get(t);
    if (cls !== undefined) queryRegionClasses.add(cls);
  }

  // The query is a positive assertion unless it itself contains negation tokens (e.g. provider
  // typed "no rash"). If query is positive, leaves whose label is itself a negation of one of
  // our query tokens (e.g. "non-injected" matches "injected" but they mean opposite things)
  // must be filtered out.
  const queryIsPositive = !queryTokens.some((t) => EXAM_NEGATION_TOKENS.has(t));
  // Symmetric query-side polarity: if the query contains a negator like "loss" / "decreased"
  // / "no", the provider is reporting an abnormal/missing form of a finding. Penalize
  // positive-form leaves that share the descriptor (e.g. "loss of light reflex" should NOT
  // pick "Right TM pearly with GOOD light reflex").
  const queryIsNegative = queryTokens.some((t) => EXAM_QUERY_NEGATORS.has(t));

  // For each label, build the indices of negation tokens so we can check whether a matched
  // token sits immediately after one (e.g. "no" + "rash" or "non" + "injected").
  const tokenizeWithNegationIndex = (s: string): { tokens: string[]; isNegated: boolean[] } => {
    const tokens = tokenize(s);
    const isNegated = tokens.map((_, i) => {
      // "non-injected" tokenizes to ["non", "injected"] — the "injected" at i is negated by
      // tokens[i-1] === "non". Same for "no rash" and "without exudate".
      const prev = i > 0 ? tokens[i - 1] : '';
      return EXAM_NEGATION_TOKENS.has(prev);
    });
    return { tokens, isNegated };
  };

  const scoreLeaf = (leaf: ExamLeaf): number => {
    const labelInfo = tokenizeWithNegationIndex(leaf.label);
    const sectionTokens = tokenize(leaf.section);

    // Body-region gate: if the provider named a region, require the leaf's section/label to
    // contain a token in the SAME equivalence class. No overlap → skip.
    if (queryRegionClasses.size > 0) {
      const leafTokens = [...labelInfo.tokens, ...sectionTokens];
      const leafInQueryRegion = leafTokens.some((t) => {
        const cls = EXAM_BODY_REGION_OF.get(t);
        return cls !== undefined && queryRegionClasses.has(cls);
      });
      if (!leafInQueryRegion) return 0;
    }

    // Synonym match: a query token "matches" a leaf token if they're literally equal OR if
    // they're in the same EXAM_DESCRIPTOR_SYNONYMS class (so "injected" matches "erythematous").
    const tokensMatch = (qt: string, lt: string): boolean => {
      if (lt === qt) return true;
      const qCls = EXAM_DESCRIPTOR_CLASS_OF.get(qt);
      if (qCls === undefined) return false;
      return EXAM_DESCRIPTOR_CLASS_OF.get(lt) === qCls;
    };

    // Query-side polarity check: if query is negative ("loss of light reflex"), the right leaf
    // is on the abnormal side OR has the same descriptor token negated in the label
    // ("No CVA tenderness" for "no CVA tenderness"). A normal-form leaf describing the intact
    // version of the feature (e.g. "pearly with GOOD light reflex") is a clinical mismatch.
    if (queryIsNegative && leaf.normalAbnormal === 'normal') {
      // Check whether the leaf already encodes the negation (a "No X" / "Without Y" normal leaf
      // legitimately matches a negative query). If not, treat as polarity mismatch and skip.
      const hasOwnNegation = labelInfo.isNegated.some(Boolean);
      if (!hasOwnNegation) return 0;
    }

    let total = 0;
    let anyTokenMatched = false;
    let allMatched = true;
    for (const qt of queryTokens) {
      let labelBest = 0;
      let labelBestNegated = false;
      for (let i = 0; i < labelInfo.tokens.length; i++) {
        const lt = labelInfo.tokens[i];
        if (tokensMatch(qt, lt)) {
          labelBest = 4;
          labelBestNegated = labelInfo.isNegated[i];
          break;
        }
        if (lt.startsWith(qt) && labelBest < 2) {
          labelBest = 2;
          labelBestNegated = labelInfo.isNegated[i];
        }
      }
      if (queryIsPositive && labelBest > 0 && labelBestNegated) {
        labelBest = -labelBest;
      }
      let sectionBest = 0;
      for (const st of sectionTokens) {
        if (tokensMatch(qt, st)) {
          sectionBest = 3;
          break;
        }
        if (st.startsWith(qt)) sectionBest = Math.max(sectionBest, 1);
      }
      const tokenScore = labelBest + sectionBest;
      if (tokenScore > 0) anyTokenMatched = true;
      else allMatched = false;
      total += tokenScore;
    }
    if (allMatched && queryTokens.length > 1) total += 2;
    // Baseline score for in-region leaves with no specific token match — surface them as
    // candidates when the provider's descriptor words don't appear literally in any catalog
    // leaf ("throat injected" → all Oral Cavity findings) instead of saying "no match found".
    if (queryRegionClasses.size > 0 && !anyTokenMatched) total += 1;
    return total;
  };

  const scored = leaves
    .map((leaf) => ({ leaf, score: scoreLeaf(leaf) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 12).map((s) => s.leaf);
}

// Match a ROS finding intent (e.g. "Fever") to ROS catalog items by token overlap on the item
// label (and a weaker signal from the system name). The denies/reports state is on the intent, not
// matched here.
function findRosLeafMatches(intent: AddRosFindingIntent, leaves: RosLeaf[]): RosLeaf[] {
  const queryStrings = [intent.display, ...(intent.searchTerms ?? [])];
  const queryTokens = new Set(
    queryStrings.flatMap((s) => tokenize(s)).filter((tok) => tok.length >= 2 && !EXAM_QUERY_STOPWORDS.has(tok))
  );
  if (queryTokens.size === 0) return [];
  const scored = leaves
    .map((leaf) => {
      const labelTokens = tokenize(leaf.label);
      const systemTokens = tokenize(leaf.system);
      let score = 0;
      for (const qt of queryTokens) {
        if (labelTokens.includes(qt)) score += 4;
        else if (labelTokens.some((lt) => lt.startsWith(qt) || qt.startsWith(lt))) score += 2;
        if (systemTokens.includes(qt)) score += 1;
      }
      return { leaf, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 12).map((s) => s.leaf);
}

// Build the list of removable exam items from the chart. Plain checkbox observations get one
// entry; observations with checked modal components get one entry per checked component so
// the picker reflects what the provider actually sees ticked on the chart.
function buildExamRemoveItems(observations: ExamObservationDTO[] | undefined): ExamRemoveItem[] {
  const out: ExamRemoveItem[] = [];
  for (const o of observations ?? []) {
    if (!o.value || !o.resourceId) continue;
    const section = FIELD_TO_SECTION_LABEL[o.field] ?? 'Other';
    const checkedComponents = (o.components ?? []).filter((c) => c.value);
    if (checkedComponents.length === 0) {
      out.push({
        resourceId: o.resourceId,
        observationField: o.field,
        observationLabel: o.label,
        section,
        displayName: o.label ?? o.field,
      });
    } else {
      for (const c of checkedComponents) {
        const group = c.groupLabel ? `${c.groupLabel}: ` : '';
        out.push({
          resourceId: o.resourceId,
          observationField: o.field,
          observationLabel: o.label,
          section,
          componentCode: c.code,
          displayName: `${o.label ?? o.field} — ${group}${c.label}`,
        });
      }
    }
  }
  return out;
}

function findExamRemoveMatches(intent: RemoveExamFindingIntent, items: ExamRemoveItem[]): ExamRemoveItem[] {
  const queryTokens = tokenize(intent.display).filter((tok) => tok.length >= 2 && !EXAM_QUERY_STOPWORDS.has(tok));
  if (queryTokens.length === 0) return [];
  const scored = items
    .map((item) => {
      const haystack = tokenize(item.displayName);
      let total = 0;
      let allMatched = true;
      for (const qt of queryTokens) {
        let best = 0;
        for (const ht of haystack) {
          if (ht === qt) {
            best = 4;
            break;
          }
          if (ht.startsWith(qt)) best = Math.max(best, 2);
        }
        if (best === 0) allMatched = false;
        total += best;
      }
      if (allMatched && queryTokens.length > 1) total += 2;
      return { item, score: total };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 12).map((s) => s.item);
}

function findProcedureMatches(
  intent: AddProcedureIntent,
  quickPicks: ProcedureQuickPickData[]
): ProcedureQuickPickData[] {
  const queryTokens = tokenize(intent.display)
    .filter((tok) => tok.length >= 2)
    .filter((tok) => !PROCEDURE_QUERY_STOPWORDS.has(tok));
  if (queryTokens.length === 0) return [];
  return quickPicks.filter((qp) => {
    const nameTokens = tokenize(qp.name);
    return queryTokens.some((qt) => nameTokens.some((nt) => nt.startsWith(qt)));
  });
}

// Build a ProcedureDTO from a quick pick the same way the regular Procedures page would when
// the provider picks a quick pick and clicks Save without editing: pre-fill from the quick
// pick's QUICK_PICK_APPLY_KEYS, default procedureDateTime/documentedDateTime to now, join
// the multi-value string[] fields (suppliesUsed, postInstructions) since the saved DTO is a
// single string for those.
function procedureDtoFromQuickPick(
  qp: ProcedureQuickPickData,
  procedureTypeNameByCode: Map<string, string>
): ProcedureDTO {
  const joinList = (xs: (string | undefined)[] | undefined): string | undefined => {
    const cleaned = (xs ?? []).filter((x): x is string => !!x && x.trim().length > 0);
    return cleaned.length > 0 ? cleaned.join(', ') : undefined;
  };
  const now = new Date().toISOString();
  // Match the regular ProceduresNew flow: save the human-readable name (e.g. "Laceration
  // Repair") for procedureType so the saved DTO matches the dropdown label rather than the
  // kebab-case code. Fall back to the raw code if the value set hasn't loaded or lacks the entry.
  const procedureType = qp.procedureType
    ? procedureTypeNameByCode.get(qp.procedureType) ?? qp.procedureType
    : undefined;
  return {
    procedureType,
    cptCodes: qp.cptCodes,
    procedureDateTime: now,
    documentedDateTime: now,
    medicationUsed: qp.medicationUsed,
    bodySite: qp.bodySite,
    bodySide: qp.bodySide,
    technique: qp.technique,
    suppliesUsed: joinList(qp.suppliesUsed),
    procedureDetails: qp.procedureDetails,
    specimenSent: qp.specimenSent,
    complications: qp.complications,
    patientResponse: qp.patientResponse,
    postInstructions: joinList(qp.postInstructions),
    timeSpent: qp.timeSpent,
    documentedBy: qp.documentedBy,
  };
}

// Canonical ProcedureDTO field a free-text field name maps to. The agent prompt asks the LLM
// to use canonical names, but providers may also paraphrase, so accept common synonyms too.
const PROCEDURE_FIELD_ALIASES: Record<string, keyof ProcedureDTO> = {
  bodysite: 'bodySite',
  site: 'bodySite',
  location: 'bodySite',
  bodyside: 'bodySide',
  side: 'bodySide',
  laterality: 'bodySide',
  technique: 'technique',
  suppliesused: 'suppliesUsed',
  supplies: 'suppliesUsed',
  instruments: 'suppliesUsed',
  proceduredetails: 'procedureDetails',
  details: 'procedureDetails',
  medicationused: 'medicationUsed',
  medication: 'medicationUsed',
  anesthesia: 'medicationUsed',
  complications: 'complications',
  patientresponse: 'patientResponse',
  response: 'patientResponse',
  postinstructions: 'postInstructions',
  'post-instructions': 'postInstructions',
  postprocedureinstructions: 'postInstructions',
  timespent: 'timeSpent',
  time: 'timeSpent',
  performertype: 'performerType',
  performer: 'performerType',
  documentedby: 'documentedBy',
  specimensent: 'specimenSent',
  specimen: 'specimenSent',
  consentobtained: 'consentObtained',
  consent: 'consentObtained',
};

function resolveProcedureField(rawField: string): keyof ProcedureDTO | undefined {
  return PROCEDURE_FIELD_ALIASES[rawField.toLowerCase().replace(/[^a-z]/g, '')];
}

// Choose the procedure the update intent targets. If only one exists, that's it. Otherwise
// fuzzy-match by procedureType + first CPT display against the (optional) procedureMatch hint.
function findProceduresToUpdate(intent: UpdateProcedureIntent, procedures: ProcedureDTO[]): ProcedureDTO[] {
  if (procedures.length === 0) return [];
  if (procedures.length === 1) return procedures;
  if (!intent.procedureMatch) return procedures;
  const qTokens = tokenize(intent.procedureMatch).filter((t) => t.length >= 2);
  if (qTokens.length === 0) return procedures;
  const matched = procedures.filter((p) => {
    const haystack = `${p.procedureType ?? ''} ${(p.cptCodes ?? []).map((c) => c.display ?? '').join(' ')}`;
    const haystackTokens = tokenize(haystack);
    return qTokens.some((qt) => haystackTokens.some((ht) => ht.startsWith(qt)));
  });
  return matched.length > 0 ? matched : procedures;
}

// Apply { field, value } updates to a clone of the procedure. Field names are normalized via
// PROCEDURE_FIELD_ALIASES, "technique" splits CSV into array, boolean fields parse true/false.
// Returns { updated, applied, skipped } so the conversation can summarize what changed.
// Coerce a free-text value to a canonical code from a value-set map. The LLM might emit
// the code ("sterile"), the display ("Sterile"), or some near-match ("sterile technique").
// Returns the canonical code on match, or undefined.
function coerceToAllowedCode(value: string, allowed: Map<string, string>): string | undefined {
  if (allowed.size === 0) return undefined;
  const v = value.toLowerCase().trim();
  // Exact code match.
  for (const code of allowed.keys()) {
    if (code.toLowerCase() === v) return code;
  }
  // Exact display match.
  for (const [code, display] of allowed) {
    if (display.toLowerCase() === v) return code;
  }
  // Prefix-or-substring on display — "sterile" → "Sterile technique".
  for (const [code, display] of allowed) {
    const d = display.toLowerCase();
    if (d.startsWith(v) || v.startsWith(d) || d.includes(v)) return code;
  }
  return undefined;
}

// Free-text fields that don't have a constrained value-set; pass through whatever the LLM says.
const FREE_TEXT_PROCEDURE_FIELDS = new Set<keyof ProcedureDTO>(['procedureDetails', 'documentedBy', 'performerType']);

function applyProcedureUpdates(
  procedure: ProcedureDTO,
  updates: { field: string; value: string }[],
  allowedByField: Map<keyof ProcedureDTO, Map<string, string>>
): { updated: ProcedureDTO; applied: { field: keyof ProcedureDTO; value: unknown }[]; skipped: string[] } {
  const next: ProcedureDTO = { ...procedure };
  const applied: { field: keyof ProcedureDTO; value: unknown }[] = [];
  const skipped: string[] = [];
  const summarizeAllowed = (allowed: Map<string, string>): string => {
    const entries = Array.from(allowed.values()).slice(0, 8);
    const more = allowed.size > entries.length ? `, … (${allowed.size - entries.length} more)` : '';
    return entries.join(', ') + more;
  };
  for (const u of updates) {
    const field = resolveProcedureField(u.field);
    if (!field) {
      skipped.push(u.field);
      continue;
    }
    if (field === 'specimenSent' || field === 'consentObtained') {
      const v = u.value.toLowerCase().trim();
      const bool =
        v === 'true' || v === 'yes' || v === 'y' ? true : v === 'false' || v === 'no' || v === 'n' ? false : undefined;
      if (bool === undefined) {
        skipped.push(`${u.field} (expected true/false, got "${u.value}")`);
        continue;
      }
      next[field] = bool;
      applied.push({ field, value: bool });
    } else if (field === 'technique') {
      // technique is an array. Split CSV/semicolon, validate each token against the value
      // set, and keep only the valid ones. Empty result means "no update".
      const allowed = allowedByField.get('technique');
      const raw = u.value
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const validCodes: string[] = [];
      const invalid: string[] = [];
      for (const r of raw) {
        const code = allowed ? coerceToAllowedCode(r, allowed) : r;
        if (code) validCodes.push(code);
        else invalid.push(r);
      }
      if (validCodes.length === 0) {
        skipped.push(`technique="${u.value}"${allowed ? ` (must be one of: ${summarizeAllowed(allowed)})` : ''}`);
        continue;
      }
      next.technique = validCodes;
      applied.push({ field, value: validCodes });
      if (invalid.length > 0) skipped.push(`technique values not recognized: ${invalid.join(', ')}`);
    } else if (FREE_TEXT_PROCEDURE_FIELDS.has(field)) {
      // Free text — pass through.
      (next as Record<string, unknown>)[field] = u.value;
      applied.push({ field, value: u.value });
    } else {
      // Single-value enum fields — validate against the value set if one is loaded.
      const allowed = allowedByField.get(field);
      if (allowed && allowed.size > 0) {
        const code = coerceToAllowedCode(u.value, allowed);
        if (!code) {
          skipped.push(`${u.field}="${u.value}" (must be one of: ${summarizeAllowed(allowed)})`);
          continue;
        }
        (next as Record<string, unknown>)[field] = code;
        applied.push({ field, value: code });
      } else {
        // No value set loaded yet (or none exists for this field) — pass through.
        (next as Record<string, unknown>)[field] = u.value;
        applied.push({ field, value: u.value });
      }
    }
  }
  return { updated: next, applied, skipped };
}

// Normalize a string for loose comparison: lowercase, strip whitespace and unit punctuation that
// commonly varies between sources (e.g. "400 mg/5 mL" vs "400mg/5ml").
function normForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
}

// Rank eRx medication results when the planner extracted a strength and/or doseForm from the
// narrative. eRx's name search returns results in its own order which interleaves combination
// products and unrelated strengths; this stable sort pushes the requested strength/form to the
// top without dropping anything. Returns a new array; original order is the tie-breaker.
function rankMedicationResults(
  results: SearchResult[],
  intent: Extract<EasyChartAgentIntent, { kind: 'add-medication' }>
): SearchResult[] {
  const wantStrength = intent.strength ? normForMatch(intent.strength) : '';
  const wantForm = intent.doseForm ? intent.doseForm.toLowerCase().trim() : '';
  // Single-ingredient request: provider typed "amoxicillin" (no hyphen, no &, no "/"). eRx
  // returns combination products (Amoxicillin-Pot Clavulanate, Amox & Vonoprazan) that
  // SHOULDN'T outrank the plain ingredient — penalize those when the request looks single-ing.
  const queryName = intent.searchTerms[0] ?? intent.display;
  const isSingleIngredientQuery = !/[-&/]/.test(queryName);
  if (!wantStrength && !wantForm && !isSingleIngredientQuery) return results;
  const scored = results.map((r, idx) => {
    const nameNorm = normForMatch(r.name);
    const strengthNorm = r.strength ? normForMatch(r.strength) : '';
    const haystack = `${nameNorm} ${strengthNorm}`;
    let score = 0;
    if (wantStrength) {
      if (strengthNorm && strengthNorm === wantStrength) score += 10;
      else if (haystack.includes(wantStrength)) score += 6;
    }
    if (wantForm) {
      // doseForm is typically a single word — compare case-insensitively as a whole token.
      if (r.name.toLowerCase().includes(wantForm)) score += 3;
      if (r.strength && r.strength.toLowerCase().includes(wantForm)) score += 3;
    }
    if (isSingleIngredientQuery && /[-&]/.test(r.name)) score -= 5;
    return { r, score, idx };
  });
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.map((s) => s.r);
}

async function runIntentSearch(
  intent: AddSearchIntent,
  oystehr: Oystehr | undefined,
  oystehrZambda: Oystehr | undefined
): Promise<SearchResult[]> {
  // For ICD-10 add intents: if the narrative supplied an explicit code, look it up first by code.
  // The searchIcd10Codes scorer treats exact-code matches as the top result. If that yields an
  // exact code match, return JUST that result — downstream dispatch then auto-picks (results=1)
  // instead of showing a picker the provider has to click through.
  const intentCode =
    (intent.kind === 'add-diagnosis' || intent.kind === 'add-condition') && 'code' in intent
      ? (intent as { code?: string }).code
      : undefined;
  if (intentCode && oystehrZambda) {
    const codeResp = await icd10Search(oystehrZambda, { search: intentCode });
    const exact = (codeResp.codes || []).find((c) => c.code.toLowerCase() === intentCode.toLowerCase());
    if (exact) {
      return [{ name: exact.display, code: exact.code }];
    }
    // Code not found exactly — fall through to display-based search.
  }
  const terms = intent.searchTerms.length > 0 ? intent.searchTerms : [intent.display];
  const all: SearchResult[] = [];
  const seen = new Set<string>();
  const perTerm = Math.max(5, Math.floor(15 / terms.length));

  for (const term of terms) {
    let results: SearchResult[] = [];
    if ((intent.kind === 'add-condition' || intent.kind === 'add-diagnosis') && oystehrZambda) {
      const response = await icd10Search(oystehrZambda, { search: term });
      results = (response.codes || []).map((c) => ({ name: c.display, code: c.code }));
    } else if (intent.kind === 'add-medication' && oystehr) {
      results = (await oystehr.erx.searchMedications({ name: term })) as SearchResult[];
    } else if (intent.kind === 'add-allergy' && oystehr) {
      results = (await oystehr.erx.searchAllergens({ name: term })) as SearchResult[];
    } else if (intent.kind === 'add-surgical-history') {
      results = filterStaticOptions(SURGICAL_HISTORY_OPTIONS, term);
    } else if (intent.kind === 'add-hospitalization') {
      results = filterStaticOptions(HospitalizationOptions, term);
    }
    let added = 0;
    for (const r of results) {
      if (added >= perTerm) break;
      const key = (r.code ?? r.name).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        all.push(r);
        added++;
      }
    }
  }
  if (intent.kind === 'add-medication') return rankMedicationResults(all, intent);
  return all;
}

// The human-readable label for a charted item, per its field (used for the correction popover's
// seed query and the needs-review provenance).
function chartedItemDisplay(field: AiField, item: { name?: string; display?: string; code?: string }): string {
  if (field === 'allergies' || field === 'medications') return item.name ?? '';
  return item.display ?? item.code ?? '';
}

function buildIntentPayload(
  encounterId: string,
  intent: AddSearchIntent,
  result: SearchResult,
  // Medications: the AI never confirms the dose, so default to "patient couldn't confirm dosage"
  // (matches the regular-note AI suggestion default). The correction popover can override it.
  dosageUnconfirmed = true
): SaveChartDataRequest | null {
  if (intent.kind === 'add-diagnosis' && result.code) {
    return { encounterId, diagnosis: [{ code: result.code, display: result.name, isPrimary: intent.isPrimary }] };
  }
  if (intent.kind === 'add-condition' && result.code) {
    return {
      encounterId,
      conditions: [{ code: result.code, display: result.name, current: true } satisfies MedicalConditionDTO],
    };
  }
  if (intent.kind === 'add-allergy') {
    return {
      encounterId,
      allergies: [
        {
          name: result.name,
          id: result.id != null ? String(result.id) : undefined,
          current: true,
        } satisfies AllergyDTO,
      ],
    };
  }
  if (intent.kind === 'add-medication') {
    const strength = result.strength;
    const nameHasStrength = strength && result.name.toLowerCase().includes(strength.toLowerCase());
    const name = nameHasStrength || !strength ? result.name : `${result.name} (${strength})`;
    return {
      encounterId,
      medications: [
        {
          name,
          id: result.id != null ? String(result.id) : undefined,
          type: 'scheduled',
          status: 'active',
          intakeInfo: { patientCouldNotConfirmDosage: dosageUnconfirmed || undefined },
        } satisfies MedicationDTO,
      ],
    };
  }
  if (intent.kind === 'add-surgical-history' && result.code) {
    return { encounterId, surgicalHistory: [{ code: result.code, display: result.name } satisfies CPTCodeDTO] };
  }
  if (intent.kind === 'add-hospitalization' && result.code) {
    return { encounterId, episodeOfCare: [{ code: result.code, display: result.name } satisfies HospitalizationDTO] };
  }
  return null;
}

export default function EasyChartPage(): JSX.Element {
  const { encounterId } = useParams<{ encounterId: string }>();
  const { oystehr, oystehrZambda } = useApiClients();
  const apiClient = useOystehrAPIClient();
  // E&M code list — the alternatives offered when correcting an auto-charted E&M code.
  const { emCodes } = useEMCodes();

  const [chartData, setChartData] = useState<GetChartDataResponse | null>(null);
  // Mirror of chartData for synchronous reads inside async callbacks (e.g. mergeSaveResponse
  // needs to compute the next state outside of setState's updater so it can compute newIds
  // synchronously — setState updater calls are deferred and would run after our flash check).
  const chartDataRef = useRef<GetChartDataResponse | null>(null);
  useEffect(() => {
    chartDataRef.current = chartData;
  }, [chartData]);
  // Per-field promise chain so rapid inline edits (and a concurrent planner edit) to the same
  // note field serialize instead of racing each other through saveChartData/mergeSaveResponse.
  const noteSaveChainRef = useRef<Record<string, Promise<void>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [refineText, setRefineText] = useState('');
  const refineInputRef = useRef<HTMLTextAreaElement | null>(null);
  // Narrative-plan execution state. `currentIdx` points at the step currently being run
  // (or paused awaiting a picker click). `results` records per-step outcomes for the summary.
  const [plan, setPlan] = useState<{
    narrative: string;
    steps: EasyChartAgentIntent[];
    currentIdx: number;
    results: { status: 'done' | 'skipped' | 'error'; label: string; message?: string }[];
  } | null>(null);
  // Track the last currentIdx we kicked off so we don't double-dispatch on conv changes that
  // re-render the component, and the conv kinds we treat as "step finished" vs "waiting".
  const planDispatchedIdxRef = useRef<number>(-1);
  const planAdvancedIdxRef = useRef<number>(-1);
  // Reference to the conv object whose terminal state we already consumed for an advance.
  // The advance effect's dep on `plan.currentIdx` would otherwise re-fire it after each advance
  // (currentIdx changed → effect fires → conv is STALE from the previous step but still terminal
  // → bug-advance to the next step). Storing the actual conv reference and requiring it to
  // differ guarantees we only advance once per real conv transition.
  const planLastAdvanceConvRef = useRef<ConvStep | null>(null);
  // Live ref to the current plan so async handlers (e.g. handleApplyTemplate's post-template
  // refresh) can read the latest state without a stale closure.
  const planRef = useRef<typeof plan>(null);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);
  const [freshlyAdded, setFreshlyAdded] = useState<Set<string>>(new Set());
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set());
  // Items the assistant auto-charted this session that still need the provider's review (keyed by
  // resourceId). Client-only — cleared when the provider corrects/removes/discusses an item, never
  // persisted. `aiSearchResultsRef` holds the last popover search so a chosen alternative key can be
  // resolved back to a SearchResult; `replaceTargetRef` lets a "Discuss" picker REPLACE the item.
  const [aiCharted, setAiCharted] = useState<Map<string, AiChartedMeta>>(new Map());
  const aiSearchResultsRef = useRef<Map<string, SearchResult>>(new Map());
  const replaceTargetRef = useRef<{ field: AiField; dto: { resourceId?: string } } | null>(null);
  // Search-based add intents that auto-chart with the needs-review highlight + click-to-correct,
  // and the field each maps to. (CPT/E&M, exam findings and procedures use different mechanisms.)
  const KIND_TO_FIELD: Record<string, ChartedField> = {
    'add-allergy': 'allergies',
    'add-condition': 'conditions',
    'add-medication': 'medications',
    'add-surgical-history': 'surgicalHistory',
    'add-hospitalization': 'episodeOfCare',
    'add-diagnosis': 'diagnosis',
  };
  const FIELD_TO_KIND: Record<ChartedField, AddSearchIntent['kind']> = {
    allergies: 'add-allergy',
    conditions: 'add-condition',
    medications: 'add-medication',
    surgicalHistory: 'add-surgical-history',
    episodeOfCare: 'add-hospitalization',
    diagnosis: 'add-diagnosis',
  };
  const AUTO_CHART_KINDS = new Set(Object.keys(KIND_TO_FIELD));
  const [conv, setConv] = useState<ConvStep | null>(null);

  // For removes: scroll to the item, flash it red for 1.5s so the user sees what's being
  // deleted, then actually remove it from local state. Callers pass a `commitRemove` callback
  // that does the state mutation (typically a setChartData call) — it runs after the flash.
  const flashAndRemoveItem = (resourceId: string, commitRemove: () => void): void => {
    const el = document.querySelector<HTMLElement>(`[data-easy-chart-id="${resourceId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setRemovingItems((prev) => {
      const next = new Set(prev);
      next.add(resourceId);
      return next;
    });
    setTimeout(() => {
      commitRemove();
      setRemovingItems((prev) => {
        const next = new Set(prev);
        next.delete(resourceId);
        return next;
      });
    }, 1500);
  };

  // Merge the saved-chart-data response into local state and flash the new items.
  // Avoids a full refetch for single-item adds.
  const mergeSaveResponse = (response: { chartData: GetChartDataResponse }): string[] => {
    const saved = response.chartData;
    const prev = chartDataRef.current;
    if (!prev) return [];
    const next: GetChartDataResponse = { ...prev };
    const newIds: string[] = [];
    const arrayFields = [
      'diagnosis',
      'conditions',
      'allergies',
      'medications',
      'surgicalHistory',
      'episodeOfCare',
      'examObservations',
      'rosObservations',
      'vitalsObservations',
      'instructions',
      'cptCodes',
      'procedures',
    ] as const;
    for (const field of arrayFields) {
      const incoming = saved[field] as Array<{ resourceId?: string }> | undefined;
      if (!incoming || incoming.length === 0) continue;
      const existing = (next[field] as Array<{ resourceId?: string }> | undefined) ?? [];
      const existingIds = new Set(existing.map((e) => e.resourceId).filter((id): id is string => !!id));
      // Replace existing items with same resourceId (updates), append new ones (adds).
      const incomingById = new Map<string, { resourceId?: string }>();
      const newItems: Array<{ resourceId?: string }> = [];
      for (const item of incoming) {
        if (item.resourceId && existingIds.has(item.resourceId)) {
          incomingById.set(item.resourceId, item);
        } else {
          newItems.push(item);
          if (item.resourceId) newIds.push(item.resourceId);
        }
      }
      const merged = existing.map((e) =>
        e.resourceId && incomingById.has(e.resourceId) ? incomingById.get(e.resourceId)! : e
      );
      (next[field] as unknown[]) = [...merged, ...newItems];
    }
    const trackScalar = (incoming: { resourceId?: string } | undefined): void => {
      if (incoming?.resourceId) newIds.push(incoming.resourceId);
    };
    if (saved.chiefComplaint) {
      next.chiefComplaint = saved.chiefComplaint;
      trackScalar(saved.chiefComplaint);
    }
    if (saved.historyOfPresentIllness) {
      next.historyOfPresentIllness = saved.historyOfPresentIllness;
      trackScalar(saved.historyOfPresentIllness);
    }
    if (saved.mechanismOfInjury) {
      next.mechanismOfInjury = saved.mechanismOfInjury;
      trackScalar(saved.mechanismOfInjury);
    }
    if (saved.ros) {
      next.ros = saved.ros;
      trackScalar(saved.ros);
    }
    if (saved.medicalDecision) {
      next.medicalDecision = saved.medicalDecision;
      trackScalar(saved.medicalDecision);
    }
    if (saved.emCode) {
      next.emCode = saved.emCode;
      trackScalar(saved.emCode);
    }
    setChartData(next);
    if (newIds.length > 0) {
      setFreshlyAdded((prev) => {
        const next = new Set(prev);
        newIds.forEach((id) => next.add(id));
        return next;
      });
      // After React renders, scroll the first new item into view. We retry a few times in
      // case the section was mounted for the first time and React hasn't painted yet.
      const tryScroll = (attempt: number): void => {
        const el = document.querySelector<HTMLElement>(`[data-easy-chart-id="${newIds[0]}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (attempt < 10) {
          setTimeout(() => tryScroll(attempt + 1), 50);
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(() => tryScroll(0)));
      setTimeout(() => {
        setFreshlyAdded((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 2500);
    }
    return newIds;
  };

  const saveAndMerge = async (payload: SaveChartDataRequest): Promise<string[]> => {
    if (!apiClient) return [];
    const response = await apiClient.saveChartData(payload);
    return mergeSaveResponse(response);
  };

  // Delete a charted allergy/diagnosis by its dto (flash + local removal), and drop it from the
  // needs-review set. Shared by Remove and the replace flow.
  const deleteChartedResource = async (field: AiField, dto: { resourceId?: string }): Promise<void> => {
    if (!apiClient || !encounterId || !dto.resourceId) return;
    const resourceId = dto.resourceId;
    const dropFromAiCharted = (): void =>
      setAiCharted((prev) => {
        if (!prev.has(resourceId)) return prev;
        const n = new Map(prev);
        n.delete(resourceId);
        return n;
      });
    // E&M is a scalar field (not an array) — delete + null it out, not array-filter.
    if (field === 'emCode') {
      await apiClient.deleteChartData({ encounterId, emCode: dto } as Parameters<typeof apiClient.deleteChartData>[0]);
      flashAndRemoveItem(resourceId, () => setChartData((prev) => (prev ? { ...prev, emCode: undefined } : prev)));
      dropFromAiCharted();
      return;
    }
    await apiClient.deleteChartData({ encounterId, [field]: [dto] } as Parameters<typeof apiClient.deleteChartData>[0]);
    flashAndRemoveItem(resourceId, () => {
      setChartData((prev) => {
        if (!prev) return prev;
        const next: GetChartDataResponse = { ...prev };
        const list = (next[field] as Array<{ resourceId?: string }> | undefined) ?? [];
        (next[field] as unknown[]) = list.filter((x) => x.resourceId !== resourceId);
        return next;
      });
    });
    dropFromAiCharted();
  };

  // Build a minimal synthetic add-intent so we can reuse runIntentSearch / buildIntentPayload for
  // the inline correction flows (the popover and the Discuss picker).
  const synthAddIntent = (
    field: ChartedField,
    display: string,
    searchTerms: string[],
    isPrimary?: boolean
  ): AddSearchIntent =>
    ({
      kind: FIELD_TO_KIND[field],
      display,
      searchTerms,
      ...(field === 'diagnosis' ? { isPrimary: !!isPrimary } : {}),
    }) as unknown as AddSearchIntent;

  // Popover "search alternatives": reuse the same search the pickers use, and cache the results so
  // a chosen key can be resolved back to its SearchResult on replace.
  const aiSearch = async (field: AiField, query: string): Promise<AiAlternative[]> => {
    // CODE-based fields: CPT/HCPCS via the terminology service, E&M from the configured code list.
    if (field === 'cptCodes' || field === 'emCode') {
      let codes: Array<{ code: string; display: string }> = [];
      if (field === 'emCode') {
        const q = query.trim().toLowerCase();
        codes = q
          ? emCodes.filter((c) => c.code.toLowerCase().includes(q) || c.display.toLowerCase().includes(q))
          : emCodes;
        if (codes.length === 0) codes = emCodes;
      } else {
        // CPT + HCPCS terminology search — same source as the regular-note CPT picker (type 'both').
        const [cpt, hcpcs] = await Promise.all([
          oystehr?.terminology.searchCpt({ query, searchType: 'all', limit: 40 }).catch(() => undefined),
          oystehr?.terminology.searchHcpcs({ query, searchType: 'all', limit: 40 }).catch(() => undefined),
        ]);
        codes = [...(cpt?.codes ?? []), ...(hcpcs?.codes ?? [])];
      }
      const map = new Map<string, SearchResult>();
      const alts: AiAlternative[] = codes.slice(0, 40).map((c, i) => {
        const key = `${c.code}-${i}`;
        map.set(key, { name: c.display, code: c.code });
        return { key, label: `${c.code} — ${c.display}` };
      });
      aiSearchResultsRef.current = map;
      return alts;
    }
    const intent = synthAddIntent(field, query, [query]);
    const results = await runIntentSearch(intent, oystehr, oystehrZambda);
    const map = new Map<string, SearchResult>();
    const alts: AiAlternative[] = results.map((r, i) => {
      const key = `${r.code ?? r.id ?? r.name}-${i}`;
      map.set(key, r);
      return {
        key,
        label: r.code ? `${r.code} — ${r.name}` : r.name,
        // Medications show strength as a secondary line (mirrors the regular-note suggestion).
        secondary: field === 'medications' ? r.strength : undefined,
      };
    });
    aiSearchResultsRef.current = map;
    return alts;
  };

  // Replace an AI-charted item with a chosen alternative: delete the old, add the new (NOT flagged
  // for review — the provider chose it). Preserves primary flag for diagnoses; carries the
  // dosage-unconfirmed flag for medications.
  const aiReplace = (field: AiField, dto: { resourceId?: string }, key: string, dosageUnconfirmed?: boolean): void => {
    const result = aiSearchResultsRef.current.get(key);
    if (!result || !encounterId || !result.code) return;
    // CODE-based fields: E&M is a scalar (overwrite); CPT is an array (delete old, add new).
    if (field === 'emCode' || field === 'cptCodes') {
      const code = result.code;
      const display = result.name;
      void (async () => {
        try {
          if (dto.resourceId) {
            setAiCharted((prev) => {
              if (!prev.has(dto.resourceId!)) return prev;
              const n = new Map(prev);
              n.delete(dto.resourceId!);
              return n;
            });
          }
          if (field === 'emCode') {
            await saveAndMerge({ encounterId, emCode: { code, display } });
          } else {
            await deleteChartedResource('cptCodes', dto);
            await saveAndMerge({ encounterId, cptCodes: [{ code, display }] });
          }
        } catch (e) {
          console.error('AI replace failed:', e);
        }
      })();
      return;
    }
    const isPrimary = field === 'diagnosis' ? !!(dto as { isPrimary?: boolean }).isPrimary : undefined;
    const intent = synthAddIntent(field, result.name, [], isPrimary);
    const payload = buildIntentPayload(encounterId, intent, result, dosageUnconfirmed ?? true);
    void (async () => {
      try {
        await deleteChartedResource(field, dto);
        if (payload) await saveAndMerge(payload);
      } catch (e) {
        console.error('AI replace failed:', e);
      }
    })();
  };

  // Toggle "patient doesn't know dosage" on an already-charted medication, in place (no replace).
  const aiSetMedDosage = (dto: { resourceId?: string }, value: boolean): void => {
    if (!encounterId || !dto.resourceId) return;
    const med = dto as MedicationDTO;
    const payload: SaveChartDataRequest = {
      encounterId,
      medications: [{ ...med, intakeInfo: { ...med.intakeInfo, patientCouldNotConfirmDosage: value || undefined } }],
    };
    void saveAndMerge(payload).catch((e) => console.error('AI dosage toggle failed:', e));
  };

  const aiRemove = (field: AiField, dto: { resourceId?: string }): void => {
    void deleteChartedResource(field, dto).catch((e) => console.error('AI remove failed:', e));
  };

  // "Discuss": hand the item to the right-hand panel as a full picker (all alternatives + Skip /
  // Refine). Picking there REPLACES the item (replaceTargetRef is consumed in handlePick). The row
  // leaves the needs-review set because it's now under active review in the panel.
  const aiDiscuss = (field: AiField, dto: { resourceId?: string }, meta: AiChartedMeta): void => {
    // CODE-based fields have no right-panel picker; Discuss is hidden for them.
    if (field === 'cptCodes' || field === 'emCode') return;
    void (async () => {
      try {
        const isPrimary = field === 'diagnosis' ? !!(dto as { isPrimary?: boolean }).isPrimary : undefined;
        const intent = synthAddIntent(field, meta.display, meta.searchTerms, isPrimary);
        replaceTargetRef.current = { field, dto };
        const results = await runIntentSearch(intent, oystehr, oystehrZambda);
        if (dto.resourceId) {
          setAiCharted((prev) => {
            if (!prev.has(dto.resourceId!)) return prev;
            const n = new Map(prev);
            n.delete(dto.resourceId!);
            return n;
          });
        }
        setConv({ kind: 'choose', user: `Review: ${meta.display}`, intent, results });
      } catch (e) {
        console.error('AI discuss failed:', e);
      }
    })();
  };

  useEasyChartQuickPicks(encounterId, async (p) => {
    await saveAndMerge(p);
  });
  const { quickPicks: procedureQuickPicks } = useMergedProcedureQuickPicks({ enabled: !!encounterId });

  // Register procedure quick-picks into the command palette ("Add Procedure"), mirroring the
  // other easy-chart palette categories in useEasyChartQuickPicks. Procedures can't use that
  // hook's one-shot saveAndMerge because they need the two-step save (CPT/dx resources first,
  // then the ServiceRequest); we route through saveProcedureFromQuickPick instead, held in a
  // ref so the registered items stay referentially stable across renders while the save logic
  // always sees the latest apiClient / chart state.
  const saveProcedureFromQuickPickRef = useRef<(qp: ProcedureQuickPickData) => Promise<void>>(async () => {});
  const procedurePaletteItems = useMemo<CommandPaletteItem[]>(() => {
    if (!encounterId) return [];
    return procedureQuickPicks.map((qp) => ({
      id: `easy-chart-procedure-${qp.id ?? qp.name}`,
      label: qp.name,
      category: 'Add Procedure',
      keywords: [qp.procedureType, qp.name].filter(Boolean) as string[],
      onSelect: () => {
        void (async () => {
          try {
            await saveProcedureFromQuickPickRef.current(qp);
            enqueueSnackbar(`Added ${qp.name}`, { variant: 'success' });
          } catch (e) {
            console.error('Easy-chart procedure quick-pick save failed:', e);
            enqueueSnackbar(`Failed to add ${qp.name}`, { variant: 'error' });
          }
        })();
      },
    }));
  }, [procedureQuickPicks, encounterId]);
  useCommandPaletteSource('easy-chart-procedures', procedurePaletteItems);

  // Code → name lookup for procedureType. The regular ProceduresNew page saves the display
  // NAME (e.g. "Laceration Repair") instead of the code (e.g. "laceration-repair") so the
  // saved value matches what providers see in the Procedure Type dropdown. Mirror that here.
  const [procedureTypeNameByCode, setProcedureTypeNameByCode] = useState<Map<string, string>>(new Map());
  // Allowed-values registry per procedure field, keyed by ProcedureDTO field name.
  // Populated from the same FHIR ValueSets the regular ProceduresNew dropdowns use, so
  // when an admin edits those ValueSets the easy-chart accepts the new options without
  // any code change.
  const [procedureFieldAllowedValues, setProcedureFieldAllowedValues] = useState<
    Map<keyof ProcedureDTO, Map<string, string>>
  >(new Map());
  useEffect(() => {
    let cancelled = false;
    if (!oystehr) return;
    const fieldByUrl: { url: string; field: keyof ProcedureDTO }[] = [
      { url: PROCEDURE_TYPES_VALUE_SET_URL, field: 'procedureType' },
      { url: BODY_SIDES_VALUE_SET_URL, field: 'bodySide' },
      { url: BODY_SITES_VALUE_SET_URL, field: 'bodySite' },
      { url: COMPLICATIONS_VALUE_SET_URL, field: 'complications' },
      { url: MEDICATIONS_USED_VALUE_SET_URL, field: 'medicationUsed' },
      { url: PATIENT_RESPONSES_VALUE_SET_URL, field: 'patientResponse' },
      { url: POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL, field: 'postInstructions' },
      { url: SUPPLIES_VALUE_SET_URL, field: 'suppliesUsed' },
      { url: TECHNIQUES_VALUE_SET_URL, field: 'technique' },
      { url: TIME_SPENT_VALUE_SET_URL, field: 'timeSpent' },
    ];
    void (async () => {
      try {
        const bundle = await oystehr.fhir.search({
          resourceType: 'ValueSet',
          params: [{ name: 'url', value: fieldByUrl.map((f) => f.url).join(',') }],
        });
        const valueSets = bundle.unbundle() as {
          url?: string;
          version?: string;
          resourceType?: string;
          expansion?: { contains?: { code?: string; display?: string }[] };
        }[];
        const byUrl = new Map<string, { code: string; display: string }[]>();
        for (const vs of valueSets) {
          if (vs.resourceType !== 'ValueSet' || !vs.url) continue;
          const items = (vs.expansion?.contains ?? [])
            .filter((i): i is { code: string; display: string } => !!i.code && !!i.display)
            .map((i) => ({ code: i.code, display: i.display }));
          // ValueSets are versioned — take the latest by version.
          const existing = byUrl.get(vs.url);
          if (!existing || items.length > existing.length) byUrl.set(vs.url, items);
        }
        const procedureTypeItems = byUrl.get(PROCEDURE_TYPES_VALUE_SET_URL) ?? [];
        const ptMap = new Map<string, string>();
        for (const i of procedureTypeItems) ptMap.set(i.code, i.display);
        const allowed = new Map<keyof ProcedureDTO, Map<string, string>>();
        for (const { url, field } of fieldByUrl) {
          const items = byUrl.get(url) ?? [];
          const m = new Map<string, string>();
          for (const i of items) m.set(i.code, i.display);
          if (m.size > 0) allowed.set(field, m);
        }
        if (!cancelled) {
          setProcedureTypeNameByCode(ptMap);
          setProcedureFieldAllowedValues(allowed);
        }
      } catch (e) {
        console.error('Failed to load procedure value sets:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [oystehr]);

  // Look up the encounter's appointmentId so the "Open in regular chart" button can link out.
  useEffect(() => {
    let cancelled = false;
    if (!oystehr || !encounterId) return;
    void (async () => {
      try {
        const encounter = await oystehr.fhir.get<Encounter>({
          resourceType: 'Encounter',
          id: encounterId,
        });
        const ref = encounter.appointment?.[0]?.reference;
        const id = ref?.startsWith('Appointment/') ? ref.slice('Appointment/'.length) : null;
        if (!cancelled && id) setAppointmentId(id);
      } catch (e) {
        console.error('Failed to fetch encounter for appointment lookup:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [oystehr, encounterId]);

  // Human label for a step shown in the conversation header during plan execution.
  const describePlanStep = (intent: EasyChartAgentIntent): string => {
    switch (intent.kind) {
      case 'add-allergy':
      case 'add-condition':
      case 'add-medication':
      case 'add-surgical-history':
      case 'add-hospitalization':
        return `${intent.kind.replace(/-/g, ' ')}: ${intent.display}`;
      case 'add-diagnosis':
        return `add diagnosis${intent.isPrimary ? ' (primary)' : ''}: ${intent.display}`;
      case 'remove-allergy':
      case 'remove-condition':
      case 'remove-medication':
      case 'remove-surgical-history':
      case 'remove-hospitalization':
      case 'remove-diagnosis':
      case 'remove-exam-finding':
        return `${intent.kind.replace(/-/g, ' ')}: ${intent.display}`;
      case 'set-em-code':
        return `set E&M code ${intent.code}`;
      case 'add-cpt':
        return `add CPT ${intent.code}`;
      case 'remove-em-code':
        return 'remove E&M code';
      case 'remove-cpt':
        return `remove CPT ${intent.code}`;
      case 'apply-template':
        return `apply template: ${intent.display}`;
      case 'add-procedure':
        return `add procedure: ${intent.display}`;
      case 'update-procedure':
        return `update procedure${intent.procedureMatch ? ` (${intent.procedureMatch})` : ''}: ${intent.updates
          .map((u) => `${u.field}=${u.value}`)
          .join(', ')}`;
      case 'edit-note-text':
        return `edit ${intent.field}`;
      case 'add-exam-finding':
        return `add exam finding: ${intent.display}`;
      case 'add-ros-finding':
        return `add ROS: ${intent.display}`;
      case 'unknown':
        return 'unknown action';
    }
  };

  // Plan execution: dispatch the current step when the cursor moves to it.
  useEffect(() => {
    if (!plan) {
      planDispatchedIdxRef.current = -1;
      planAdvancedIdxRef.current = -1;
      planLastAdvanceConvRef.current = null;
      return;
    }
    if (planDispatchedIdxRef.current === plan.currentIdx) return; // already kicked off
    planDispatchedIdxRef.current = plan.currentIdx;
    const step = plan.steps[plan.currentIdx];
    const label = `Step ${plan.currentIdx + 1}/${plan.steps.length} — ${describePlanStep(step)}`;
    void dispatchIntent(step, label);
    // Intentionally no other deps — we only want to fire when the cursor moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.currentIdx, plan?.steps.length]);

  // Plan progression: when conv reaches a settled (terminal) state for the current step,
  // record the result and advance the cursor. Picker / in-progress conv kinds pause the plan.
  useEffect(() => {
    if (!plan) return;
    if (!conv) return;
    // Guard against the stale-conv double-advance: if this exact conv object already triggered
    // an advance, ignore it. Each real step transition produces a new conv object via setConv.
    if (planLastAdvanceConvRef.current === conv) return;
    const terminal: ConvStep['kind'][] = [
      'done',
      'removed',
      'applied-template',
      'updated-procedure',
      'edited-note-text',
      'unknown',
      'error',
      'skipped',
      'no-match',
      'no-match-remove',
      'no-match-template',
      'no-match-procedure',
      'no-procedure-to-update',
      'no-match-exam',
      'no-match-exam-remove',
    ];
    if (!terminal.includes(conv.kind)) return;
    planLastAdvanceConvRef.current = conv;
    planAdvancedIdxRef.current = plan.currentIdx;
    setPlan((prev) => {
      if (!prev) return null;
      const status: 'done' | 'skipped' | 'error' =
        conv.kind === 'error'
          ? 'error'
          : conv.kind === 'skipped' || conv.kind.startsWith('no-') || conv.kind === 'unknown'
          ? 'skipped'
          : 'done';
      const stepLabel = describePlanStep(prev.steps[prev.currentIdx]);
      const message = conv.kind === 'error' || conv.kind === 'unknown' ? (conv as { reply?: string }).reply : undefined;
      const nextResults = [...prev.results, { status, label: stepLabel, message }];
      const nextIdx = prev.currentIdx + 1;
      if (nextIdx >= prev.steps.length) {
        // Plan complete — leave a summary in the conversation, clear plan state.
        const doneCount = nextResults.filter((r) => r.status === 'done').length;
        const skipCount = nextResults.filter((r) => r.status === 'skipped').length;
        const errCount = nextResults.filter((r) => r.status === 'error').length;
        const summary =
          `Plan complete: ${doneCount} applied` +
          (skipCount > 0 ? `, ${skipCount} skipped` : '') +
          (errCount > 0 ? `, ${errCount} error${errCount === 1 ? '' : 's'}` : '') +
          '.';
        setConv({ kind: 'unknown', user: prev.narrative, reply: summary });
        return null;
      }
      return { ...prev, currentIdx: nextIdx, results: nextResults };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv?.kind, plan?.currentIdx]);

  // Build the noteContext we send to the LLM. The in-person CC↔HPI swap is applied here so
  // the LLM sees text under the labels the provider reads (chiefComplaint = CC label's text).
  const buildNoteContext = (): NonNullable<Parameters<typeof easyChartAgent>[1]['noteContext']> | undefined => {
    const ctx = chartDataRef.current;
    if (!ctx) return undefined;
    return {
      chiefComplaint: ctx.historyOfPresentIllness?.text ?? undefined,
      historyOfPresentIllness: ctx.chiefComplaint?.text ?? undefined,
      mechanismOfInjury: ctx.mechanismOfInjury?.text ?? undefined,
      ros: ctx.ros?.text ?? undefined,
      medicalDecision: ctx.medicalDecision?.text ?? undefined,
    };
  };

  // Take a classified intent and run the appropriate per-intent path. Used by both the
  // single-shot agent flow and the plan executor — they only differ in how `intent` is
  // produced. `message` is the user-facing label rendered in the conversation header.
  const dispatchIntent = async (intent: EasyChartAgentIntent, message: string): Promise<void> => {
    if (!oystehrZambda || !encounterId) return;
    if (intent.kind === 'unknown') {
      setConv({ kind: 'unknown', user: message, reply: intent.message });
      return;
    }
    try {
      if (isRemoveIntent(intent)) {
        const matches = findRemoveMatches(intent, chartData);
        if (matches.length === 0) {
          setConv({ kind: 'no-match-remove', user: message, intent });
        } else {
          // No stopping: auto-pick the top match instead of showing a remove picker.
          await handleRemovePick(matches[0], message);
        }
        return;
      }
      // Code-based: the LLM gave us the code directly — save without searching
      if (intent.kind === 'set-em-code' || intent.kind === 'add-cpt') {
        const label = `${intent.code}${intent.display && intent.display !== intent.code ? ` — ${intent.display}` : ''}`;
        setConv({ kind: 'saving', user: message, chosenName: label });
        try {
          const payload: SaveChartDataRequest =
            intent.kind === 'set-em-code'
              ? { encounterId, emCode: { code: intent.code, display: intent.display } }
              : { encounterId, cptCodes: [{ code: intent.code, display: intent.display }] };
          const newIds = await saveAndMerge(payload);
          // Flag the auto-charted billing code as needing review (clickable-to-correct).
          if (newIds.length > 0) {
            const field: AiField = intent.kind === 'set-em-code' ? 'emCode' : 'cptCodes';
            setAiCharted((prev) => {
              const next = new Map(prev);
              for (const id of newIds)
                next.set(id, {
                  field,
                  display: intent.display ?? intent.code,
                  searchTerms: [],
                  lowConfidence: false,
                });
              return next;
            });
          }
          setConv({ kind: 'done', user: message, chosenName: label });
        } catch (e) {
          console.error('Save failed:', e);
          setConv({ kind: 'error', user: message, reply: `Could not save "${label}". Please try again.` });
        }
        return;
      }
      // Code-based remove
      if (intent.kind === 'remove-em-code') {
        if (!apiClient) return;
        const current = chartData?.emCode;
        if (!current?.resourceId) {
          setConv({ kind: 'error', user: message, reply: 'There is no E&M code on this encounter to remove.' });
          return;
        }
        if (intent.code && current.code !== intent.code) {
          setConv({
            kind: 'error',
            user: message,
            reply: `The current E&M code is ${current.code}, not ${intent.code}. Did you mean to remove ${current.code}?`,
          });
          return;
        }
        const label = `${current.code}${current.display ? ` — ${current.display}` : ''}`;
        setConv({ kind: 'removing', user: message, chosenName: label });
        try {
          await apiClient.deleteChartData({ encounterId, emCode: current } as Parameters<
            typeof apiClient.deleteChartData
          >[0]);
          flashAndRemoveItem(current.resourceId, () => {
            setChartData((prev) => (prev ? { ...prev, emCode: undefined } : prev));
          });
          setConv({ kind: 'removed', user: message, chosenName: label });
        } catch (e) {
          console.error('Remove em-code failed:', e);
          setConv({ kind: 'error', user: message, reply: `Could not remove ${label}.` });
        }
        return;
      }
      if (intent.kind === 'remove-cpt') {
        if (!apiClient) return;
        const match = (chartData?.cptCodes ?? []).find((c) => c.resourceId && c.code === intent.code);
        if (!match || !match.resourceId) {
          setConv({ kind: 'error', user: message, reply: `I don't see CPT ${intent.code} on this encounter.` });
          return;
        }
        const label = `${match.code}${match.display ? ` — ${match.display}` : ''}`;
        setConv({ kind: 'removing', user: message, chosenName: label });
        try {
          await apiClient.deleteChartData({ encounterId, cptCodes: [match] } as Parameters<
            typeof apiClient.deleteChartData
          >[0]);
          flashAndRemoveItem(match.resourceId, () => {
            setChartData((prev) =>
              prev
                ? { ...prev, cptCodes: (prev.cptCodes ?? []).filter((c) => c.resourceId !== match.resourceId) }
                : prev
            );
          });
          setConv({ kind: 'removed', user: message, chosenName: label });
        } catch (e) {
          console.error('Remove cpt failed:', e);
          setConv({ kind: 'error', user: message, reply: `Could not remove ${label}.` });
        }
        return;
      }
      if (intent.kind === 'apply-template') {
        const all = await listTemplates(oystehrZambda, { includeVersionData: false });
        const matches = findTemplateMatches(intent, all.templates);
        if (matches.length === 0) {
          setConv({ kind: 'no-match-template', user: message, intent });
        } else {
          // No stopping: auto-apply the best-matching template.
          await handleApplyTemplate(matches[0], message);
        }
        return;
      }
      if (intent.kind === 'add-procedure') {
        const matches = findProcedureMatches(intent, procedureQuickPicks);
        if (matches.length === 0) {
          setConv({ kind: 'no-match-procedure', user: message, intent });
        } else {
          // No stopping: auto-pick the best-matching procedure quick-pick.
          await handleProcedurePick(matches[0], message);
        }
        return;
      }
      if (intent.kind === 'update-procedure') {
        const allProcedures = chartDataRef.current?.procedures ?? [];
        if (allProcedures.length === 0) {
          setConv({ kind: 'no-procedure-to-update', user: message, intent });
        } else {
          const candidates = findProceduresToUpdate(intent, allProcedures);
          if (candidates.length === 0) {
            setConv({ kind: 'no-procedure-to-update', user: message, intent });
          } else {
            // No stopping: auto-pick the top candidate procedure to update.
            await handleProcedureUpdate(candidates[0], intent, message);
          }
        }
        return;
      }
      if (intent.kind === 'edit-note-text') {
        await handleEditNoteText(intent, message);
        return;
      }
      if (intent.kind === 'add-exam-finding') {
        const allMatches = findExamLeafMatches(intent, EXAM_LEAVES);
        // Filter out leaves already on the chart — e.g. the AOM Right template already checked
        // "TM bulging, erythematous" on the right side, so re-adding it creates a duplicate.
        // For plain checkbox leaves: skip if any observation with field=leaf.field has value=true.
        // For modal-option leaves: skip if the parent observation already has this option's
        // component code checked.
        const existingObs = chartDataRef.current?.examObservations ?? [];
        const isAlreadyChecked = (leaf: ExamLeaf): boolean => {
          if (leaf.modalOption) {
            const parent = existingObs.find((o) => o.field === leaf.field && o.value === true);
            if (!parent) return false;
            return (parent.components ?? []).some((c) => c.code === leaf.modalOption!.optionCode && c.value === true);
          }
          return existingObs.some((o) => o.field === leaf.field && o.value === true);
        };
        const remaining = allMatches.filter((m) => !isAlreadyChecked(m));
        if (allMatches.length === 0) {
          setConv({ kind: 'no-match-exam', user: message, intent });
        } else if (remaining.length === 0) {
          // Every match is already on the chart — most commonly because a template added it.
          setConv({ kind: 'skipped', user: message });
        } else if (allMatches[0] && isAlreadyChecked(allMatches[0])) {
          // The TOP-scored match was already on the chart, even if lower-ranked variants
          // weren't. The provider's intent is essentially satisfied — making them pick from
          // weaker matches would be confusing (e.g. they asked for "Right TM erythematous and
          // bulging with loss of light reflex" and the catalog's best match for that, which
          // is on the chart, was removed by dedup; the picker would otherwise fall back to
          // unrelated Left ear options).
          setConv({ kind: 'skipped', user: message });
        } else {
          // No stopping: auto-pick the top exam-finding match.
          await handleExamPick(remaining[0], message);
        }
        return;
      }
      if (intent.kind === 'remove-exam-finding') {
        const items = buildExamRemoveItems(chartDataRef.current?.examObservations);
        const matches = findExamRemoveMatches(intent, items);
        if (matches.length === 0) {
          setConv({ kind: 'no-match-exam-remove', user: message, intent });
        } else {
          // No stopping: auto-pick the top exam-finding to remove.
          await handleExamRemove(matches[0], message);
        }
        return;
      }
      if (intent.kind === 'add-ros-finding') {
        // State comes from the leading "Denies"/"Reports" word in display (reliably emitted),
        // falling back to the optional `finding` enum. Strip the verb before matching the symptom.
        const verb = /^(denies|reports)\b[:\s-]*/i.exec(intent.display);
        const finding: 'reports' | 'denies' = verb
          ? verb[1].toLowerCase() === 'denies'
            ? 'denies'
            : 'reports'
          : intent.finding === 'denies'
          ? 'denies'
          : 'reports';
        const symptom = intent.display.replace(/^(denies|reports)\b[:\s-]*/i, '').trim();
        const matchIntent: AddRosFindingIntent = { ...intent, display: symptom || intent.display };
        const matches = findRosLeafMatches(matchIntent, ROS_LEAVES);
        // Skip if this exact finding (same item + same denies/reports state) is already charted.
        const obs = chartDataRef.current?.rosObservations ?? [];
        const isCharted = (leaf: RosLeaf): boolean => {
          const fk = rosField(leaf.baseKey, finding === 'denies' ? RosFindingState.Denies : RosFindingState.Reports);
          return obs.some((o) => o.field === fk && o.value === true);
        };
        const remaining = matches.filter((m) => !isCharted(m));
        if (matches.length === 0 || remaining.length === 0) {
          setConv({ kind: 'skipped', user: message });
        } else {
          // No stopping: auto-pick the top ROS item match.
          await handleRosPick(remaining[0], finding, message);
        }
        return;
      }
      // Add flow — no stopping: always auto-pick the top match.
      const results = await runIntentSearch(intent, oystehr, oystehrZambda);
      if (results.length === 0) {
        setConv({ kind: 'no-match', user: message, intent });
      } else if (AUTO_CHART_KINDS.has(intent.kind)) {
        // Search-based add types get the needs-review highlight + click-to-correct, with
        // low-confidence flagged when the search was ambiguous (>1 plausible match).
        const provenance: AiChartedMeta = {
          field: KIND_TO_FIELD[intent.kind],
          display: 'display' in intent && intent.display ? intent.display : results[0].name,
          searchTerms: 'searchTerms' in intent && Array.isArray(intent.searchTerms) ? intent.searchTerms : [],
          lowConfidence: results.length > 1,
        };
        await handlePick(intent, results[0], message, provenance);
      } else {
        // Anything else (no field mapping) auto-picks the top match without the correct affordance.
        await handlePick(intent, results[0], message);
      }
    } catch (e) {
      console.error('Dispatch failed:', e);
      setConv({ kind: 'error', user: message, reply: 'Something went wrong. Please try again.' });
    }
  };

  // Heuristic: if the provider's message is long-ish or visibly contains multiple sentences,
  // route through the planner (narrative → ordered intents). Otherwise treat it as a single
  // request and use the single-shot agent.
  const looksLikeNarrative = (msg: string): boolean => {
    if (msg.length >= 140) return true;
    // Count sentence-end punctuation followed by whitespace/EOL — a couple of sentences in a
    // shorter message is a narrative; a single declarative isn't.
    const sentenceEnds = msg.match(/[.!?](?:\s|$)/g);
    return (sentenceEnds?.length ?? 0) >= 2;
  };

  // Per-picker refinement input. Keyed by the picker's user message so each picker session
  // gets its own field; cleared on picker close.
  const [pickerRefineText, setPickerRefineText] = useState('');

  // Multi-select state for the exam-finding picker: the provider can check several matching
  // leaves (e.g. "warm" AND "swollen") and add them all at once. Holds leafKey()s. Reset
  // whenever a new choose-exam picker opens (see dispatchIntent's add-exam-finding branch).
  const [examPickSelected, setExamPickSelected] = useState<Set<string>>(new Set());

  // Skip the active picker — sets conv to terminal 'skipped'. In plan mode this advances the
  // cursor with status="skipped" so the running step list shows ⏭ for this step.
  const handleSkipPicker = (): void => {
    if (!conv) return;
    setConv({ kind: 'skipped', user: conv.user });
    setPickerRefineText('');
  };

  // Refine the active picker — append the provider's free-text refinement to the intent's
  // display + searchTerms and re-dispatch. Works for any picker whose intent kind we can
  // re-dispatch through dispatchIntent (all add-*, remove-*, exam-*, template, procedure).
  const handleRefinePicker = (
    intent:
      | EasyChartAgentIntent
      | RemoveIntent
      | ApplyTemplateIntent
      | AddProcedureIntent
      | UpdateProcedureIntent
      | AddExamFindingIntent
      | RemoveExamFindingIntent,
    refinement: string
  ): void => {
    const text = refinement.trim();
    if (!text || !conv) return;
    const userMsg = conv.user;
    // Most intent kinds carry display + searchTerms. update-procedure / set-em-code / etc.
    // don't have a display the matcher uses, so refine isn't meaningful for them — skip the
    // re-dispatch and just clear the input.
    if (!('display' in intent)) return;
    // Re-search: each refine REPLACES the query with exactly what the provider typed, rather
    // than appending to the running query. Appending made refines cumulative and irreversible
    // — e.g. the procedure matcher ORs query tokens, so once "lac repair" was added "go back to
    // just splint" couldn't drop it and the list only ever grew. Replacing means the picker
    // always reflects the current text, so you can narrow, switch, or revert freely.
    const augmented = {
      ...intent,
      display: text,
      searchTerms: [text],
    } as EasyChartAgentIntent;
    setPickerRefineText('');
    void dispatchIntent(augmented, userMsg);
  };

  const handleSend = async (): Promise<void> => {
    const message = refineText.trim();
    if (!message || !oystehrZambda || !encounterId) return;
    setConv({ kind: 'thinking', user: message });
    setRefineText('');
    try {
      const noteContext = buildNoteContext();
      if (looksLikeNarrative(message)) {
        const { steps } = await easyChartPlanner(oystehrZambda, { narrative: message, noteContext });
        if (steps.length === 0) {
          setConv({
            kind: 'unknown',
            user: message,
            reply: "I couldn't find any chart actions in that narrative.",
          });
          return;
        }
        // Surface a preview so the provider sees the full decomposed plan and explicitly
        // approves before any chart writes. Avoids the "wait, what did the first 10 steps
        // do?" confusion when a later step pauses on a picker.
        setConv({ kind: 'plan-preview', user: message, narrative: message, steps });
        return;
      }
      const { intent } = await easyChartAgent(oystehrZambda, { message, noteContext });
      await dispatchIntent(intent, message);
    } catch (e) {
      console.error('Send failed:', e);
      setConv({ kind: 'error', user: message, reply: 'Something went wrong. Please try again.' });
    }
  };

  const handleRemovePick = async (match: RemoveMatch, user: string): Promise<void> => {
    if (!apiClient || !encounterId) return;
    setConv({ kind: 'removing', user, chosenName: match.displayName });
    try {
      await apiClient.deleteChartData({ encounterId, [match.field]: [match.dto] } as Parameters<
        typeof apiClient.deleteChartData
      >[0]);
      flashAndRemoveItem(match.resourceId, () => {
        setChartData((prev) => {
          if (!prev) return prev;
          const next: GetChartDataResponse = { ...prev };
          const list = (next[match.field] as Array<{ resourceId?: string }> | undefined) ?? [];
          (next[match.field] as unknown[]) = list.filter((x) => x.resourceId !== match.resourceId);
          return next;
        });
      });
      setConv({ kind: 'removed', user, chosenName: match.displayName });
    } catch (e) {
      console.error('Remove failed:', e);
      setConv({ kind: 'error', user, reply: `Could not remove "${match.displayName}". Please try again.` });
    }
  };

  // Build a free-text summary of what's currently on the chart, for the planner refresh
  // after apply-template. Only includes the categories the planner can emit add-* steps for.
  const buildChartStateSummary = (data: GetChartDataResponse | null | undefined): string => {
    if (!data) return '';
    const lines: string[] = [];
    if (data.diagnosis?.length) {
      lines.push(
        `Diagnoses: ${data.diagnosis
          .map((d) => `${d.code} — ${d.display}${d.isPrimary ? ' (primary)' : ''}`)
          .join('; ')}`
      );
    }
    if (data.conditions?.length) {
      lines.push(`Past medical conditions: ${data.conditions.map((c) => `${c.code} — ${c.display}`).join('; ')}`);
    }
    if (data.medications?.length) {
      lines.push(`Medications: ${data.medications.map((m) => m.name).join('; ')}`);
    }
    if (data.allergies?.length) {
      lines.push(`Allergies: ${data.allergies.map((a) => a.name).join('; ')}`);
    }
    if (data.surgicalHistory?.length) {
      lines.push(`Surgical history: ${data.surgicalHistory.map((s) => s.display).join('; ')}`);
    }
    if (data.episodeOfCare?.length) {
      lines.push(`Hospitalizations: ${data.episodeOfCare.map((h) => h.display).join('; ')}`);
    }
    if (data.procedures?.length) {
      lines.push(
        `Procedures on encounter: ${data.procedures
          .map((p) => p.procedureType ?? p.cptCodes?.[0]?.display ?? 'procedure')
          .join('; ')}`
      );
    }
    const checkedExam = (data.examObservations ?? []).filter((o) => o.value === true);
    if (checkedExam.length > 0) {
      // Group by section label for readability.
      const bySection: Record<string, string[]> = {};
      for (const o of checkedExam) {
        const section = FIELD_TO_SECTION_LABEL[o.field] ?? 'Other';
        const checked = (o.components ?? []).filter((c) => c.value);
        const label =
          checked.length > 0 ? `${o.label ?? o.field} (${checked.map((c) => c.label).join(', ')})` : o.label ?? o.field;
        (bySection[section] ??= []).push(label);
      }
      lines.push(
        'Exam findings already checked:\n' +
          Object.entries(bySection)
            .map(([sec, items]) => `  ${sec}: ${items.join('; ')}`)
            .join('\n')
      );
    }
    if (data.medicalDecision?.text?.trim()) {
      lines.push(`MDM already present (length ${data.medicalDecision.text.trim().length} chars).`);
    }
    return lines.join('\n');
  };

  const handleApplyTemplate = async (template: TemplateMatch, user: string): Promise<void> => {
    if (!apiClient || !oystehrZambda || !encounterId) return;
    setConv({ kind: 'applying-template', user, chosenName: template.title });
    try {
      // Snapshot resourceIds present BEFORE applying so we can flash anything new afterward.
      const before = collectResourceIds(chartDataRef.current);
      await applyTemplate(oystehrZambda, { encounterId, templateName: template.title });
      const fresh = await fetchEasyChartData(apiClient, encounterId);
      setChartData(fresh);
      const newIds = [...collectResourceIds(fresh)].filter((id) => !before.has(id));
      // Flag template-applied structured items as AI-charted (needs review) so they get the
      // highlight + click-to-correct — the most common way a diagnosis reaches the chart is via a
      // template, which otherwise bypasses the review affordance.
      const newIdSet = new Set(newIds);
      const templateAiCharted = new Map<string, AiChartedMeta>();
      const flagNew = (
        field: AiField,
        items: Array<{ resourceId?: string; name?: string; display?: string; code?: string }> | undefined
      ): void => {
        for (const item of items ?? []) {
          if (!item.resourceId || !newIdSet.has(item.resourceId)) continue;
          const display = chartedItemDisplay(field, item);
          templateAiCharted.set(item.resourceId, {
            field,
            display,
            searchTerms: [display].filter(Boolean),
            lowConfidence: false,
          });
        }
      };
      flagNew('diagnosis', fresh.diagnosis);
      flagNew('allergies', fresh.allergies);
      flagNew('conditions', fresh.conditions);
      flagNew('medications', fresh.medications);
      flagNew('surgicalHistory', fresh.surgicalHistory);
      flagNew('episodeOfCare', fresh.episodeOfCare);
      flagNew('cptCodes', fresh.cptCodes);
      // E&M is a scalar, not an array — flag it directly if the template added it.
      if (fresh.emCode?.resourceId && newIdSet.has(fresh.emCode.resourceId)) {
        templateAiCharted.set(fresh.emCode.resourceId, {
          field: 'emCode',
          display: chartedItemDisplay('emCode', fresh.emCode),
          searchTerms: [],
          lowConfidence: false,
        });
      }
      if (templateAiCharted.size > 0) {
        setAiCharted((prev) => {
          const next = new Map(prev);
          for (const [id, meta] of templateAiCharted) next.set(id, meta);
          return next;
        });
      }
      if (newIds.length > 0) {
        setFreshlyAdded((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.add(id));
          return next;
        });
        const tryScroll = (attempt: number): void => {
          const el = document.querySelector<HTMLElement>(`[data-easy-chart-id="${newIds[0]}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          else if (attempt < 10) setTimeout(() => tryScroll(attempt + 1), 50);
        };
        requestAnimationFrame(() => requestAnimationFrame(() => tryScroll(0)));
        setTimeout(() => {
          setFreshlyAdded((prev) => {
            const next = new Set(prev);
            newIds.forEach((id) => next.delete(id));
            return next;
          });
        }, 3000);
      }
      // Plan refresh: if a plan is active, re-call the planner with what's now on the chart so
      // remaining steps reflect what the template did. The template typically pre-fills exam
      // findings, a diagnosis, MDM, and patient instructions — without a refresh the planner's
      // original "add-diagnosis", "add-exam-finding", "edit medicalDecision" steps would
      // produce duplicates or overwrite the template's content. Best-effort: if the refresh
      // fails for any reason, fall back to the original plan with the in-flight dedup checks.
      const planSnapshot = planRef.current;
      if (planSnapshot && oystehrZambda) {
        try {
          // Lead with the applied template name — chartState alone (lists of findings/codes)
          // didn't make it obvious enough and the LLM kept re-emitting apply-template.
          const chartStateSummary = `Template "${
            template.title
          }" has ALREADY been applied to this chart — do NOT emit apply-template again.\n\n${buildChartStateSummary(
            fresh
          )}`;
          const noteContext = buildNoteContext();
          const { steps: refreshed } = await easyChartPlanner(oystehrZambda, {
            narrative: planSnapshot.narrative,
            noteContext,
            chartState: chartStateSummary,
            encounterId,
          });
          // Defense-in-depth: drop any apply-template from the refresh output. The template
          // is already on the chart; a second apply-template would either duplicate (if it
          // matches) or replace the wrong fields (if a different template name comes back).
          const refreshedFiltered = refreshed.filter((s) => s.kind !== 'apply-template');
          // Splice: keep completed steps + their results; replace pending steps with refresh.
          // The apply-template step itself hasn't terminally settled yet (we're still inside
          // handleApplyTemplate), so it's still at currentIdx. Move forward into refreshed.
          setPlan((prev) => {
            if (!prev) return null;
            const doneSteps = prev.steps.slice(0, prev.currentIdx + 1); // include apply-template
            return {
              ...prev,
              steps: [...doneSteps, ...refreshedFiltered],
            };
          });
        } catch (e) {
          console.warn('Plan refresh after template failed; proceeding with original plan:', e);
        }
      }
      setConv({ kind: 'applied-template', user, chosenName: template.title });
    } catch (e) {
      console.error('Apply template failed:', e);
      setConv({ kind: 'error', user, reply: `Could not apply template "${template.title}". Please try again.` });
    }
  };

  // Core two-step procedure save, shared by the chat-agent picker (handleProcedurePick) and the
  // command-palette "Add Procedure" items. Mirrors the regular Procedures page: CPT codes +
  // diagnoses must exist as FHIR Procedure / Condition resources before the procedure
  // ServiceRequest can reference them — so save those first, capture their resourceIds from the
  // response, then save the procedure pointing at them. Throws on failure (callers report).
  const saveProcedureFromQuickPick = async (qp: ProcedureQuickPickData): Promise<void> => {
    if (!apiClient || !encounterId) return;
    const step1 = await apiClient.saveChartData({
      encounterId,
      ...(qp.cptCodes?.length ? { cptCodes: qp.cptCodes } : {}),
      ...(qp.diagnoses?.length ? { diagnosis: qp.diagnoses } : {}),
    });
    mergeSaveResponse(step1);
    const savedCptCodes = step1.chartData?.cptCodes ?? [];
    const savedDiagnoses = step1.chartData?.diagnosis ?? [];
    const procDto: ProcedureDTO = {
      ...procedureDtoFromQuickPick(qp, procedureTypeNameByCode),
      cptCodes: savedCptCodes.length > 0 ? savedCptCodes : undefined,
      diagnoses: savedDiagnoses.length > 0 ? savedDiagnoses : undefined,
    };
    await saveAndMerge({ encounterId, procedures: [procDto] });
  };
  // Keep the palette's stable onSelect pointed at the latest closure.
  saveProcedureFromQuickPickRef.current = saveProcedureFromQuickPick;

  const handleProcedurePick = async (qp: ProcedureQuickPickData, user: string): Promise<void> => {
    if (!apiClient || !encounterId) return;
    setConv({ kind: 'saving', user, chosenName: qp.name });
    try {
      await saveProcedureFromQuickPick(qp);
      setConv({ kind: 'done', user, chosenName: qp.name });
    } catch (e) {
      console.error('Add procedure failed:', e);
      setConv({ kind: 'error', user, reply: `Could not add procedure "${qp.name}". Please try again.` });
    }
  };

  // Chart a structured ROS finding: save the leaf's -reports or -denies observation (value=true),
  // and uncheck the opposite-state observation if it was set (denies/reports are mutually exclusive).
  const handleRosPick = async (leaf: RosLeaf, finding: 'reports' | 'denies', user: string): Promise<void> => {
    if (!apiClient || !encounterId) return;
    const stateLabel = `${finding === 'denies' ? 'Denies' : 'Reports'} ${leaf.label}`;
    setConv({ kind: 'saving', user, chosenName: stateLabel });
    try {
      const state = finding === 'denies' ? RosFindingState.Denies : RosFindingState.Reports;
      const pairedState = finding === 'denies' ? RosFindingState.Reports : RosFindingState.Denies;
      const fieldKey = rosField(leaf.baseKey, state);
      const pairedKey = rosField(leaf.baseKey, pairedState);
      const obs = chartDataRef.current?.rosObservations ?? [];
      const existing = obs.find((o) => o.field === fieldKey);
      const paired = obs.find((o) => o.field === pairedKey);
      const updates: ExamObservationDTO[] = [
        { field: fieldKey, label: leaf.label, value: true, resourceId: existing?.resourceId },
      ];
      if (paired?.value === true) {
        updates.push({ field: pairedKey, label: leaf.label, value: false, resourceId: paired.resourceId });
      }
      await saveAndMerge({ encounterId, rosObservations: updates });
      setConv({ kind: 'done', user, chosenName: stateLabel });
    } catch (e) {
      console.error('Add ROS finding failed:', e);
      setConv({ kind: 'error', user, reply: `Could not add "${stateLabel}". Please try again.` });
    }
  };

  const handleExamPick = async (leaf: ExamLeaf, user: string): Promise<void> => {
    if (!apiClient || !encounterId) return;
    setConv({ kind: 'saving', user, chosenName: leaf.label });
    try {
      if (leaf.modalOption) {
        // Modal-option leaf: write as a `components` entry on the parent observation, the
        // same shape that ExamCheckboxWithModal.handleCloseModal saves. Preserve any
        // existing components on the parent observation that the provider had already
        // checked via the regular UI.
        const existing = (chartDataRef.current?.examObservations ?? []).find((o) => o.field === leaf.field);
        const existingComponents = existing?.components ?? [];
        const newComponent = {
          code: leaf.modalOption.optionCode,
          label: leaf.modalOption.optionLabel,
          value: true,
          groupLabel: leaf.modalOption.groupLabel,
          ...(leaf.modalOption.columnLabel ? { columnLabel: leaf.modalOption.columnLabel } : {}),
          abnormal: leaf.modalOption.abnormal,
        };
        // Dedup: replace by code if already present
        const merged = [...existingComponents.filter((c) => c.code !== newComponent.code), newComponent];
        await saveAndMerge({
          encounterId,
          examObservations: [
            {
              ...(existing?.resourceId ? { resourceId: existing.resourceId } : {}),
              field: leaf.field,
              // Preserve any existing label on the observation (set by the regular UI); fall
              // back to the parent checkbox label so the easy-chart render shows something
              // human-readable instead of the kebab-case field code.
              label: existing?.label ?? leaf.modalOption.parentLabel,
              value: true,
              components: merged,
            },
          ],
        });
      } else {
        // Plain checkbox leaf: simple field+value save.
        await saveAndMerge({
          encounterId,
          examObservations: [{ field: leaf.field, label: leaf.label, value: true }],
        });
      }
      setConv({ kind: 'done', user, chosenName: leaf.label });
    } catch (e) {
      console.error('Add exam finding failed:', e);
      setConv({ kind: 'error', user, reply: `Could not add "${leaf.label}" to the exam. Please try again.` });
    }
  };

  // Add several exam-finding leaves at once (from the multi-select picker). Leaves are grouped
  // by parent `field` so multiple modal-options under the same checkbox merge into ONE
  // observation's `components[]` (two separate saves would clobber each other), and so a plain
  // checkbox + its modal-options collapse into a single observation. Everything goes in one
  // saveAndMerge call.
  const handleExamPickMulti = async (leaves: ExamLeaf[], user: string): Promise<void> => {
    if (!apiClient || !encounterId || leaves.length === 0) return;
    const summary = leaves.map((l) => l.label).join(', ');
    setConv({ kind: 'saving', user, chosenName: summary });
    try {
      const byField = new Map<string, ExamLeaf[]>();
      for (const leaf of leaves) {
        byField.set(leaf.field, [...(byField.get(leaf.field) ?? []), leaf]);
      }

      const examObservations = Array.from(byField.entries()).map(([field, fieldLeaves]) => {
        const existing = (chartDataRef.current?.examObservations ?? []).find((o) => o.field === field);
        const modalLeaves = fieldLeaves.filter((l) => l.modalOption);
        const plainLeaf = fieldLeaves.find((l) => !l.modalOption);

        if (modalLeaves.length > 0) {
          const newComponents = modalLeaves.map((l) => ({
            code: l.modalOption!.optionCode,
            label: l.modalOption!.optionLabel,
            value: true,
            groupLabel: l.modalOption!.groupLabel,
            ...(l.modalOption!.columnLabel ? { columnLabel: l.modalOption!.columnLabel } : {}),
            abnormal: l.modalOption!.abnormal,
          }));
          const newCodes = new Set(newComponents.map((c) => c.code));
          const merged = [...(existing?.components ?? []).filter((c) => !newCodes.has(c.code)), ...newComponents];
          return {
            ...(existing?.resourceId ? { resourceId: existing.resourceId } : {}),
            field,
            label: existing?.label ?? modalLeaves[0].modalOption!.parentLabel,
            value: true,
            components: merged,
          };
        }
        // Plain checkbox leaf(s) only.
        return {
          ...(existing?.resourceId ? { resourceId: existing.resourceId } : {}),
          field,
          label: plainLeaf!.label,
          value: true,
        };
      });

      await saveAndMerge({ encounterId, examObservations });
      setConv({ kind: 'done', user, chosenName: summary });
    } catch (e) {
      console.error('Add exam findings failed:', e);
      setConv({ kind: 'error', user, reply: `Could not add those findings to the exam. Please try again.` });
    }
  };

  const handleExamRemove = async (item: ExamRemoveItem, user: string): Promise<void> => {
    if (!apiClient || !encounterId) return;
    setConv({ kind: 'removing', user, chosenName: item.displayName });
    try {
      if (!item.componentCode) {
        // Plain observation — delete it outright.
        const obs = chartDataRef.current?.examObservations?.find((o) => o.resourceId === item.resourceId);
        if (!obs) {
          setConv({ kind: 'error', user, reply: `Couldn't find that exam finding to remove.` });
          return;
        }
        flashAndRemoveItem(item.resourceId, () => {
          setChartData((prev) =>
            prev
              ? {
                  ...prev,
                  examObservations: (prev.examObservations ?? []).filter((o) => o.resourceId !== item.resourceId),
                }
              : prev
          );
        });
        await apiClient.deleteChartData({ encounterId, examObservations: [obs] } as Parameters<
          typeof apiClient.deleteChartData
        >[0]);
      } else {
        // Component-level removal — uncheck this component. If it's the last checked one,
        // delete the whole observation (mirrors the regular ExamCheckboxWithModal behavior).
        const obs = chartDataRef.current?.examObservations?.find((o) => o.resourceId === item.resourceId);
        if (!obs) {
          setConv({ kind: 'error', user, reply: `Couldn't find that exam finding to remove.` });
          return;
        }
        const remainingChecked = (obs.components ?? []).filter((c) => c.value && c.code !== item.componentCode);
        if (remainingChecked.length === 0) {
          flashAndRemoveItem(item.resourceId, () => {
            setChartData((prev) =>
              prev
                ? {
                    ...prev,
                    examObservations: (prev.examObservations ?? []).filter((o) => o.resourceId !== item.resourceId),
                  }
                : prev
            );
          });
          await apiClient.deleteChartData({ encounterId, examObservations: [obs] } as Parameters<
            typeof apiClient.deleteChartData
          >[0]);
        } else {
          // Save with the chosen component set to value=false (preserved in components so the
          // modal still shows it as available on next open, matching regular UI behavior).
          const nextComponents = (obs.components ?? []).map((c) =>
            c.code === item.componentCode ? { ...c, value: false } : c
          );
          await saveAndMerge({
            encounterId,
            examObservations: [
              {
                resourceId: obs.resourceId,
                field: obs.field,
                ...(obs.label ? { label: obs.label } : {}),
                value: true,
                components: nextComponents,
              },
            ],
          });
        }
      }
      setConv({ kind: 'removed', user, chosenName: item.displayName });
    } catch (e) {
      console.error('Remove exam finding failed:', e);
      setConv({ kind: 'error', user, reply: `Could not remove "${item.displayName}". Please try again.` });
    }
  };

  // Single save path for a free-text note field, shared by the right-pane planner
  // (handleEditNoteText) and the left-pane inline editors (InlineNoteField via NoteSections).
  // `key` is the actual chart-data storage key — the CC↔HPI swap is applied by the caller. Saves
  // to the same field are serialized through a per-field promise chain so they can't race.
  const saveNoteField = (key: ChartNoteKey, text: string): Promise<void> => {
    if (!apiClient || !encounterId) return Promise.resolve();
    const run = async (): Promise<void> => {
      const existing = chartDataRef.current?.[key] as { resourceId?: string } | undefined;
      const payload: SaveChartDataRequest = {
        encounterId,
        [key]: { resourceId: existing?.resourceId, text },
      } as SaveChartDataRequest;
      await saveAndMerge(payload);
    };
    const prior = noteSaveChainRef.current[key] ?? Promise.resolve();
    const next = prior.then(run, run);
    noteSaveChainRef.current[key] = next;
    return next;
  };

  const handleEditNoteText = async (
    intent: Extract<EasyChartAgentIntent, { kind: 'edit-note-text' }>,
    user: string
  ): Promise<void> => {
    if (!apiClient || !encounterId) return;
    // Map LLM-canonical field names to the corresponding chart-data scalar. The in-person
    // CC ↔ HPI swap (HpiField.tsx) means the textarea labeled "Chief Complaint" is backed
    // by historyOfPresentIllness and vice versa — we keep the agent honest by using the
    // human labels but writing to whichever chart-data key actually backs it.
    const fieldLabels: Record<typeof intent.field, string> = {
      chiefComplaint: 'Chief Complaint',
      historyOfPresentIllness: 'History of Present Illness',
      mechanismOfInjury: 'Mechanism of Injury',
      ros: 'Review of Systems',
      medicalDecision: 'Medical Decision Making',
    };
    const fieldLabel = fieldLabels[intent.field];
    // Re-apply the CC↔HPI swap when writing back. The LLM thinks of `chiefComplaint` as the
    // CC label's text, but in chart-data terms the CC label is backed by historyOfPresentIllness.
    const saveField: ChartNoteKey =
      intent.field === 'chiefComplaint'
        ? 'historyOfPresentIllness'
        : intent.field === 'historyOfPresentIllness'
        ? 'chiefComplaint'
        : intent.field;
    setConv({ kind: 'editing-note-text', user, fieldLabel });
    try {
      await saveNoteField(saveField, intent.newText);
      setConv({ kind: 'edited-note-text', user, fieldLabel });
    } catch (e) {
      console.error('Edit note text failed:', e);
      setConv({ kind: 'error', user, reply: `Could not update ${fieldLabel}. Please try again.` });
    }
  };

  // Inline structured-item removal from the left pane. Mirrors handleRemovePick (generic array
  // delete + removal flash) but without the right-pane conversation chatter; E&M is a scalar so
  // it gets its own branch. Errors surface via snackbar rather than the planner conversation.
  const removeInline = async (field: string, dto: { resourceId?: string }): Promise<void> => {
    if (!apiClient || !encounterId || !dto.resourceId) return;
    const resourceId = dto.resourceId;
    try {
      await apiClient.deleteChartData({ encounterId, [field]: [dto] } as Parameters<
        typeof apiClient.deleteChartData
      >[0]);
      flashAndRemoveItem(resourceId, () => {
        setChartData((prev) => {
          if (!prev) return prev;
          const next: GetChartDataResponse = { ...prev };
          const list = (next[field as keyof GetChartDataResponse] as Array<{ resourceId?: string }> | undefined) ?? [];
          (next[field as keyof GetChartDataResponse] as unknown) = list.filter((x) => x.resourceId !== resourceId);
          return next;
        });
      });
    } catch (e) {
      console.error('Inline remove failed:', e);
      enqueueSnackbar('Could not remove that item. Please try again.', { variant: 'error' });
    }
  };

  const removeEmInline = async (dto: { resourceId?: string }): Promise<void> => {
    if (!apiClient || !encounterId || !dto.resourceId) return;
    const resourceId = dto.resourceId;
    try {
      await apiClient.deleteChartData({ encounterId, emCode: dto } as Parameters<typeof apiClient.deleteChartData>[0]);
      flashAndRemoveItem(resourceId, () => {
        setChartData((prev) => (prev ? { ...prev, emCode: undefined } : prev));
      });
    } catch (e) {
      console.error('Inline E&M remove failed:', e);
      enqueueSnackbar('Could not remove the E&M code. Please try again.', { variant: 'error' });
    }
  };

  const handleInlineRemove = (field: string, dto: { resourceId?: string }): void => {
    if (field === 'emCode') {
      void removeEmInline(dto);
      return;
    }
    void removeInline(field, dto);
  };

  const handleProcedureUpdate = async (
    procedure: ProcedureDTO,
    intent: UpdateProcedureIntent,
    user: string
  ): Promise<void> => {
    if (!apiClient || !encounterId || !procedure.resourceId) return;
    const procName = procedure.procedureType ?? procedure.cptCodes?.[0]?.display ?? 'procedure';
    setConv({ kind: 'updating-procedure', user, chosenName: procName });
    try {
      const { updated, applied, skipped } = applyProcedureUpdates(
        procedure,
        intent.updates,
        procedureFieldAllowedValues
      );
      if (applied.length === 0) {
        const skippedMsg = skipped.length > 0 ? ` Unrecognized: ${skipped.join(', ')}.` : '';
        setConv({ kind: 'error', user, reply: `I couldn't apply any updates.${skippedMsg}` });
        return;
      }
      // saveChartData with resourceId set updates the existing procedure ServiceRequest.
      // Preserve cptCodes / diagnoses references (they already have resourceIds from the
      // initial save) so the update doesn't drop them.
      await saveAndMerge({ encounterId, procedures: [updated] });
      const summary = applied.map((a) => `${a.field}=${JSON.stringify(a.value)}`).join(', ');
      const skipNote = skipped.length > 0 ? ` (skipped: ${skipped.join(', ')})` : '';
      setConv({ kind: 'updated-procedure', user, chosenName: procName, summary: summary + skipNote });
    } catch (e) {
      console.error('Update procedure failed:', e);
      setConv({ kind: 'error', user, reply: `Could not update procedure "${procName}". Please try again.` });
    }
  };

  const handlePick = async (
    intent: AddSearchIntent,
    result: SearchResult,
    user: string,
    // When set, the saved item is registered as AI-charted (needs review) — used by the
    // no-stopping auto-chart path.
    provenance?: AiChartedMeta
  ): Promise<void> => {
    if (!apiClient || !encounterId) return;
    // A "Discuss" picker replaces the item it came from: delete the original first.
    const replaceTarget = replaceTargetRef.current;
    replaceTargetRef.current = null;
    setConv({ kind: 'saving', user, chosenName: result.name });
    try {
      if (replaceTarget) {
        await deleteChartedResource(replaceTarget.field, replaceTarget.dto);
      }
      const payload = buildIntentPayload(encounterId, intent, result);
      let newIds: string[] = [];
      if (payload) {
        newIds = await saveAndMerge(payload);
      }
      if (provenance && newIds.length > 0) {
        setAiCharted((prev) => {
          const next = new Map(prev);
          for (const id of newIds) next.set(id, provenance);
          return next;
        });
      }
      setConv({ kind: 'done', user, chosenName: result.name });
    } catch (e) {
      console.error('Save failed:', e);
      setConv({ kind: 'error', user, reply: `Could not add "${result.name}". Please try again.` });
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!apiClient || !encounterId) return;
    setLoading(true);
    setError(null);
    fetchEasyChartData(apiClient, encounterId)
      .then((d) => {
        if (!cancelled) setChartData(d);
      })
      .catch((e) => {
        console.error('Easy chart fetch failed:', e);
        if (!cancelled) setError('Could not load the chart for this encounter.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiClient, encounterId]);

  const isThinking =
    conv?.kind === 'thinking' ||
    conv?.kind === 'saving' ||
    conv?.kind === 'removing' ||
    conv?.kind === 'applying-template' ||
    conv?.kind === 'updating-procedure' ||
    conv?.kind === 'editing-note-text';
  // Restore focus to the refine bar after each action completes so the provider can keep
  // typing the next request without manually clicking the input. We trigger off the !isThinking
  // edge — the TextField is `disabled` while thinking, so refocusing must wait for re-enable.
  useEffect(() => {
    if (!isThinking) {
      requestAnimationFrame(() => refineInputRef.current?.focus());
    }
  }, [isThinking]);
  // Top chrome height (banner + navbar) to subtract from 100vh so each column scrolls within view.
  const topChrome = { xs: showEnvironmentBanner ? 116 : 56, sm: showEnvironmentBanner ? 124 : 64 };

  const refineBar = (
    <Paper elevation={2} sx={{ p: 2, position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}>
      <Stack spacing={1}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          placeholder='Try: "add allergy tree nut", "add diagnosis sinusitis"'
          value={refineText}
          onChange={(e) => setRefineText(e.target.value)}
          inputRef={refineInputRef}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          disabled={isThinking}
        />
        <Stack direction="row" justifyContent="flex-end">
          <Button
            variant="contained"
            sx={{ borderRadius: 100, textTransform: 'none' }}
            onClick={() => void handleSend()}
            disabled={!refineText.trim() || isThinking}
          >
            {isThinking ? <CircularProgress size={18} color="inherit" /> : 'Send'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );

  // Status icon for a given step index in the currently-running plan. Reads from plan.results
  // (which holds outcomes of completed steps, in order) and plan.currentIdx (the active step).
  const planStepStatusIcon = (idx: number): string => {
    if (!plan) return '·';
    if (idx < plan.results.length) {
      const r = plan.results[idx];
      if (r.status === 'done') return '✓';
      if (r.status === 'skipped') return '⏭';
      return '✗';
    }
    if (idx === plan.currentIdx) return '▶';
    return '·';
  };

  const planProgress = plan && (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Plan — step {plan.currentIdx + 1} of {plan.steps.length}
        </Typography>
        <Button
          size="small"
          variant="text"
          sx={{ textTransform: 'none', minWidth: 0 }}
          onClick={() => {
            setPlan(null);
            setConv({ kind: 'unknown', user: plan.narrative, reply: 'Plan cancelled.' });
          }}
        >
          Cancel plan
        </Button>
      </Stack>
      {/* Full step list with status icons — surfaces what was already done so the provider
          can interpret a mid-plan picker in context. */}
      <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
        {plan.steps.map((step, i) => {
          const isCurrent = i === plan.currentIdx;
          const isDone = i < plan.results.length;
          const color = isCurrent ? 'text.primary' : isDone ? 'text.secondary' : 'text.disabled';
          return (
            <Typography
              key={i}
              variant="caption"
              sx={{
                display: 'block',
                color,
                fontWeight: isCurrent ? 600 : 400,
                fontFamily: 'monospace',
                lineHeight: 1.5,
              }}
            >
              {planStepStatusIcon(i)} {i + 1}. {describePlanStep(step)}
            </Typography>
          );
        })}
      </Box>
    </Paper>
  );

  // Skip + Refine controls rendered at the bottom of every picker. Skip terminates the picker
  // with status="skipped" (visible as ⏭ in the running plan). Refine appends free-text to
  // the intent and re-dispatches to narrow the matches. Intent can be any kind that carries
  // a display/searchTerms — update-procedure / code-only intents don't (Refine is a no-op).
  const renderPickerActions = (
    intent:
      | EasyChartAgentIntent
      | RemoveIntent
      | ApplyTemplateIntent
      | AddProcedureIntent
      | UpdateProcedureIntent
      | AddExamFindingIntent
      | RemoveExamFindingIntent
  ): JSX.Element => {
    const refinable = 'display' in intent;
    return (
      <Stack direction="column" spacing={0.5} sx={{ mt: 1, mb: 1 }}>
        {refinable && (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              fullWidth
              placeholder="Search again (e.g. 'lac repair', 'short leg', 'left ear')"
              value={pickerRefineText}
              onChange={(e) => setPickerRefineText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pickerRefineText.trim()) {
                  e.preventDefault();
                  handleRefinePicker(intent, pickerRefineText);
                }
              }}
              inputProps={{ style: { fontSize: 13 } }}
            />
            <Button
              size="small"
              variant="outlined"
              sx={{ textTransform: 'none', minWidth: 0 }}
              disabled={!pickerRefineText.trim()}
              onClick={() => handleRefinePicker(intent, pickerRefineText)}
            >
              Refine
            </Button>
          </Stack>
        )}
        {plan && (
          <Button
            size="small"
            variant="text"
            sx={{ textTransform: 'none', alignSelf: 'flex-start', minWidth: 0 }}
            onClick={handleSkipPicker}
          >
            Skip this step
          </Button>
        )}
      </Stack>
    );
  };

  const conversationCard = conv && (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
        You
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {conv.user}
      </Typography>
      <Divider sx={{ my: 1 }} />
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
        Assistant
      </Typography>
      {conv.kind === 'thinking' && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <CircularProgress size={14} />
          <Typography variant="body2" color="text.secondary">
            Thinking…
          </Typography>
        </Stack>
      )}
      {conv.kind === 'unknown' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {conv.reply}
        </Typography>
      )}
      {conv.kind === 'no-match' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          No matches found for &ldquo;{conv.intent.display}&rdquo;. Try a different phrasing.
        </Typography>
      )}
      {conv.kind === 'choose' && (
        <>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            I found {conv.results.length} matches for &ldquo;{conv.intent.display}&rdquo;. Which one?
          </Typography>
          {(() => {
            // Strength-mismatch warning: when the provider asked for a specific medication
            // strength (e.g. "400 mg/5 mL") that doesn't appear in ANY catalog result, surface
            // the gap so they don't silently pick a different concentration. Checks the requested
            // strength against each result's name+strength fields after normalization.
            if (conv.intent.kind !== 'add-medication' || !conv.intent.strength) return null;
            const want = conv.intent.strength.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
            const present = conv.results.some((r) => {
              const haystack = `${r.name} ${r.strength ?? ''}`.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
              return haystack.includes(want);
            });
            if (present) return null;
            return (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'warning.dark', fontWeight: 600 }}>
                ⚠ Requested strength <strong>{conv.intent.strength}</strong> is not in the formulary — these are the
                closest available options.
              </Typography>
            );
          })()}
          {renderPickerActions(conv.intent)}
          <List dense sx={{ mt: 0.5 }}>
            {conv.results.map((r, i) => (
              <ListItemButton key={`${r.code ?? r.id ?? i}`} onClick={() => void handlePick(conv.intent, r, conv.user)}>
                <ListItemText
                  primary={r.name + (r.strength ? ` — ${r.strength}` : '')}
                  secondary={r.code}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            ))}
          </List>
        </>
      )}
      {conv.kind === 'saving' && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <CircularProgress size={14} />
          <Typography variant="body2" color="text.secondary">
            Adding {conv.chosenName}…
          </Typography>
        </Stack>
      )}
      {conv.kind === 'done' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Added <strong>{conv.chosenName}</strong> to the chart.
        </Typography>
      )}
      {conv.kind === 'no-match-remove' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          I couldn&rsquo;t find &ldquo;{conv.intent.display}&rdquo; in the chart.
        </Typography>
      )}
      {conv.kind === 'choose-remove' && (
        <>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            I found {conv.matches.length} matches for &ldquo;{conv.intent.display}&rdquo;. Which one to remove?
          </Typography>
          {renderPickerActions(conv.intent)}
          <List dense sx={{ mt: 0.5 }}>
            {conv.matches.map((m) => (
              <ListItemButton key={m.resourceId} onClick={() => void handleRemovePick(m, conv.user)}>
                <ListItemText primary={m.displayName} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItemButton>
            ))}
          </List>
        </>
      )}
      {conv.kind === 'removing' && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <CircularProgress size={14} />
          <Typography variant="body2" color="text.secondary">
            Removing {conv.chosenName}…
          </Typography>
        </Stack>
      )}
      {conv.kind === 'removed' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Removed <strong>{conv.chosenName}</strong> from the chart.
        </Typography>
      )}
      {conv.kind === 'no-match-template' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          I couldn&rsquo;t find a template matching &ldquo;{conv.intent.display}&rdquo;.
        </Typography>
      )}
      {conv.kind === 'choose-template' && (
        <>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            I found {conv.matches.length} templates matching &ldquo;{conv.intent.display}&rdquo;. Which one to apply?
          </Typography>
          {renderPickerActions(conv.intent)}
          <List dense sx={{ mt: 0.5 }}>
            {conv.matches.map((m) => (
              <ListItemButton key={m.id} onClick={() => void handleApplyTemplate(m, conv.user)}>
                <ListItemText primary={m.title} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItemButton>
            ))}
          </List>
        </>
      )}
      {conv.kind === 'applying-template' && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <CircularProgress size={14} />
          <Typography variant="body2" color="text.secondary">
            Applying {conv.chosenName}…
          </Typography>
        </Stack>
      )}
      {conv.kind === 'applied-template' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Applied template <strong>{conv.chosenName}</strong>.
        </Typography>
      )}
      {conv.kind === 'no-match-procedure' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          I couldn&rsquo;t find a procedure matching &ldquo;{conv.intent.display}&rdquo; in this practice&rsquo;s quick
          picks.
        </Typography>
      )}
      {conv.kind === 'choose-procedure' && (
        <>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            I found {conv.matches.length} procedures matching &ldquo;{conv.intent.display}&rdquo;. Which one to add?
          </Typography>
          {renderPickerActions(conv.intent)}
          <List dense sx={{ mt: 0.5 }}>
            {conv.matches.map((m) => (
              <ListItemButton key={m.id ?? m.name} onClick={() => void handleProcedurePick(m, conv.user)}>
                <ListItemText primary={m.name} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItemButton>
            ))}
          </List>
        </>
      )}
      {conv.kind === 'no-procedure-to-update' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          There&rsquo;s no procedure on this chart yet to update. Try &ldquo;add lac repair procedure&rdquo; first.
        </Typography>
      )}
      {conv.kind === 'choose-procedure-to-update' && (
        <>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            There are {conv.candidates.length} procedures on this chart. Which one to update?
          </Typography>
          {renderPickerActions(conv.intent)}
          <List dense sx={{ mt: 0.5 }}>
            {conv.candidates.map((p, i) => {
              const label = p.procedureType ?? p.cptCodes?.[0]?.display ?? `Procedure ${i + 1}`;
              return (
                <ListItemButton
                  key={p.resourceId ?? i}
                  onClick={() => void handleProcedureUpdate(p, conv.intent, conv.user)}
                >
                  <ListItemText primary={label} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItemButton>
              );
            })}
          </List>
        </>
      )}
      {conv.kind === 'updating-procedure' && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <CircularProgress size={14} />
          <Typography variant="body2" color="text.secondary">
            Updating {conv.chosenName}…
          </Typography>
        </Stack>
      )}
      {conv.kind === 'updated-procedure' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Updated <strong>{conv.chosenName}</strong>: {conv.summary}
        </Typography>
      )}
      {conv.kind === 'editing-note-text' && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <CircularProgress size={14} />
          <Typography variant="body2" color="text.secondary">
            Updating {conv.fieldLabel}…
          </Typography>
        </Stack>
      )}
      {conv.kind === 'edited-note-text' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Updated <strong>{conv.fieldLabel}</strong>.
        </Typography>
      )}
      {conv.kind === 'no-match-exam' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          I couldn&rsquo;t find an exam finding matching &ldquo;{conv.intent.display}&rdquo;.
        </Typography>
      )}
      {conv.kind === 'choose-exam' && (
        <>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            I found {conv.matches.length} exam findings matching &ldquo;{conv.intent.display}&rdquo;. Select the ones
            that apply (you can choose more than one):
          </Typography>
          {renderPickerActions(conv.intent)}
          <List dense sx={{ mt: 0.5 }}>
            {conv.matches.map((m) => {
              const key = leafKey(m);
              const checked = examPickSelected.has(key);
              return (
                <ListItemButton
                  key={key}
                  dense
                  onClick={() =>
                    setExamPickSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                >
                  <ListItemIcon sx={{ minWidth: 0, mr: 1 }}>
                    <Checkbox edge="start" size="small" checked={checked} tabIndex={-1} disableRipple sx={{ p: 0 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={m.label}
                    secondary={`${m.section} · ${m.normalAbnormal}`}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              );
            })}
          </List>
          <Button
            size="small"
            variant="contained"
            sx={{ textTransform: 'none', mt: 0.5 }}
            disabled={examPickSelected.size === 0}
            onClick={() => {
              const chosen = conv.matches.filter((m) => examPickSelected.has(leafKey(m)));
              void handleExamPickMulti(chosen, conv.user);
            }}
          >
            {examPickSelected.size > 1 ? `Add ${examPickSelected.size} findings` : 'Add finding'}
          </Button>
        </>
      )}
      {conv.kind === 'no-match-exam-remove' && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          I couldn&rsquo;t find anything in the exam matching &ldquo;{conv.intent.display}&rdquo;.
        </Typography>
      )}
      {conv.kind === 'choose-exam-remove' && (
        <>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            I found {conv.matches.length} exam findings matching &ldquo;{conv.intent.display}&rdquo;. Which one to
            remove?
          </Typography>
          {renderPickerActions(conv.intent)}
          <List dense sx={{ mt: 0.5 }}>
            {conv.matches.map((m, i) => (
              <ListItemButton
                key={`${m.resourceId}-${m.componentCode ?? 'obs'}-${i}`}
                onClick={() => void handleExamRemove(m, conv.user)}
              >
                <ListItemText
                  primary={m.displayName}
                  secondary={m.section}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            ))}
          </List>
        </>
      )}
      {conv.kind === 'skipped' && (
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          Skipped.
        </Typography>
      )}
      {conv.kind === 'error' && (
        <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
          {conv.reply}
        </Typography>
      )}
      {conv.kind === 'plan-preview' && (
        <>
          <Typography variant="body2" sx={{ mt: 0.5, mb: 1 }}>
            Here&rsquo;s what I&rsquo;ll do ({conv.steps.length} step{conv.steps.length === 1 ? '' : 's'}):
          </Typography>
          <Box sx={{ maxHeight: 280, overflowY: 'auto', mb: 1 }}>
            {conv.steps.map((step, i) => (
              <Typography
                key={i}
                variant="caption"
                sx={{
                  display: 'block',
                  color: 'text.secondary',
                  fontFamily: 'monospace',
                  lineHeight: 1.5,
                }}
              >
                {i + 1}. {describePlanStep(step)}
              </Typography>
            ))}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              sx={{ textTransform: 'none' }}
              onClick={() => {
                if (conv.kind !== 'plan-preview') return;
                const { narrative, steps } = conv;
                setPlan({ narrative, steps, currentIdx: 0, results: [] });
              }}
            >
              Approve &amp; run
            </Button>
            <Button
              size="small"
              variant="text"
              sx={{ textTransform: 'none' }}
              onClick={() => {
                if (conv.kind !== 'plan-preview') return;
                setConv({ kind: 'unknown', user: conv.user, reply: 'Plan cancelled before execution.' });
              }}
            >
              Cancel
            </Button>
          </Stack>
        </>
      )}
    </Paper>
  );

  const notePane = loading ? (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
      <CircularProgress size={20} />
    </Paper>
  ) : error ? (
    <Paper variant="outlined" sx={{ p: 2, borderColor: 'error.main' }}>
      <Typography variant="body2" color="error">
        {error}
      </Typography>
    </Paper>
  ) : chartData ? (
    <>
      {aiCharted.size > 0 && (
        <Box
          sx={{
            mb: 1.5,
            px: 1.5,
            py: 1,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: 'rgba(25,118,210,0.08)',
            border: '1px solid',
            borderColor: 'rgba(25,118,210,0.3)',
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="body2" color="text.secondary">
            <strong>{aiCharted.size}</strong> AI-charted {aiCharted.size === 1 ? 'item needs' : 'items need'} review —
            click a highlighted item to confirm, change, or remove it.
          </Typography>
        </Box>
      )}
      <NoteSections
        data={chartData}
        freshlyAdded={freshlyAdded}
        removingItems={removingItems}
        editable
        onSaveField={saveNoteField}
        onRemoveItem={handleInlineRemove}
        aiCharted={aiCharted}
        onAiSearch={aiSearch}
        onAiReplace={aiReplace}
        onAiRemove={aiRemove}
        onAiDiscuss={aiDiscuss}
        onAiSetMedDosage={aiSetMedDosage}
      />
    </>
  ) : null;

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Easy Chart
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Encounter {encounterId}
          </Typography>
        </Box>
        {appointmentId && (
          <Button
            variant="outlined"
            size="small"
            component="a"
            href={`/in-person/${appointmentId}/cc-and-intake-notes`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ textTransform: 'none' }}
          >
            Open in regular chart
          </Button>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr minmax(320px, 1fr)' },
          gap: 2,
          // Constrain to viewport on md+ so each column scrolls independently
          height: { md: `calc(100vh - ${topChrome.sm}px - 80px)` },
        }}
      >
        {/* Left column: the note */}
        <Box sx={{ overflowY: { md: 'auto' }, pr: { md: 1 } }}>{notePane}</Box>

        {/* Right column: AI conversation */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ overflowY: { md: 'auto' }, pr: { md: 1 } }}>
            <Stack spacing={2}>
              {refineBar}
              {planProgress}
              {conversationCard}
            </Stack>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}
