import { Box, Typography } from '@mui/material';
import { FC, ReactNode } from 'react';
import { DoseCalculatorCard } from './DoseCalculatorCard';
import { ErxSuggestionsBox } from './ErxSuggestionsBox';
import { CALCULATOR_LOOKS, SUGGESTION_LOOKS } from './sampleLooks';

/** Local-only page (/erx-looks) showing every suggestions-box and dose-calculator look with sample props, including
 * the looks the order form can't reach without dosing data. */

const Look: FC<{ tag: string; title: string; children: ReactNode }> = ({ tag, title, children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, maxWidth: 340 }}>
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
            ) : (
              <ErxSuggestionsBox {...props} />
            )}
          </Look>
        ))}
      </Section>
      <Section title="Dose calculator">
        {CALCULATOR_LOOKS.map(({ tag, title, props }) => (
          <Look key={title} tag={tag} title={title}>
            <DoseCalculatorCard {...props} />
          </Look>
        ))}
      </Section>
    </Box>
  </Box>
);

export default ErxLooksPreview;
