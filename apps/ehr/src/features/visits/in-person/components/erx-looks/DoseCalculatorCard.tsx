import { otherColors } from '@ehrTheme/colors';
import { Box, Button, Link, SxProps, Theme } from '@mui/material';
import { FC, ReactNode } from 'react';
import { SectionHeading } from 'src/features/visits/shared/components/NoteSectionHeading';
import { BlankOption, SelectBlank, TextBlank } from '../procedures/narrative/InlineBlanks';

/**
 * The dose calculator card in the eRx side column, as looks only: every string and number comes in ready to show,
 * and every change goes out through a callback. Which look shows is `display.look`.
 */

/** One input of the inputs grid: "Weight [28.12] kg this visit". */
export interface DoseField {
  id: string;
  label: string;
  value: string;
  unit?: string;
  /** A small pick after the unit, as "mg/kg per [day]". */
  choice?: { title: string; options: BlankOption[]; value: string };
  /** Where the value is from: "this visit", "from the product", "(low end of the range 80–90 mg/kg/day)". */
  from?: string;
  /** A link after the note, as "use the vitals weight". */
  action?: { label: string; onClick: () => void };
}

/** The result display: the big dose, what it comes to and how it was worked out. */
export interface DoseResult {
  /** "14.5 mL", "3 capsules". */
  amount: string;
  /** "twice daily", "per dose". */
  frequency?: string;
  /** "= 750 mg • 1500 mg/day". */
  detail?: string;
  /** "28.12 kg × 25 mg/kg/dose = 703 mg → 3 capsules = 750 mg". */
  working?: string;
  /** "3 capsules = 750 mg, 47 mg (7%) over 703 mg". */
  roundingNote?: string;
}

/** One line of a band, course or pack: "Day 1: **7 mL** once daily (10 mg/kg)". */
export interface DoseStepLine {
  label: string;
  amount: string;
  rest?: string;
}

export type DoseCalculatorDisplay =
  | { look: 'byWeight'; fields: DoseField[]; result: DoseResult }
  | { look: 'band'; band: DoseStepLine; result: DoseResult }
  | { look: 'fixed'; result: DoseResult }
  | { look: 'course'; steps: DoseStepLine[] }
  | { look: 'pack'; steps: DoseStepLine[] }
  | { look: 'waiting'; fields?: DoseField[]; message: string }
  | { look: 'noDose'; reason: string }
  | { look: 'own'; fields: DoseField[]; result: DoseResult };

export interface DoseWarningBox {
  /** Red (contraindicated) or orange (a caution, in the source's words). */
  severity: 'error' | 'warning';
  lines: string[];
}

export interface DoseSourceLine {
  label: string;
  href?: string;
  /** After the source: "max 2 g/dose". */
  extra?: string;
}

export interface DoseCalculatorCardProps {
  display: DoseCalculatorDisplay;
  /** "Prescription 2" when the page has several. */
  label?: string;
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
const SMALL_SX = { fontSize: 13, color: 'text.secondary', lineHeight: 1.5 };

const CalculatorIcon: FC = () => (
  <Box component="svg" viewBox="0 0 24 24" aria-hidden="true" sx={{ width: 20, height: 20, flex: 'none' }}>
    <rect x="4" y="2" width="16" height="20" rx="2" fill="none" stroke="#0F347C" strokeWidth="1.6" />
    <rect x="7" y="5" width="10" height="4" rx="1" fill="#0F347C" />
    <g fill="#0F347C">
      {[13, 17].flatMap((cy) => [8.5, 12, 15.5].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.1" />))}
    </g>
  </Box>
);

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
        <FieldBox>
          <TextBlank
            label={field.label.toLowerCase()}
            placeholder="—"
            kind="number"
            value={field.value}
            onChange={(value) => onFieldChange?.(field.id, value)}
            readOnly={readOnly}
            need={!field.value}
            min={0}
            step={0.1}
          />
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

const ResultDisplay: FC<{ result: DoseResult }> = ({ result }) => (
  <>
    <Box
      data-testid="dose-result"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        p: '10px 12px',
        backgroundColor: PANEL.display,
        border: `1px solid ${PANEL.displayEdge}`,
        borderRadius: '6px',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <Box sx={{ fontSize: 30, fontWeight: 500, color: 'primary.dark', lineHeight: 1.15 }}>
        {result.amount}
        {result.frequency && (
          <Box component="small" sx={{ fontSize: 16, fontWeight: 400, color: 'text.secondary', ml: '4px' }}>
            {result.frequency}
          </Box>
        )}
      </Box>
      {result.detail && <Box sx={{ fontSize: 13, color: 'text.secondary' }}>{result.detail}</Box>}
    </Box>
    {result.working && <Box sx={SMALL_SX}>{result.working}</Box>}
    {result.roundingNote && (
      <Box sx={SMALL_SX} data-testid="dose-rounding-note">
        {result.roundingNote}
      </Box>
    )}
  </>
);

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

const WarningBoxes: FC<{ warnings: DoseWarningBox[] }> = ({ warnings }) => (
  <>
    {warnings.map(({ severity, lines }) => {
      const red = severity === 'error';
      return (
        <Box
          key={severity}
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
          <FieldBox sx={{ display: 'block', p: '6px 8px', lineHeight: 1.45 }}>
            {display.band.label}:{' '}
            <Box component="b" sx={{ fontWeight: 500, color: 'primary.dark' }}>
              {display.band.amount}
            </Box>
            {display.band.rest && ` ${display.band.rest}`}
          </FieldBox>
          <ResultDisplay result={display.result} />
        </>
      );
    case 'fixed':
      return <ResultDisplay result={display.result} />;
    case 'course':
    case 'pack':
      return <StepLines steps={display.steps} />;
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
      return <WarningBoxes warnings={[{ severity: 'warning', lines: [display.reason] }]} />;
  }
};

export const DoseCalculatorCard: FC<DoseCalculatorCardProps> = ({
  display,
  label,
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
        gap: '10px',
        width: '100%',
        boxSizing: 'border-box',
        p: '16px',
        backgroundColor: PANEL.background,
        border: `1px solid ${PANEL.edge}`,
        borderRadius: '8px',
        fontSize: 14,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CalculatorIcon />
        <SectionHeading>Dose calculator{label ? ` · ${label}` : ''}</SectionHeading>
      </Box>
      {picker && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Box
            component="span"
            sx={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: 'text.secondary' }}
          >
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
      <WarningBoxes warnings={warnings} />
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
