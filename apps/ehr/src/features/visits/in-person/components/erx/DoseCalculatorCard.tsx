import { otherColors } from '@ehrTheme/colors';
import { InfoOutlined } from '@mui/icons-material';
import { Box, Button, InputBase, Link, SxProps, Theme, Tooltip } from '@mui/material';
import { FC, ReactNode } from 'react';
import { BlankOption, SelectBlank, TextBlank } from '../procedures/narrative/InlineBlanks';

/**
 * The dose calculator that opens under a prescription line from the icon beside its dose blank, as looks only: every
 * string and number comes in ready to show, and every change goes out through a callback. `display.look` says whether
 * it has a dose or waits for an input.
 */

/** One input of the inputs grid: "Weight [28.12] kg this visit". */
export interface DoseField {
  id: string;
  label: string;
  /** None for a field that is only its choice ("Measure to [0.5 mL]"). */
  value?: string;
  unit?: string;
  /** A small pick after the unit, as "mg/kg per [day]". */
  choice?: { title: string; options: BlankOption[]; value: string };
  /** Where the value is from: "previous visit, 10/8/2026", "from twice daily; change the frequency on the line". */
  from?: string;
  /** A link after the note, as "use the vitals weight". */
  action?: { label: string; onClick: () => void };
  /** May stay empty without looking like it's needed (a maximum). */
  optional?: boolean;
  /** Shown greyed out and can't be typed over: the value comes from elsewhere, which `from` names. */
  disabled?: boolean;
}

/** The result: the sentence the line will read once the dose is used, and, behind the ⓘ, how it was worked out. */
export interface DoseResult {
  /** "Take 9 mL by mouth twice daily." */
  sentence: string;
  /** "28.12 kg × 25 mg/kg/dose = 703 mg → 3 capsules = 750 mg". */
  working?: string;
  /** "3 capsules = 750 mg, 47 mg (7%) over 703 mg". */
  roundingNote?: string;
  /** Under the sentence, in orange text: "Capped at the 500 mg maximum (703 mg by weight)". */
  capNote?: string;
}

export type DoseCalculatorDisplay =
  | { look: 'own'; fields: DoseField[]; result: DoseResult }
  | { look: 'waiting'; fields?: DoseField[]; message: string };

export interface DoseCalculatorCardProps {
  display: DoseCalculatorDisplay;
  /** A combination product's "Dose by" picker on top. */
  picker?: { title: string; options: string[]; value?: string; onChange: (value: string | undefined) => void };
  onFieldChange?: (id: string, value: string) => void;
  onChoiceChange?: (id: string, value: string) => void;
  /** "Use this dose"; never offered while waiting. */
  onUse?: () => void;
}

/** The panel's colors, from the calculator mockup. */
const PANEL = { background: '#F3F6FA', edge: '#C9D6E6', display: '#E8F0FA', displayEdge: '#9DB8DA' };
const MONO = "'Roboto Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const NOTE_SX = { color: 'text.secondary', fontSize: 13 };
const HEADING_SX = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: 'text.secondary' };

