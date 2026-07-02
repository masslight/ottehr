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
import { VitalsObservationDTO } from 'utils';
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

// A vitals row: click-to-edit numeric value(s) like other note items, plus the same provenance/review
// treatment (needs-review tint, sourced/inferred/review hover, Confirm ✓, Remove ✕). Vitals aren't
// searchable, so they don't use AiChartedItem — edit is a plain number field per vital type
// (two fields for BP). Temperature is edited in °F (US-dictated) and stored as °C.
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
  // Editable unit field(s) for this vital + the canonical→stored mapping. Lets the provider type in
  // EITHER metric or imperial (temp °C/°F, weight kg/lbs, height cm/in) with live cross-conversion,
  // reusing the same conversion helpers the regular Vitals screen uses.
  const { fields, toStored } = vitalUnitFields(vital.field);
  const seedCanonical = 'value' in vital && vital.value != null ? Number(vital.value) : undefined;
  const [editing, setEditing] = useState(false);
  // `canonical` is the stored-unit value (°C / kg / cm / raw); `active` holds the in-progress text of
  // the field currently being typed, so its raw entry isn't reformatted away while the OTHER unit
  // field(s) re-derive live from `canonical`.
  const [canonical, setCanonical] = useState<number | undefined>(seedCanonical);
  const [active, setActive] = useState<{ idx: number; text: string } | null>(null);
  const [sys, setSys] = useState(isBp ? String(vital.systolicPressure ?? '') : '');
  const [dia, setDia] = useState(isBp ? String(vital.diastolicPressure ?? '') : '');
  const canEdit = !!(editable && onSaveVital);

  const startEdit = (): void => {
    setCanonical(seedCanonical);
    setActive(null);
    setSys(isBp ? String(vital.systolicPressure ?? '') : '');
    setDia(isBp ? String(vital.diastolicPressure ?? '') : '');
    setEditing(true);
  };
  const commit = (): void => {
    setEditing(false);
    if (!onSaveVital) return;
    if (isBp) {
      const s = Number(sys);
      const d = Number(dia);
      if (!s || !d) return;
      onSaveVital({
        field: vital.field,
        systolicPressure: s,
        diastolicPressure: d,
        resourceId: vital.resourceId,
      } as VitalsObservationDTO);
      return;
    }
    if (canonical == null || Number.isNaN(canonical)) return;
    onSaveVital({
      field: vital.field,
      value: toStored(canonical),
      resourceId: vital.resourceId,
    } as VitalsObservationDTO);
  };
  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  if (editing && canEdit) {
    return (
      <ClickAwayListener onClickAway={commit}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25, flexWrap: 'wrap' }}>
          <Typography variant="body2">• {VITAL_LABEL[vital.field] ?? vital.field}:</Typography>
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
        </Box>
      </ClickAwayListener>
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
      onClick={canEdit ? startEdit : undefined}
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
