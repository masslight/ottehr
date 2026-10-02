import { Close } from '@mui/icons-material';
import {
  alpha,
  Box,
  Button,
  Checkbox,
  ClickAwayListener,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Popper,
  SxProps,
  TextField,
  Theme,
  Typography,
} from '@mui/material';
import { blue, orange } from '@mui/material/colors';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DatePicker, LocalizationProvider, TimePicker } from '@mui/x-date-pickers-pro';
import { DateTime } from 'luxon';
import {
  FC,
  Fragment,
  isValidElement,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { sentenceValue } from './sentenceValue';

/** Sentence-style form pieces ("E · Blue text"): a filled blank is blue medium-weight text, an empty blank
 * is a dashed outline showing its label, and the whole sentence reads as note text at body size. */

export interface BlankOption {
  value: string;
  label: string;
}

const SEARCH_THRESHOLD = 8;

/** Playwright locates an open blank popover by this id (see tests/e2e/page/DocumentProcedurePage.ts). */
export const BLANK_POPOVER_TEST_ID = 'blank-popover';

export const SENTENCE_SX: SxProps<Theme> = {
  fontSize: '16px',
  lineHeight: 1.6,
  color: 'text.primary',
  // Prose line length, even when the column is wider.
  maxWidth: '75ch',
};

/** Values read in MUI blue[800] (5.8:1 on white) rather than the lighter primary; the tint and hover are
 * the mockup's rgba(25,118,210,…), i.e. blue[700]. */
const VALUE_COLOR = blue[800];
const TINT_COLOR = blue[700];

const filledSx = (): Record<string, unknown> => ({
  color: VALUE_COLOR,
  fontWeight: 500,
  backgroundColor: 'transparent',
  '&:hover': { backgroundColor: alpha(TINT_COLOR, 0.08) },
});

/** The mockup's warning orange (#F57C00) for blanks that billing or validation still needs. */
const NEED_COLOR = orange[700];

const emptySx = (theme: Theme, need: boolean): Record<string, unknown> => ({
  color: need ? NEED_COLOR : theme.palette.text.secondary,
  border: `1px dashed ${need ? NEED_COLOR : theme.palette.text.secondary}`,
  padding: '0 4px',
  backgroundColor: 'transparent',
});

const ghostSx = (theme: Theme): Record<string, unknown> => ({
  color: theme.palette.text.secondary,
  // "+ details" and friends never break between the "+" and the word.
  whiteSpace: 'nowrap',
  '&:hover': { backgroundColor: theme.palette.action.hover, color: theme.palette.text.primary },
});

export const listText = (values: readonly string[]): string =>
  values.length <= 1 ? values[0] ?? '' : `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;

interface BlankButtonProps {
  label: string;
  value?: string;
  need?: boolean;
  ghost?: boolean;
  readOnly: boolean;
  onClick: (anchor: HTMLElement) => void;
  dataTestId?: string;
  /** Native tooltip, used for a coding field's helper text. */
  hint?: string;
}

/** The clickable value inside a sentence. Read-only surfaces get the same words as plain text. */
export const BlankButton: FC<BlankButtonProps> = ({
  label,
  value,
  need,
  ghost,
  readOnly,
  onClick,
  dataTestId,
  hint,
}) => {
  if (readOnly) {
    return (
      <Box component="span" sx={value ? { ...filledSx(), '&:hover': {} } : { color: 'text.secondary' }}>
        {value ?? `[${label}]`}
      </Box>
    );
  }
  // An inline span rather than <button>: a long value then wraps across lines like the surrounding text.
  return (
    <Box
      component="span"
      role="button"
      tabIndex={0}
      title={hint}
      aria-label={`${label}${value ? `: ${value}` : ' (empty)'}`}
      data-testid={dataTestId}
      onClick={(event: MouseEvent<HTMLElement>) => onClick(event.currentTarget)}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(event.currentTarget);
        }
      }}
      sx={(theme) => ({
        font: 'inherit',
        lineHeight: 'inherit',
        borderRadius: '3px',
        padding: '1px 2px',
        cursor: 'pointer',
        backgroundColor: 'transparent',
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
        ...(value ? filledSx() : ghost ? ghostSx(theme) : emptySx(theme, need ?? false)),
        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
      })}
    >
      {value ?? label}
    </Box>
  );
};

interface PopoverBlankProps extends Omit<BlankButtonProps, 'onClick'> {
  /** Popover heading; defaults to the blank's label. */
  title?: string;
  children: (close: () => void) => ReactNode;
  onClose?: () => void;
}

/** The focus trap lands on the paper; typing should reach the search box (or the current pick) instead. */
const focusPopoverContent = (paper: HTMLElement): void => {
  const target =
    paper.querySelector<HTMLElement>('input:not([type="checkbox"])') ??
    paper.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ??
    paper.querySelector<HTMLElement>('[role="option"], input');
  target?.focus();
};

/** A blank whose click opens a popover; the caller supplies the popover body. */
/** The Autocomplete inside the procedure-type and diagnosis popovers portals its own listbox to the
 * body; a click on one of its options must not count as a click away from the popover. */
const inPortaledListbox = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('.MuiAutocomplete-popper') != null;

/** Non-modal on purpose: a modal popover's backdrop swallowed the first click on Save / Clear Form /
 * another blank. Here the click away closes the popover and still reaches its target. */
export const PopoverBlank: FC<PopoverBlankProps> = ({ title, children, onClose, ...blank }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // Focus moves into the paper only after Popper has placed it: focusing earlier opens an autocomplete
  // list (openOnFocus) while the paper still sits at the top-left corner, and that list stays there.
  const paperEl = useRef<HTMLDivElement | null>(null);
  const paperRef = useCallback((paper: HTMLDivElement | null) => {
    paperEl.current = paper;
  }, []);
  const onPlaced = useCallback(() => {
    if (paperEl.current) focusPopoverContent(paperEl.current);
  }, []);
  const close = (): void => {
    setAnchor(null);
    onClose?.();
  };
  useEffect(() => {
    if (!anchor) return;
    // Document-level, capture phase (as MUI's modal did): one Escape closes the popover wherever focus
    // is, even when an autocomplete list inside it is open.
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);
  return (
    <>
      <BlankButton {...blank} onClick={setAnchor} />
      {anchor && (
        <Popper
          open
          anchorEl={anchor}
          placement="bottom-start"
          sx={{ zIndex: (theme) => theme.zIndex.modal }}
          modifiers={[{ name: 'preventOverflow', options: { padding: 8 } }]}
          popperOptions={{ onFirstUpdate: onPlaced }}
        >
          <ClickAwayListener
            mouseEvent="onMouseDown"
            touchEvent="onTouchStart"
            onClickAway={(event) => {
              if (!inPortaledListbox(event.target)) close();
            }}
          >
            <Paper
              ref={paperRef}
              elevation={8}
              data-testid={BLANK_POPOVER_TEST_ID}
              sx={{ minWidth: 280, maxWidth: 400, maxHeight: 360, overflow: 'auto', p: 1 }}
            >
              <Typography sx={{ fontSize: '12px', fontWeight: 700, px: 1, py: 0.5 }}>{title ?? blank.label}</Typography>
              {children(close)}
            </Paper>
          </ClickAwayListener>
        </Popper>
      )}
    </>
  );
};

const toOptions = (options: readonly string[] | readonly BlankOption[] | undefined): BlankOption[] =>
  (options ?? []).map((option) => (typeof option === 'string' ? { value: option, label: option } : option));

interface SelectBlankProps {
  label: string;
  title?: string;
  options: readonly string[] | readonly BlankOption[] | undefined;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  readOnly: boolean;
  need?: boolean;
  /** Offers "Clear" at the end of the list, as the old dropdown's clear button did. */
  clearable?: boolean;
  dataTestId?: string;
  helperText?: string;
}

export const SelectBlank: FC<SelectBlankProps> = ({
  label,
  title,
  options,
  value,
  onChange,
  readOnly,
  need,
  clearable,
  dataTestId,
  helperText,
}) => {
  const [filter, setFilter] = useState('');
  const known = toOptions(options);
  // A saved value outside today's list (older config, a quick pick) stays selectable rather than vanishing.
  const all =
    value !== undefined && !known.some((option) => option.value === value)
      ? [{ value, label: value }, ...known]
      : known;
  const searchable = all.length > SEARCH_THRESHOLD;
  const shown = filter ? all.filter((option) => option.label.toLowerCase().includes(filter.toLowerCase())) : all;
  const display = all.find((option) => option.value === value)?.label;
  return (
    <PopoverBlank
      label={label}
      title={title}
      value={display === undefined ? undefined : sentenceValue(display)}
      need={need}
      readOnly={readOnly}
      dataTestId={dataTestId}
      onClose={() => setFilter('')}
      hint={helperText}
    >
      {(close) => (
        <>
          {searchable && (
            <TextField
              size="small"
              fullWidth
              placeholder="Type to filter…"
              inputProps={{ 'aria-label': `Filter ${label}` }}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && shown[0]) {
                  onChange(shown[0].value);
                  close();
                }
              }}
              sx={{ mb: 0.5 }}
            />
          )}
          <List dense disablePadding role="listbox" aria-label={title ?? label}>
            {shown.map((option) => (
              <ListItemButton
                key={option.value}
                role="option"
                selected={option.value === value}
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
              >
                <ListItemText primary={option.label} />
              </ListItemButton>
            ))}
            {clearable && value !== undefined && (
              <ListItemButton
                role="option"
                onClick={() => {
                  onChange(undefined);
                  close();
                }}
              >
                <ListItemText primary="Clear" primaryTypographyProps={{ color: 'text.secondary' }} />
              </ListItemButton>
            )}
          </List>
        </>
      )}
    </PopoverBlank>
  );
};

interface MultiBlankProps {
  label: string;
  title?: string;
  options: readonly string[] | readonly BlankOption[] | undefined;
  values: readonly string[] | undefined;
  onChange: (values: string[]) => void;
  readOnly: boolean;
  dataTestId?: string;
}

/** Checkbox list with Done; the blank reads "a, b and c" or, when nothing is chosen, "+ label". */
export const MultiBlank: FC<MultiBlankProps> = ({
  label,
  title,
  options,
  values = [],
  onChange,
  readOnly,
  dataTestId,
}) => {
  const known = toOptions(options);
  const all = [
    ...values.filter((v) => !known.some((option) => option.value === v)).map((v) => ({ value: v, label: v })),
    ...known,
  ];
  const display = listText(values.map((v) => sentenceValue(all.find((option) => option.value === v)?.label ?? v)));
  return (
    <PopoverBlank
      label={`+ ${label}`}
      title={title ?? label}
      value={display || undefined}
      ghost
      readOnly={readOnly}
      dataTestId={dataTestId}
    >
      {(close) => (
        <>
          <List dense disablePadding>
            {all.map((option) => {
              const checked = values.includes(option.value);
              return (
                <ListItemButton
                  key={option.value}
                  dense
                  onClick={() =>
                    onChange(checked ? values.filter((v) => v !== option.value) : [...values, option.value])
                  }
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Checkbox
                      edge="start"
                      size="small"
                      checked={checked}
                      tabIndex={-1}
                      disableRipple
                      inputProps={{ 'aria-label': option.label }}
                    />
                  </ListItemIcon>
                  <ListItemText primary={option.label} />
                </ListItemButton>
              );
            })}
          </List>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 0.5 }}>
            <Button size="small" onClick={close}>
              Done
            </Button>
          </Box>
        </>
      )}
    </PopoverBlank>
  );
};

const inlineInputSx = (theme: Theme, empty: boolean, need: boolean): Record<string, unknown> => ({
  font: 'inherit',
  lineHeight: 'inherit',
  borderRadius: '3px',
  padding: 0,
  '& input': {
    padding: '1px 4px',
    height: 'auto',
    font: 'inherit',
    color: VALUE_COLOR,
    fontWeight: 500,
    ...(empty ? emptySx(theme, need) : { backgroundColor: alpha(TINT_COLOR, 0.06) }),
    '&::placeholder': { color: need ? NEED_COLOR : theme.palette.text.secondary, opacity: 1, fontWeight: 400 },
    '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
  },
});

/** Numbers sit centred with the browser's spin buttons removed, so "5" and "#" are as tight as text. */
const numberInputSx: Record<string, unknown> = {
  textAlign: 'center',
  MozAppearance: 'textfield',
  '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
};

/** "Length (cm)" → "cm", otherwise "#": a number box is too narrow for its full label, which stays as
 * the accessible name and tooltip. */
const numberPlaceholder = (label: string): string => /\(([^)]+)\)/.exec(label)?.[1] ?? '#';

interface TextBlankProps {
  label: string;
  /** Shorter text shown in the empty box; the label stays the accessible name and tooltip. */
  placeholder?: string;
  kind?: 'text' | 'number' | 'time';
  value: string | number | undefined;
  onChange: (raw: string) => void;
  readOnly: boolean;
  need?: boolean;
  min?: number;
  step?: number;
  width?: string;
  dataTestId?: string;
}

/** Borderless input that sits in the sentence: numbers, clock times and short free text. */
export const TextBlank: FC<TextBlankProps> = ({
  label,
  placeholder: placeholderProp,
  kind = 'text',
  value,
  onChange,
  readOnly,
  need,
  min,
  step,
  width,
  dataTestId,
}) => {
  const text = value === undefined ? '' : String(value);
  if (readOnly) {
    return (
      <Box component="span" sx={text ? { ...filledSx(), '&:hover': {} } : { color: 'text.secondary' }}>
        {text || `[${label}]`}
      </Box>
    );
  }
  const placeholder = placeholderProp ?? (kind === 'number' ? numberPlaceholder(label) : label);
  return (
    <InputBase
      type={kind}
      value={text}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      inputProps={{
        'aria-label': label,
        'data-testid': dataTestId,
        title: placeholder === label ? undefined : label,
        // Chrome's form-history dropdown would look like an app popover inside a sentence.
        autoComplete: 'off',
        ...(kind === 'number' ? { min, step: step ?? 1, inputMode: 'decimal' } : {}),
      }}
      sx={(theme) => {
        const inline = inlineInputSx(theme, text === '', need ?? false);
        return {
          ...inline,
          // One input style for every kind; the number tweaks are merged in, not swapped in.
          '& input': { ...(inline['& input'] as Record<string, unknown>), ...(kind === 'number' ? numberInputSx : {}) },
          maxWidth: '100%',
          // The box hugs its content: the placeholder at first, then whatever is typed.
          width: kind === 'time' ? 'auto' : width ?? `calc(${Math.max(placeholder.length, text.length) + 1}ch + 8px)`,
        };
      }}
    />
  );
};

interface DateTimeBlankProps {
  kind: 'date' | 'time';
  label: string;
  value: DateTime | null | undefined;
  onChange: (value: DateTime | null) => void;
  readOnly: boolean;
  dataTestId?: string;
}

/** The existing MUI pickers, restyled as inline blanks so date/time semantics stay exactly as before. */
export const DateTimeBlank: FC<DateTimeBlankProps> = ({ kind, label, value, onChange, readOnly, dataTestId }) => {
  const display = value?.isValid
    ? kind === 'date'
      ? value.toLocaleString(DateTime.DATE_MED)
      : value.toLocaleString(DateTime.TIME_SIMPLE)
    : undefined;
  if (readOnly) {
    return (
      <Box component="span" sx={display ? { ...filledSx(), '&:hover': {} } : { color: 'text.secondary' }}>
        {display ?? `[${label}]`}
      </Box>
    );
  }
  const Picker = kind === 'date' ? DatePicker : TimePicker;
  return (
    <LocalizationProvider dateAdapter={AdapterLuxon}>
      <Picker
        value={value ?? null}
        onChange={(next: DateTime | null) => onChange(next)}
        slotProps={{
          textField: {
            variant: 'standard',
            InputProps: { disableUnderline: true },
            inputProps: { 'aria-label': label, 'data-testid': dataTestId, placeholder: label },
            sx: (theme) => {
              const inline = inlineInputSx(theme, !display, false);
              return {
                // Input and icon share one shrink-wrapped inline box, so the icon never spills over the
                // words after it; the margin is the visible gap before them.
                display: 'inline-flex',
                width: 'auto',
                verticalAlign: 'baseline',
                mr: '0.35em',
                '& .MuiInputBase-root': { font: 'inherit', lineHeight: 'inherit', width: 'auto' },
                ...inline,
                '& input': {
                  ...(inline['& input'] as Record<string, unknown>),
                  flex: 'none',
                  minWidth: 0,
                  width: display ? (kind === 'date' ? '11ch' : '8ch') : `${label.length}ch`,
                },
                '& .MuiInputAdornment-root': { ml: 0, flex: 'none', height: 'auto' },
                // MuiIconButton-edgeEnd sets margin-right: -12px, which pushed the icon over the next word.
                '& .MuiInputAdornment-root button': { padding: '2px', mr: 0 },
                '& .MuiInputAdornment-root svg': { fontSize: 18 },
              };
            },
          },
        }}
      />
    </LocalizationProvider>
  );
};

interface SentenceProps {
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  dataTestId?: string;
}

/** U+2060 WORD JOINER: no line break on either side, and it takes no space. */
const JOIN = '\u2060';

/** Inputs and pickers are atomic inlines: browsers may still break right after them, joiner or not, so
 * those blanks and their punctuation share a no-break wrapper. Text blanks keep wrapping internally. */
const isAtomicBlank = (node: ReactNode): boolean =>
  isValidElement(node) && (node.type === TextBlank || node.type === DateTimeBlank);

/** Flattens fragments and keeps punctuation with its blank: a trailing ". " or ")" is joined to the
 * blank before it and an opening "(" to the blank after it, so a line never starts with a full stop or
 * ends with a stranded bracket. The values themselves still wrap like text. Every element gets the same
 * wrapper and a key from its slot position (empty slots included), so a blank keeps its identity, and
 * its open popover, when a neighbouring conditional text appears. */
function attachPunctuation(children: ReactNode): ReactNode[] {
  const slots: Array<string | { key: string; element: ReactNode; prefix: string; suffix: string }> = [];
  const visit = (node: ReactNode, key: string): void => {
    if (node == null || typeof node === 'boolean') return;
    // Numbers ("Administration 1") are text as well.
    if (typeof node === 'number') {
      slots.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((child, index) => visit(child, `${key}.${index}`));
      return;
    }
    if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) {
      visit(node.props.children, `${key}.${node.key ?? 'f'}`);
      return;
    }
    const previous = slots[slots.length - 1];
    if (isValidElement(node)) {
      const opening = typeof previous === 'string' ? /^([\s\S]*?)([([]+)$/.exec(previous) : null;
      if (opening) {
        if (opening[1]) slots[slots.length - 1] = opening[1];
        else slots.pop();
      }
      slots.push({ key: String(node.key ?? key), element: node, prefix: opening?.[2] ?? '', suffix: '' });
      return;
    }
    const closing = typeof node === 'string' ? /^([.,;:)\]]+)([\s\S]*)$/.exec(node) : null;
    if (closing && previous !== undefined && typeof previous !== 'string') {
      previous.suffix += closing[1];
      if (closing[2]) slots.push(closing[2]);
      return;
    }
    slots.push(node as string);
  };
  visit(children, 's');
  return slots.map((slot) =>
    typeof slot === 'string' ? (
      slot
    ) : (
      <Box component="span" key={slot.key} sx={isAtomicBlank(slot.element) ? { whiteSpace: 'nowrap' } : undefined}>
        {/* A hair of space so brackets don't touch an empty blank's dashed outline. */}
        {slot.prefix && (
          <Box component="span" sx={{ mr: '2px' }}>
            {`${slot.prefix}${JOIN}`}
          </Box>
        )}
        {slot.element}
        {slot.suffix && (
          <Box component="span" sx={/^[)\]]/.test(slot.suffix) ? { ml: '2px' } : undefined}>
            {`${JOIN}${slot.suffix}`}
          </Box>
        )}
      </Box>
    )
  );
}

export const Sentence: FC<SentenceProps> = ({ children, onRemove, removeLabel, dataTestId }) => (
  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }} data-testid={dataTestId}>
    <Typography component="div" sx={{ ...SENTENCE_SX, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
      {attachPunctuation(children)}
    </Typography>
    {onRemove && (
      <IconButton size="small" aria-label={removeLabel ?? 'Remove this line'} onClick={onRemove} sx={{ mt: '2px' }}>
        <Close fontSize="small" />
      </IconButton>
    )}
  </Box>
);

export const SectionLabel: FC<{ children: ReactNode }> = ({ children }) => (
  <Typography
    component="h3"
    sx={{
      fontSize: '12px',
      fontWeight: 500,
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
      color: '#0F347C',
      // The card stacks children 12px apart; padding adds 18px above a label (30px from the previous
      // sentence) and the negative margin pulls its first sentence up to 6px.
      pt: '18px',
      mb: '-6px',
    }}
  >
    {children}
  </Typography>
);
