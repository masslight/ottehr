import { otherColors } from '@ehrTheme/colors';
import { InfoOutlined } from '@mui/icons-material';
import { Box, Button, InputBase, Link, SxProps, Theme, Tooltip } from '@mui/material';
import { FC, ReactNode } from 'react';
import { BlankOption, SelectBlank, TextBlank } from '../procedures/narrative/InlineBlanks';

/**
 * The dose calculator that opens under a prescription line from the icon beside its dose blank, as looks only: every
 * string and number comes in ready to show, and every change goes out through a callback. Which look shows is
 * `display.look`.
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
  /** Where the value is from: "this visit", "from the product", "(low end of the range 80–90 mg/kg/day)". */
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
  /** "= 750 mg • 1500 mg/day". */
  detail?: string;
  /** Under the sentence, in orange text: "Capped at the 500 mg maximum (703 mg by weight)". */
  capNote?: string;
}

/** One line of a band, course or pack: "Day 1: **7 mL** once daily (10 mg/kg)". */
export interface DoseStepLine {
  label: string;
  amount: string;
  rest?: string;
}

export type DoseCalculatorDisplay =
  | { look: 'byWeight' | 'own'; fields: DoseField[]; result: DoseResult }
  /** A chart: the patient's band in bold, the others dimmed. */
  | { look: 'band'; weight?: string; bands: DoseStepLine[]; current?: number; result: DoseResult }
  | { look: 'fixed'; fields?: DoseField[]; result: DoseResult }
  | { look: 'course'; fields?: DoseField[]; steps?: DoseStepLine[]; result: DoseResult }
  | { look: 'pack'; steps: DoseStepLine[]; result: DoseResult }
  | { look: 'waiting'; fields?: DoseField[]; message: string }
  | { look: 'noDose'; reason: string };

export interface DoseWarningBox {
  /** Red (contraindicated) or orange (a caution, in the source's words). */
  severity: 'error' | 'warning';
  lines: string[];
  /** Behind an ⓘ after the lines: where the warning's limit is from. */
  info?: ReactNode[];
}

export interface DoseSourceLine {
  label: string;
  href?: string;
  /** After the source: "max 2 g/dose". */
  extra?: string;
}

export interface DoseCalculatorCardProps {
  display: DoseCalculatorDisplay;
  /** The regimen (or product) picker on top; "Enter my own" is its last option. */
  picker?: { title: string; options: string[]; value?: string; onChange: (value: string | undefined) => void };
  warnings?: DoseWarningBox[];
  source?: DoseSourceLine;
  onFieldChange?: (id: string, value: string) => void;
  onChoiceChange?: (id: string, value: string) => void;
  /** "Use this dose"; never offered while waiting or with no dose. */
  onUse?: () => void;
  readOnly?: boolean;
}