/** A white box around a blank and its unit and notes; numbers typed in it read in mono. */
const FieldBox: FC<{ children: ReactNode; sx?: SxProps<Theme> }> = ({ children, sx }) => (
  <Box
    sx={[
      {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px',
        minWidth: 0,
        p: '3px 8px',
        backgroundColor: 'common.white',
        border: `1px solid ${PANEL.edge}`,
        borderRadius: '4px',
        '& .MuiInputBase-root input': { fontFamily: MONO },
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    {children}
  </Box>
);

const Fields: FC<{
  fields: DoseField[];
  onFieldChange?: (id: string, value: string) => void;
  onChoiceChange?: (id: string, value: string) => void;
}> = ({ fields, onFieldChange, onChoiceChange }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '6px 10px', alignItems: 'center' }}>
    {fields.map((field) => (
      <Box key={field.id} sx={{ display: 'contents' }}>
        <Box component="span" sx={{ color: 'text.secondary' }}>
          {field.label}
        </Box>
        <FieldBox sx={field.disabled ? { backgroundColor: 'action.disabledBackground' } : undefined}>
          {field.value === undefined ? null : field.disabled ? (
            <InputBase
              type="number"
              value={field.value}
              disabled
              inputProps={{ 'aria-label': field.label.toLowerCase() }}
              sx={{
                fontSize: 'inherit',
                width: `calc(${field.value.length + 1}ch + 8px)`,
                '& input': { p: '1px 2px' },
              }}
            />
          ) : (
            <TextBlank
              label={field.label.toLowerCase()}
              placeholder={field.optional ? 'optional' : '—'}
              kind="number"
              value={field.value}
              onChange={(value) => onFieldChange?.(field.id, value)}
              readOnly={false}
              need={!field.value && !field.optional}
              min={0}
              step={0.1}
            />
          )}
          {field.unit && (
            <Box component="span" sx={NOTE_SX}>
              {field.unit}
            </Box>
          )}
          {field.choice && (
            <SelectBlank
              label={field.choice.title.toLowerCase()}
              title={field.choice.title}
              options={field.choice.options}
              value={field.choice.value}
              onChange={(value) => value && onChoiceChange?.(field.id, value)}
              readOnly={false}
            />
          )}
          {field.from && (
            <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
              {field.from}
            </Box>
          )}
          {field.action && (
            <Link component="button" type="button" sx={{ fontSize: 12 }} onClick={field.action.onClick}>
              {field.action.label}
            </Link>
          )}
        </FieldBox>
      </Box>
    ))}
  </Box>
);

/** "Source: AAP Red Book", the label a link when there is a URL; for a line behind an ⓘ. */
export const SourceText: FC<{ source: { label: string; url?: string } }> = ({ source }) => (
  <>
    Source:{' '}
    {source.url ? (
      <Link href={source.url} target="_blank" rel="noopener noreferrer" sx={{ color: 'inherit' }}>
        {source.label}
      </Link>
    ) : (
      source.label
    )}
  </>
);

/** An ⓘ that shows its lines on hover or focus: the working behind a dose, or how far a re-measured dose is off. A
 * line may hold a link (a source), which the hover stays open to click. */
export const DoseInfoHover: FC<{
  label: string;
  lines: ReactNode[];
  testId?: string;
  /** Sized as a small icon button (16px icon, 2px padding), to sit beside one rather than in a sentence. */
  asButton?: boolean;
}> = ({ label, lines, testId, asButton }) => (
  <Tooltip
    title={
      <Box data-testid={testId} sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </Box>
    }
  >
    <Box
      component="span"
      role="img"
      tabIndex={0}
      aria-label={label}
      sx={{
        display: 'inline-flex',
        color: 'text.secondary',
        flex: 'none',
        ...(asButton ? { p: '2px' } : { verticalAlign: '-3px', mx: '2px' }),
      }}
    >
      <InfoOutlined sx={{ fontSize: asButton ? 16 : 18 }} />
    </Box>
  </Tooltip>
);

const ResultDisplay: FC<{ result: DoseResult }> = ({ result }) => {
  // As the line's and the suggestion rows' ⓘ read: the working, then the rounding note.
  const notes = [result.working, result.roundingNote].filter((note): note is string => !!note);
  return (
    <Box
      data-testid="dose-result"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        p: '8px 10px',
        backgroundColor: PANEL.display,
        border: `1px solid ${PANEL.displayEdge}`,
        borderRadius: '6px',
        fontSize: 15,
        fontWeight: 500,
        color: 'primary.dark',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <Box component="span" data-testid="dose-sentence">
          {result.sentence}
        </Box>
        {result.capNote && (
          <Box
            component="span"
            data-testid="dose-cap"
            sx={{ fontSize: 12.5, fontWeight: 400, color: otherColors.warningText }}
          >
            {result.capNote}
          </Box>
        )}
      </Box>
      {notes.length > 0 && <DoseInfoHover label="How this dose was worked out" lines={notes} testId="dose-working" />}
    </Box>
  );
};

/** The line's maximum warnings under its dose sentence, in orange, each with where its maximum is from behind an ⓘ. */
export const DoseWarningBoxes: FC<{ warnings: string[]; info: ReactNode[] }> = ({ warnings, info }) => (
  <>
    {warnings.map((warning) => (
      <Box
        key={warning}
        data-testid="dose-warnings-warning"
        sx={{
          borderLeft: 4,
          borderColor: 'warning.main',
          backgroundColor: '#FFF4E5',
          color: otherColors.warningText,
          borderRadius: 1,
          px: 1.5,
          py: 1,
          fontSize: 13,
        }}
      >
        {warning}
        {info.length ? <DoseInfoHover label="Where this maximum is from" lines={info} testId="warning-info" /> : null}
      </Box>
    ))}
  </>
);

export const DoseCalculatorCard: FC<DoseCalculatorCardProps> = ({
  display,
  picker,
  onFieldChange,
  onChoiceChange,
  onUse,
}) => (
  <Box
    data-testid="dose-calculator"
    data-look={display.look}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: 340,
      maxWidth: '100%',
      boxSizing: 'border-box',
      p: '12px',
      backgroundColor: PANEL.background,
      border: `1px solid ${PANEL.edge}`,
      borderRadius: '8px',
      fontSize: 14,
    }}
  >
    {picker && (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Box component="span" sx={HEADING_SX}>
          {picker.title}
        </Box>
        <FieldBox sx={{ fontSize: 15, p: '6px 10px' }}>
          <SelectBlank
            label={picker.title.toLowerCase()}
            title={picker.title}
            options={picker.options}
            value={picker.value}
            onChange={picker.onChange}
            readOnly={false}
            need={!picker.value}
            verbatim
          />
        </FieldBox>
      </Box>
    )}
    {display.fields && <Fields fields={display.fields} onFieldChange={onFieldChange} onChoiceChange={onChoiceChange} />}
    {display.look === 'own' ? (
      <ResultDisplay result={display.result} />
    ) : (
      <Box
        sx={{
          color: 'text.secondary',
          backgroundColor: 'common.white',
          border: `1px dashed ${PANEL.edge}`,
          borderRadius: '6px',
          p: '10px 11px',
        }}
      >
        {display.message}
      </Box>
    )}
    {display.look === 'own' && onUse && (
      <Button
        variant="contained"
        disableElevation
        sx={{ alignSelf: 'flex-start', textTransform: 'none', fontSize: 14, p: '6px 14px', borderRadius: '4px' }}
        onClick={onUse}
      >
        Use this dose
      </Button>
    )}
  </Box>
);
