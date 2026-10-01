import { Box, InputBase, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  ekgQtc,
  ekgQtcMethod,
  QTC_METHODS,
  QtcMethod,
  withEkgQtc,
} from 'utils/lib/procedure-coding/families/ekg-interpretation';
import { ProcedureFamilyModel } from 'utils/lib/procedure-coding/model.types';
import { readNumber, StructuredFacts } from 'utils/lib/procedure-coding/structured-fields';
import { CodingFieldSentences } from './CodingFieldSentences';
import { Sentence } from './InlineBlanks';

/** The measurement tiles, in printout order; `qtc` is calculated unless the method is manual. */
const TILES = [
  { key: 'rate', label: 'Rate', unit: 'bpm' },
  { key: 'pr', label: 'PR', unit: 'ms' },
  { key: 'qrs', label: 'QRS', unit: 'ms' },
  { key: 'qt', label: 'QT', unit: 'ms' },
  { key: 'qtc', label: 'QTc', unit: 'ms' },
  { key: 'axisDegrees', label: 'Axis', unit: '°' },
] as const;

/** The interpretation sentence, in the order a read is spoken. */
const INTERPRETATION_KEYS = ['rhythm', 'axis', 'conduction', 'stt', 'otherFindings', 'comparison', 'impression'];

interface TilesProps {
  facts: StructuredFacts;
  readOnly: boolean;
  update: (next: StructuredFacts) => void;
}

/** Big plain numbers as on the printout: no flags or ranges, the reminders below speak to the interpretation. */
const EkgMeasurementTiles: FC<TilesProps> = ({ facts, readOnly, update }) => {
  const method = ekgQtcMethod(facts);
  const qtc = ekgQtc(facts);
  const setNumber = (key: string, raw: string): void => {
    const number = raw === '' ? undefined : Number(raw);
    // Typing a QTc makes it a manual value; any other tile keeps a calculated QTc in step.
    update(key === 'qtc' ? { ...facts, qtc: number, qtcMethod: 'manual' } : withEkgQtc({ ...facts, [key]: number }));
  };
  const setMethod = (next: QtcMethod | null): void => {
    if (!next) return;
    // Manual starts from the value on screen; a calculated method recomputes it.
    update(next === 'manual' ? { ...facts, qtcMethod: next, qtc } : withEkgQtc({ ...facts, qtcMethod: next }));
  };
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
      data-testid={dataTestIds.documentProcedurePage.ekgTiles}
    >
      {TILES.map(({ key, label, unit }) => {
        const value = key === 'qtc' ? qtc : readNumber(facts, key);
        return (
          <Box
            key={key}
            sx={{ px: 1.75, py: 1, borderRight: 1, borderColor: 'divider', '&:last-child': { borderRight: 0 } }}
            data-testid={dataTestIds.documentProcedurePage.ekgTile(key)}
          >
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'text.secondary',
              }}
            >
              {label}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
              {readOnly ? (
                <Typography sx={{ fontSize: 20, fontWeight: 500 }}>{value ?? '—'}</Typography>
              ) : (
                <InputBase
                  type="number"
                  value={value ?? ''}
                  placeholder="—"
                  onChange={(event) => setNumber(key, event.target.value)}
                  inputProps={{
                    'aria-label': `${label} (${unit})`,
                    inputMode: 'numeric',
                    min: key === 'axisDegrees' ? -180 : 0,
                    step: 1,
                    autoComplete: 'off',
                  }}
                  sx={(theme) => ({
                    width: '3.2em',
                    '& input': {
                      font: `500 20px ${theme.typography.fontFamily}`,
                      fontVariantNumeric: 'tabular-nums',
                      padding: 0,
                      borderBottom: '1px dashed transparent',
                      '&:hover': { borderBottomColor: 'rgba(0, 0, 0, 0.3)' },
                      // Empty tiles get the same orange underline so the row reads as something to fill in.
                      '&:placeholder-shown': { borderBottomColor: theme.palette.warning.main },
                      MozAppearance: 'textfield',
                      '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { WebkitAppearance: 'none', m: 0 },
                    },
                  })}
                />
              )}
              <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                {unit}
              </Typography>
            </Box>
            {key === 'qtc' && (!readOnly || value !== undefined) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: '2px' }}>
                {!readOnly && (
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={method}
                    onChange={(_event, next: QtcMethod | null) => setMethod(next)}
                    aria-label="QTc method"
                    data-testid={dataTestIds.documentProcedurePage.ekgQtcMethod}
                    sx={{
                      '& .MuiToggleButton-root': {
                        px: 0.5,
                        py: 0,
                        minWidth: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: '16px',
                        textTransform: 'none',
                      },
                    }}
                  >
                    {QTC_METHODS.map((option) => (
                      <ToggleButton key={option} value={option} aria-label={option} title={option}>
                        {option[0].toUpperCase()}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                )}
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{method}</Typography>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

interface Props {
  family: ProcedureFamilyModel;
  value: StructuredFacts;
  onChange: (value: StructuredFacts) => void;
  readOnly: boolean;
  /** Under 18 the adult cut-offs don't apply: only the normal read is suggested and no reminders are shown. */
  isChild: boolean;
}

/** The EKG family's fields: the billing sentence, the measurement tiles, then the interpretation sentence. */
export const EkgSentences: FC<Props> = ({ isChild: _isChild, ...props }) => (
  <CodingFieldSentences
    {...props}
    renderMain={({ answers, readOnly, pieces, details, update }) => (
      <>
        <Sentence>
          {pieces(['component', 'count'])}. {details(INTERPRETATION_KEYS)}
        </Sentence>
        <EkgMeasurementTiles facts={answers} readOnly={readOnly} update={update} />
        <Sentence>{pieces(INTERPRETATION_KEYS, { ordered: true })}.</Sentence>
      </>
    )}
  />
);
