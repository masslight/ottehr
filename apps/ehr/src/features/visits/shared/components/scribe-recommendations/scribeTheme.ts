import { Theme } from '@mui/material/styles';
import { Variant } from '@mui/material/styles/createTypography';

/** Panel text size relative to the note's; the narrow column reads better one step larger. */
const SCRIBE_TEXT_SCALE = 1.15;

/** Scales a hard-coded pixel size to the panel's text scale. */
export const scaled = (px: number): number => px * SCRIBE_TEXT_SCALE;

/** RoundedButton fixes its label at 14px in its own styles, which the theme can't reach. */
export const roundedButtonSx = { fontSize: scaled(14) };

const VARIANTS: Variant[] = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'subtitle1',
  'subtitle2',
  'body1',
  'body2',
  'button',
  'caption',
  'overline',
];

const scaleFontSize = (fontSize: string | number | undefined): string | number | undefined => {
  if (typeof fontSize === 'number') return scaled(fontSize);
  const match = /^([\d.]+)(px|rem|em)$/.exec(fontSize ?? '');
  return match ? `${Number(match[1]) * SCRIBE_TEXT_SCALE}${match[2]}` : fontSize;
};

/**
 * The outer theme with its type scaled up. The EHR theme fixes every variant in px, so each variant is rescaled
 * here, along with `pxToRem` so MUI's derived sizes (chips, tooltips, checkbox glyphs) follow.
 */
export const scaleScribeTheme = (outer: Theme): Theme => {
  const { typography } = outer;
  const variants = Object.fromEntries(
    VARIANTS.map((variant) => [
      variant,
      { ...typography[variant], fontSize: scaleFontSize(typography[variant].fontSize) },
    ])
  ) as Pick<Theme['typography'], Variant>;
  return {
    ...outer,
    typography: {
      ...typography,
      ...variants,
      fontSize: scaled(typography.fontSize),
      pxToRem: (px) => typography.pxToRem(scaled(px)),
    },
    components: {
      ...outer.components,
      // Hover provenance reads at the panel's body size, in a box wide enough for a transcript passage.
      MuiTooltip: {
        styleOverrides: { tooltip: { maxWidth: 480, '& .MuiTypography-caption': { fontSize: scaled(14) } } },
      },
    },
  };
};
