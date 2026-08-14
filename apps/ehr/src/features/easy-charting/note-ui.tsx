// Presentational building blocks of the easy-chart note: section frames, inline editors, vital
// rows, the flash/remove animations, and the full NoteSections renderer.
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Autocomplete,
  Box,
  ClickAwayListener,
  Collapse,
  IconButton,
  keyframes,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { HEIGHT_CM_DISPLAY_PRECISION, HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { AiChartedMeta } from './chart-types';
import { formatVital, VITAL_LABEL, vitalUnitFields } from './vitals-display';

// Shared section-header styling so each band in the note reads like a real section header
// rather than a flat label. Underlined + bolded primary-color text on a hairline divider.
export const sectionHeaderSx = {
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
export function formatProcedureType(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return code
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <Box sx={{ py: 1.25 }}>
      <Typography variant="subtitle2" sx={sectionHeaderSx}>
        {title}
      </Typography>
      <Box sx={{ mt: 0.75 }}>{children}</Box>
    </Box>
  );
}

export function CollapsibleSection({
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

// Click-to-edit free text shown inline in the note (used for the per-field editing of structured
// items like procedures). Renders the value as a clickable span; click → in-place TextField that
// commits on blur or Enter, cancels on Escape. Empty values show a faint "add…" affordance.
export function InlineEditableText({
  value,
  placeholder = 'add…',
  multiline,
  onSave,
}: {
  value?: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (v: string) => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const commit = (): void => {
    setEditing(false);
    if (draft !== (value ?? '')) onSave(draft);
  };
  if (editing) {
    return (
      <ClickAwayListener onClickAway={commit}>
        <TextField
          size="small"
          fullWidth
          autoFocus
          multiline={multiline}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !multiline) {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              setDraft(value ?? '');
              setEditing(false);
            }
          }}
          sx={{ my: 0.25 }}
        />
      </ClickAwayListener>
    );
  }
  return (
    <Box
      component="span"
      onClick={() => {
        setDraft(value ?? '');
        setEditing(true);
      }}
      sx={{ cursor: 'pointer', borderRadius: 0.5, px: 0.25, mx: -0.25, '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }}
    >
      {value || (
        <Box component="em" sx={{ opacity: 0.5 }}>
          {placeholder}
        </Box>
      )}
    </Box>
  );
}

// Which of the four height boxes is being typed in. Mirrors useHeightLocalState's HeightField.
type HeightBox = 'cm' | 'inches' | 'feet' | 'inchRemainder';

const heightAsText = (value: number | undefined): string => (value === undefined ? '' : `${value}`);

// The dual-unit inline entry field(s) for one vital, extracted from VitalRow's edit mode so the
// "+ add" chips (VitalAddChips) reuse the exact same UI. Type in EITHER unit box and the sibling
// re-derives live via vitalUnitFields' canonical parse/render (temp °C/°F, weight kg/lbs); height
// gets the regular height card's four boxes (cm | total inches ≈ ft | in, any mode cross-fills);
// BP is sys/dia; single-unit vitals one box.
// Enter or click-away commits (dto is undefined when nothing valid was entered); Escape cancels.
export function VitalEntryEditor({
  field,
  initialCanonical,
  initialSys,
  initialDia,
  onCommit,
  onCancel,
  children,
}: {
  field: string;
  initialCanonical?: number;
  initialSys?: number;
  initialDia?: number;
  onCommit: (dto: VitalsObservationDTO | undefined) => void;
  onCancel: () => void;
  children?: React.ReactNode;
}): JSX.Element {
  const isBp = field === 'vital-blood-pressure';
  const isHeight = field === 'vital-height';
  const { fields, toStored } = vitalUnitFields(field);
  // `canonical` is the stored-unit value (°C / kg / raw); `active` holds the in-progress text of
  // the field currently being typed, so its raw entry isn't reformatted away while the OTHER unit
  // field(s) re-derive live from `canonical`.
  const [canonical, setCanonical] = useState<number | undefined>(isHeight ? undefined : initialCanonical);
  const [active, setActive] = useState<{ idx: number; text: string } | null>(null);
  const [sys, setSys] = useState(initialSys != null ? String(initialSys) : '');
  const [dia, setDia] = useState(initialDia != null ? String(initialDia) : '');
  // Height mirrors useHeightLocalState (the regular Vitals height card's state): one full-precision
  // HeightMeasurement source of truth plus the raw text of the box being typed, so cm, total inches,
  // and the ft/in pair cross-fill live with the card's exact conversions/precision. (The hook itself
  // can't seed an initial value for VitalRow editing, so its logic is mirrored here instead.)
  const [height, setHeight] = useState<HeightMeasurement | undefined>(() =>
    isHeight && initialCanonical != null ? HeightMeasurement.fromCm(initialCanonical) : undefined
  );
  const [heightEditing, setHeightEditing] = useState<{ box: HeightBox; text: string } | null>(null);

  const commit = (): void => {
    if (isBp) {
      const s = Number(sys);
      const d = Number(dia);
      onCommit(s && d ? ({ field, systolicPressure: s, diastolicPressure: d } as VitalsObservationDTO) : undefined);
      return;
    }
    if (isHeight) {
      // getCm() defaults to the save precision — same DTO shape as useHeightLocalState's getDTO.
      onCommit(height ? ({ field, value: height.getCm() } as VitalsObservationDTO) : undefined);
      return;
    }
    onCommit(
      canonical == null || Number.isNaN(canonical)
        ? undefined
        : ({ field, value: toStored(canonical) } as VitalsObservationDTO)
    );
  };
  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const heightBoxValue = (box: HeightBox, derived: number | undefined): string =>
    heightEditing?.box === box ? heightEditing.text : heightAsText(derived);
  const onHeightChange = (box: HeightBox, text: string): void => {
    setHeightEditing({ box, text });
    if (box === 'cm') {
      setHeight(HeightMeasurement.fromCmText(text));
    } else if (box === 'inches') {
      setHeight(HeightMeasurement.fromInchesText(text));
    } else if (box === 'feet') {
      const rem =
        heightEditing?.box === 'inchRemainder' ? heightEditing.text : heightAsText(height?.getInchRemainder());
      setHeight(HeightMeasurement.fromFeetInchesText(text, rem));
    } else {
      const feet = heightEditing?.box === 'feet' ? heightEditing.text : heightAsText(height?.getFeet());
      setHeight(HeightMeasurement.fromFeetInchesText(feet, text));
    }
  };
  const heightBox = (box: HeightBox, derived: number | undefined, autoFocus = false, width = 64): JSX.Element => (
    <TextField
      size="small"
      type="number"
      autoFocus={autoFocus}
      value={heightBoxValue(box, derived)}
      onChange={(e) => onHeightChange(box, e.target.value)}
      onKeyDown={onKey}
      sx={{ width }}
    />
  );

  return (
    <ClickAwayListener onClickAway={commit}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25, flexWrap: 'wrap' }}>
        <Typography variant="body2">• {VITAL_LABEL[field] ?? field}:</Typography>
        {isBp ? (
          <>
            <TextField
              size="small"
              type="number"
              autoFocus
              value={sys}
              onChange={(e) => setSys(e.target.value)}
              onKeyDown={onKey}
              sx={{ width: 72 }}
            />
            <Typography variant="body2">/</Typography>
            <TextField
              size="small"
              type="number"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              onKeyDown={onKey}
              sx={{ width: 72 }}
            />
            <Typography variant="caption" color="text.secondary">
              mmHg
            </Typography>
          </>
        ) : isHeight ? (
          // The regular height card's three entry modes (VitalsHeightCard): cm alone, total inches
          // alone, or the ft/in pair — typing in any mode cross-fills the others live.
          <>
            {heightBox('cm', height?.getCm(HEIGHT_CM_DISPLAY_PRECISION), true, 72)}
            <Typography variant="caption" color="text.secondary">
              cm
            </Typography>
            {heightBox('inches', height?.getInches(), false, 72)}
            <Typography variant="caption" color="text.secondary">
              in
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ≈
            </Typography>
            {heightBox('feet', height?.getFeet())}
            <Typography variant="caption" color="text.secondary">
              ft
            </Typography>
            {heightBox('inchRemainder', height?.getInchRemainder())}
            <Typography variant="caption" color="text.secondary">
              in
            </Typography>
          </>
        ) : (
          // One field per unit — type in either; the others convert live. Stored value is canonical.
          fields.map((f, i) => (
            <Box key={f.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TextField
                size="small"
                type="number"
                autoFocus={i === 0}
                value={active?.idx === i ? active.text : canonical != null ? f.render(canonical) : ''}
                onChange={(e) => {
                  const text = e.target.value;
                  setActive({ idx: i, text });
                  setCanonical(f.parse(text));
                }}
                onKeyDown={onKey}
                sx={{ width: 90 }}
              />
              <Typography variant="caption" color="text.secondary">
                {f.label}
              </Typography>
            </Box>
          ))
        )}
        {children}
      </Box>
    </ClickAwayListener>
  );
}

// A vitals row: click-to-edit numeric value(s) like other note items, plus the same provenance/review
// treatment (needs-review tint, sourced/inferred/review hover, Confirm ✓, Remove ✕). Vitals aren't
// searchable, so they don't use AiChartedItem — edit swaps in VitalEntryEditor (numeric field per
// vital type, two fields for BP). Temperature is edited in °F (US-dictated) and stored as °C.
export function VitalRow({
  vital,
  meta,
  editable,
  onConfirm,
  onRemove,
  onSaveVital,
}: {
  vital: VitalsObservationDTO;
  meta?: AiChartedMeta;
  editable?: boolean;
  onConfirm?: () => void;
  onRemove?: () => void;
  onSaveVital?: (dto: VitalsObservationDTO) => void;
}): JSX.Element {
  const isBp = vital.field === 'vital-blood-pressure';
  const seedCanonical = 'value' in vital && vital.value != null ? Number(vital.value) : undefined;
  const [editing, setEditing] = useState(false);
  const canEdit = !!(editable && onSaveVital);

  if (editing && canEdit) {
    return (
      <VitalEntryEditor
        field={vital.field}
        initialCanonical={seedCanonical}
        initialSys={isBp ? vital.systolicPressure : undefined}
        initialDia={isBp ? vital.diastolicPressure : undefined}
        onCommit={(dto) => {
          setEditing(false);
          if (dto && onSaveVital) onSaveVital({ ...dto, resourceId: vital.resourceId } as VitalsObservationDTO);
        }}
        onCancel={() => setEditing(false)}
      >
        {/* Remove lives in edit mode (like other note items) — it appears once the row is selected. */}
        {onRemove && (
          <IconButton
            size="small"
            color="error"
            aria-label="Remove vital"
            sx={{ p: 0.25, ml: 0.5 }}
            onClick={() => {
              setEditing(false);
              onRemove();
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </VitalEntryEditor>
    );
  }

  const needsReview = !!meta;
  const hint = meta?.reviewNote
    ? `Suggested by note review: ${meta.reviewNote}`
    : meta?.sourceText
    ? `Charted from the dictation: “${meta.sourceText}”`
    : meta?.templateName
    ? `Charted from the “${meta.templateName}” template — verify it fits this visit.`
    : meta?.inferred
    ? 'Inferred — not stated in the dictation. Verify before signing.'
    : needsReview
    ? 'Added by the assistant — review it, then confirm (✓) or correct it.'
    : undefined;

  return (
    <Box
      onClick={canEdit ? (): void => setEditing(true) : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        borderRadius: 1,
        px: 0.5,
        mx: -0.5,
        cursor: canEdit ? 'pointer' : 'default',
        bgcolor: needsReview ? (meta?.inferred ? 'rgba(237,108,2,0.14)' : 'rgba(25,118,210,0.12)') : 'transparent',
        '&:hover': canEdit ? { bgcolor: needsReview ? undefined : 'rgba(0,0,0,0.05)' } : undefined,
      }}
    >
      <Tooltip title={hint ?? ''} placement="top-start" arrow disableHoverListener={!hint}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          • {formatVital(vital)}
          {meta?.inferred && (
            <Typography
              component="span"
              variant="caption"
              sx={{ ml: 0.75, color: 'warning.dark', fontStyle: 'italic', fontWeight: 600 }}
            >
              · inferred
            </Typography>
          )}
          {meta?.reviewNote && (
            <Typography
              component="span"
              variant="caption"
              sx={{ ml: 0.75, color: 'info.main', fontStyle: 'italic', fontWeight: 600 }}
            >
              · review
            </Typography>
          )}
        </Typography>
      </Tooltip>
      {needsReview && onConfirm && (
        <Tooltip title="Looks right — mark reviewed" placement="top" arrow>
          <IconButton
            size="small"
            color="success"
            aria-label="Confirm vital"
            sx={{ p: 0.25 }}
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
          >
            <CheckIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

// Click-to-edit for a field constrained to a value set (e.g. a procedure's Side, Technique). Shows
// the friendly display(s) in read mode; click → an in-place autocomplete limited to the allowed
// options (multi-select when the field holds several). Stores the option CODE(s), like the regular UI.
export function InlineEnumField({
  selectedCodes,
  allowed,
  multiple,
  onSave,
}: {
  selectedCodes: string[];
  allowed: Map<string, string>; // code → display
  multiple?: boolean;
  onSave: (codes: string[]) => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const options = useMemo(() => [...allowed.entries()].map(([code, display]) => ({ code, display })), [allowed]);
  const displayText = selectedCodes.map((c) => allowed.get(c) ?? c).join(', ');
  if (!editing) {
    return (
      <Box
        component="span"
        onClick={() => setEditing(true)}
        sx={{ cursor: 'pointer', borderRadius: 0.5, px: 0.25, mx: -0.25, '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }}
      >
        {displayText || (
          <Box component="em" sx={{ opacity: 0.5 }}>
            select…
          </Box>
        )}
      </Box>
    );
  }
  const selectedOptions = options.filter((o) => selectedCodes.includes(o.code));
  return (
    <ClickAwayListener onClickAway={() => setEditing(false)}>
      <Autocomplete
        open
        size="small"
        multiple={multiple}
        options={options}
        getOptionLabel={(o) => o.display}
        isOptionEqualToValue={(o, v) => o.code === v.code}
        value={multiple ? selectedOptions : selectedOptions[0] ?? null}
        onChange={(_e, v) => {
          const codes = multiple
            ? (v as { code: string }[]).map((o) => o.code)
            : v
            ? [(v as { code: string }).code]
            : [];
          onSave(codes);
          if (!multiple) setEditing(false);
        }}
        sx={{ my: 0.25 }}
        renderInput={(params) => <TextField {...params} autoFocus variant="standard" placeholder="Select…" />}
      />
    </ClickAwayListener>
  );
}

// Keyframes defined at module level so the animation runs reliably whether `flashSx` is
// passed directly to `sx` or spread into a larger sx object. The animation pulses a bold
// yellow + outline so it's hard to miss against a white note background.
export const flashKeyframe = keyframes`
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

export const flashSx = {
  animation: `${flashKeyframe} 3s ease-out`,
  borderRadius: '4px',
  px: 0.5,
  mx: -0.5,
};

// For removes, we briefly highlight the item in red so the user sees what's about to be
// deleted, then unmount it. The animation duration is matched to the removal delay in
// flashAndRemoveItem (1.5s) so the flash plays to completion just as the item disappears.
export const removeFlashKeyframe = keyframes`
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

export const removeFlashSx = {
  animation: `${removeFlashKeyframe} 1.5s ease-out forwards`,
  borderRadius: '4px',
  px: 0.5,
  mx: -0.5,
};

// Wraps a structured note item with a hover-revealed remove control when the note is editable.
// The removal flash (`flashSx`) and the `data-easy-chart-id` hook move onto this row so the whole
// item flashes red as it's deleted. Read-only mode renders the children unchanged.
export function DeletableRow({
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
