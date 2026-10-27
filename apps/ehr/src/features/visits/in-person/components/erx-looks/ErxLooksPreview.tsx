import { Calculate } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import { FC, ReactNode, useState } from 'react';
import { SelectBlank, Sentence, TextBlank } from '../procedures/narrative/InlineBlanks';
import { DoseCalculatorCard, DoseWarningBoxes, SourceText } from './DoseCalculatorCard';
import { DoseCalculatorPopup } from './DoseCalculatorPopup';
import { ErxSuggestionsBox } from './ErxSuggestionsBox';
import {
  CALCULATOR_LOOKS,
  MAXIMUM_WARNING_LOOKS,
  MaximumWarningLook,
  SampleLook,
  SUGGESTION_LOOKS,
} from './sampleLooks';

/** Local-only page (/erx-looks) showing every suggestions-box and dose-calculator look with sample props, including
 * the looks the order form can't reach without dosing data. */

const Look: FC<{ tag: string; title: string; wide?: boolean; children: ReactNode }> = ({
  tag,
  title,
  wide,
  children,
}) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, maxWidth: wide ? 460 : 340 }}>
    <Typography
      component="span"
      sx={{
        alignSelf: 'flex-start',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        px: 1,
        borderRadius: '10px',
        backgroundColor: '#EEF2F6',
        color: 'primary.dark',
      }}
    >
      {tag}
    </Typography>
    <Typography component="h3" sx={{ fontSize: 16, fontWeight: 500 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const Section: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <Typography component="h2" variant="h5" color="primary.dark">
      {title}
    </Typography>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))',
        gap: 3,
        alignItems: 'start',
      }}
    >
      {children}
    </Box>
  </Box>
);

type LineSample = NonNullable<SampleLook<unknown>['line']>;

/** The prescription line the calculator opens under, as the order form writes it; `icon` is the calculator icon that
 * starts its sentence and `dose` the dose blank. */
const PrescriptionLineSample: FC<{ line: LineSample; icon: ReactNode; dose: ReactNode }> = ({ line, icon, dose }) => (
  <Box sx={{ backgroundColor: 'common.white', border: '1px solid #DFE5E9', borderRadius: '8px', p: 1.75 }}>
    <Sentence>
      <b>Prescription 1:</b>{' '}
      <Box component="span" sx={{ color: 'primary.dark', fontWeight: 500 }}>
        {line.medication}
      </Box>{' '}
      for{' '}
      <Box component="span" sx={{ color: 'text.secondary', border: '1px dashed', px: '4px' }}>
        add diagnosis
      </Box>
      .
    </Sentence>
    <Sentence>
      {icon}Take {dose} {line.unit} {line.rest}
    </Sentence>
  </Box>
);

/** A dose blank you can type in, and the icon that really opens the calculator (Enter my own, sample values). */
const LiveLine: FC = () => {
  const [dose, setDose] = useState('');
  const own = CALCULATOR_LOOKS.find((look) => look.tag === 'Calc 8') ?? CALCULATOR_LOOKS[0];
  return (
    <PrescriptionLineSample
      line={own.line ?? { medication: '', unit: '', rest: '' }}
      icon={
        <DoseCalculatorPopup>
          {(close) => (
            <DoseCalculatorCard
              {...own.props}
              onUse={() => {
                setDose('3');
                close();
              }}
            />
          )}
        </DoseCalculatorPopup>
      }
      dose={
        <TextBlank label="dose" kind="number" value={dose} onChange={setDose} readOnly={false} min={0} step={0.5} />
      }
    />
  );
};

const noop = (): void => undefined;
const AMOXICILLIN_LIQUID_NAME = 'Amoxicillin 400 mg/5 mL';

