import { Theme } from '@mui/material/styles';
import { Variant } from '@mui/material/styles/createTypography';

/** Every size of text in the panel, over the note's: the narrow column reads better one step larger. */
export const SCRIBE_TEXT_SCALE = 1.15;

/** A pixel size the panel's own components state outright, at the panel's scale. */
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
 * The outer theme with its type scaled up. The EHR theme fixes every variant in px, so `typography.fontSize`
 * (which only feeds `pxToRem`) can't do it: each variant is rescaled here, and `pxToRem` with it, so the
 * sizes MUI derives from that — chip and small-button labels, tooltips, the checkbox glyph — follow.
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
  };
};