/** The panel's colors, from the calculator mockup. */
const PANEL = { background: '#F3F6FA', edge: '#C9D6E6', display: '#E8F0FA', displayEdge: '#9DB8DA' };
const MONO = "'Roboto Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const NOTE_SX = { color: 'text.secondary', fontSize: 13 };
const HEADING_SX = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: 'text.secondary' };
const SMALL_SX = { fontSize: 13, color: 'text.secondary', lineHeight: 1.5 };

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
  readOnly: boolean;
  onFieldChange?: (id: string, value: string) => void;
  onChoiceChange?: (id: string, value: string) => void;
}> = ({ fields, readOnly, onFieldChange, onChoiceChange }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '6px 10px', alignItems: 'center' }}>
    {fields.map((field) => (
      <Box key={field.id} sx={{ display: 'contents' }}>
        <Box component="span" sx={{ color: 'text.secondary' }}>
          {field.label}
        </Box>
        <FieldBox sx={field.disabled ? { backgroundColor: 'action.disabledBackground' } : undefined}>
          {field.value === undefined ? null : field.disabled && !readOnly ? (
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
              readOnly={readOnly}
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
              readOnly={readOnly}
            />
          )}
          {field.from && (
            <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
              {field.from}
            </Box>
          )}
          {field.action && !readOnly && (
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
  const notes = [result.roundingNote, result.working, result.detail].filter((note): note is string => !!note);
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

const StepLines: FC<{ steps: DoseStepLine[] }> = ({ steps }) => (
  <Box component="ul" sx={{ m: 0, pl: 2.25, lineHeight: 1.55 }}>
    {steps.map((step) => (
      <li key={step.label}>
        {step.label}:{' '}
        <Box component="b" sx={{ fontWeight: 500, color: 'primary.dark' }}>
          {step.amount}
        </Box>
        {step.rest && ` ${step.rest}`}
      </li>
    ))}
  </Box>
);

/** The red and orange boxes: the calculator's, and the line's maximum warnings under its dose sentence. */
export const DoseWarningBoxes: FC<{ warnings: DoseWarningBox[] }> = ({ warnings }) => (
  <>
    {warnings.map(({ severity, lines, info }, i) => {
      const red = severity === 'error';
      return (
        <Box
          key={i}
          data-testid={`dose-warnings-${severity}`}
          sx={{
            borderLeft: 4,
            borderColor: red ? 'error.main' : 'warning.main',
            backgroundColor: red ? '#FDEDED' : '#FFF4E5',
            color: red ? '#5F2120' : otherColors.warningText,
            borderRadius: 1,
            px: 1.5,
            py: 1,
            fontSize: 13,
          }}
        >
          {lines.length === 1 ? (
            lines[0]
          ) : (
            <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </Box>
          )}
          {info?.length ? (
            <DoseInfoHover label="Where this maximum is from" lines={info} testId="warning-info" />
          ) : null}
        </Box>
      );
    })}
  </>
);

/** The body for each look: inputs, a band or steps, the result, or a message instead of a dose. */
const LookBody: FC<{
  display: DoseCalculatorDisplay;
  readOnly: boolean;
  onFieldChange?: (id: string, value: string) => void;
  onChoiceChange?: (id: string, value: string) => void;
}> = ({ display, ...fieldProps }) => {
  switch (display.look) {
    case 'byWeight':
    case 'own':
      return (
        <>
          <Fields fields={display.fields} {...fieldProps} />
          <ResultDisplay result={display.result} />
        </>
      );
    case 'band':
      return (
        <>
          {display.weight && (
            <Box component="span" sx={HEADING_SX}>
              {display.weight}
            </Box>
          )}
          {display.bands.map((band, i) => (
            <FieldBox
              key={band.label}
              sx={{
                display: 'block',
                p: '6px 8px',
                lineHeight: 1.45,
                color: i === display.current ? undefined : 'text.secondary',
              }}
            >
              {band.label}:{' '}
              {i === display.current ? (
                <Box component="b" sx={{ fontWeight: 500, color: 'primary.dark' }}>
                  {band.amount}
                </Box>
              ) : (
                band.amount
              )}
              {band.rest && ` ${band.rest}`}
            </FieldBox>
          ))}
          <ResultDisplay result={display.result} />
        </>
      );
    case 'fixed':
    case 'course':
      return (
        <>
          {display.fields && <Fields fields={display.fields} {...fieldProps} />}
          {display.look === 'course' && display.steps && <StepLines steps={display.steps} />}
          <ResultDisplay result={display.result} />
        </>
      );
    case 'pack':
      return (
        <>
          <StepLines steps={display.steps} />
          <ResultDisplay result={display.result} />
        </>
      );
    case 'waiting':
      return (
        <>
          {display.fields && <Fields fields={display.fields} {...fieldProps} />}
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
        </>
      );
    case 'noDose':
      return <DoseWarningBoxes warnings={[{ severity: 'warning', lines: [display.reason] }]} />;
  }
};

export const DoseCalculatorCard: FC<DoseCalculatorCardProps> = ({
  display,
  picker,
  warnings = [],
  source,
  onFieldChange,
  onChoiceChange,
  onUse,
  readOnly = false,
}) => {
  const hasDose = display.look !== 'waiting' && display.look !== 'noDose';
  return (
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
              readOnly={readOnly}
              need={!picker.value}
              verbatim
            />
          </FieldBox>
        </Box>
      )}
      <LookBody display={display} readOnly={readOnly} onFieldChange={onFieldChange} onChoiceChange={onChoiceChange} />
      <DoseWarningBoxes warnings={warnings} />
      {source && (
        <Box sx={SMALL_SX} data-testid="dose-sources">
          Source:{' '}
          {source.href ? (
            <Link href={source.href} target="_blank" rel="noopener noreferrer">
              {source.label}
            </Link>
          ) : (
            source.label
          )}
          {source.extra && ` · ${source.extra}`}
        </Box>
      )}
      {hasDose && onUse && !readOnly && (
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
};