/** A line over its maximum, as the order form shows it: the blank outlined, the warning under the sentence. */
const MaximumWarningSample: FC<{ look: MaximumWarningLook }> = ({ look }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Box sx={{ backgroundColor: 'common.white', border: '1px solid #DFE5E9', borderRadius: '8px', p: 1.75 }}>
      <Sentence>
        <b>Prescription 1:</b>{' '}
        <Box component="span" sx={{ color: 'primary.dark', fontWeight: 500 }}>
          {AMOXICILLIN_LIQUID_NAME}
        </Box>
        .
      </Sentence>
      <Sentence>
        <CalculatorIcon />
        Take{' '}
        <TextBlank
          label="dose"
          kind="number"
          value={look.dose}
          onChange={noop}
          readOnly={false}
          warn={look.warn === 'dose'}
        />{' '}
        mL by mouth{' '}
        <SelectBlank
          label="frequency"
          options={[look.frequency]}
          value={look.frequency}
          onChange={noop}
          readOnly={false}
          warn={look.warn === 'frequency'}
        />{' '}
        for 10 days.
      </Sentence>
    </Box>
    <DoseWarningBoxes
      warnings={[
        {
          ...look.warning,
          info: [
            ...(look.warning.info ?? []),
            ...(look.source ? [<SourceText key="source" source={look.source} />] : []),
          ],
        },
      ]}
    />
  </Box>
);

/** The icon that starts a suggestion row's sentence, as a look. */
const CalculatorIcon: FC = () => (
  <Box
    component="span"
    sx={{ display: 'inline-flex', verticalAlign: '-3px', p: '2px', mx: '2px', color: 'primary.main' }}
  >
    <Calculate sx={{ fontSize: 18 }} />
  </Box>
);

/** The icon as it looks while its calculator is open. */
const OpenIcon: FC = () => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      verticalAlign: '-3px',
      p: '2px',
      mx: '2px',
      borderRadius: '50%',
      color: 'primary.main',
      backgroundColor: 'action.selected',
    }}
  >
    <Calculate sx={{ fontSize: 18 }} />
  </Box>
);

export const ErxLooksPreview: FC = () => (
  <Box
    sx={{ backgroundColor: 'background.default', minHeight: '100vh', p: 2, display: 'flex', flexDirection: 'column' }}
  >
    <Box sx={{ maxWidth: 1180, width: '100%', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box>
        <Typography component="h1" variant="h4">
          eRx suggestion and calculator looks
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: '72ch' }}>
          Every look with sample props: a 10-year-old, 28.12 kg, unless a look says otherwise. Local only.
        </Typography>
      </Box>
      <Section title="Suggestions box">
        {SUGGESTION_LOOKS.map(({ tag, title, props }) => (
          <Look key={title} tag={tag} title={title}>
            {props.look === 'none' ? (
              <Typography variant="body2" color="text.secondary">
                (Nothing renders: the line opens straight away.)
              </Typography>
            ) : props.look === 'rows' ? (
              // The calculator icon that starts a quick pick row's sentence, here only for its look.
              <ErxSuggestionsBox {...props} renderDoseTool={() => <CalculatorIcon />} />
            ) : (
              <ErxSuggestionsBox {...props} />
            )}
          </Look>
        ))}
      </Section>
      <Section title="Maximum warnings on the line (orange, never block sending)">
        {MAXIMUM_WARNING_LOOKS.map((look) => (
          <Look key={look.title} tag={look.tag} title={look.title} wide>
            <MaximumWarningSample look={look} />
          </Look>
        ))}
      </Section>
      <Section title="Dose calculator: the line with the icon">
        <Look tag="Live" title="Type a dose, or click the icon" wide>
          <LiveLine />
          <Typography variant="body2" color="text.secondary">
            The icon never opens the calculator by itself. Escape, a click away or “Use this dose” closes it.
          </Typography>
        </Look>
      </Section>
      <Section title="Dose calculator looks, inline">
        {CALCULATOR_LOOKS.map(({ tag, title, props, line }) => (
          <Look key={title} tag={tag} title={title} wide>
            {line && (
              <PrescriptionLineSample
                line={line}
                icon={<OpenIcon />}
                dose={
                  <Box component="span" sx={{ border: '1px dashed', borderColor: 'text.secondary', px: '6px' }}>
                    #
                  </Box>
                }
              />
            )}
            <Box sx={{ boxShadow: '0 6px 18px rgba(15,52,124,.16)', borderRadius: '8px', alignSelf: 'flex-start' }}>
              <DoseCalculatorCard {...props} />
            </Box>
          </Look>
        ))}
      </Section>
    </Box>
  </Box>
);

export default ErxLooksPreview;
