import { BreakpointsOptions, Components, createTheme, PaletteOptions, ThemeProvider } from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';
import _ from 'lodash';
import { createContext, FC, PropsWithChildren, useContext } from 'react';
import { BRANDING_CONFIG } from 'utils';

// todo sarah come back to this, i think it might make more sense to just move the intake theme provider up

interface PaperworkPaletteColor {
  main: string;
  dark?: string;
  contrastText?: string;
}

interface PaperworkPaletteOptions {
  text: { primary: string; disabled: string };
  primary: PaperworkPaletteColor;
  secondary: PaperworkPaletteColor;
  error: PaperworkPaletteColor;
  action: { hover: string };
  background: { paper: string };
}

/**
 * Baseline Ottehr palette/colors, mirroring apps/intake/src/themes/ottehr/colors.ts.
 * Trimmed to exactly what the paperwork render tree reads (see SharedPagedQuestionnaire and
 * form-components) rather than the full app palette IntakeThemeProviderBase builds.
 * Overridden below by BRANDING_CONFIG.intake.theme so a branded deployment's paperwork
 * (in either intake or the EHR preview) matches its configured look without either app
 * having to wire anything up.
 */
const DEFAULT_PAPERWORK_PALETTE: PaperworkPaletteOptions = {
  text: {
    primary: '#212130',
    disabled: '#C3C9D2',
  },
  primary: {
    main: '#0F347C',
    dark: '#0A2143',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#2169F5',
    contrastText: '#FFFFFF',
  },
  error: {
    main: '#EC6930',
  },
  action: {
    hover: 'rgba(0, 0, 0, 0.04)',
  },
  background: {
    paper: '#FFFFFF',
  },
};

export interface PaperworkOtherColors {
  toolTipGrey: string;
  black: string;
  scheduleBorder: string;
  purple: string;
  coachingVisit: string;
  clearImage: string;
  cardBackground: string;
  lightGray: string;
  primaryBoxShadow: string;
  lightBlue: string;
  borderGray: string;
}

const DEFAULT_PAPERWORK_OTHER_COLORS: PaperworkOtherColors = {
  toolTipGrey: '#F9FAFB',
  black: '#000000',
  scheduleBorder: '#8F9AA7',
  purple: '#2169F5',
  coachingVisit: '#aed4fc',
  clearImage: '#EB5757',
  cardBackground: '#F7F8F9',
  lightGray: 'rgba(0, 0, 0, 0.23)',
  primaryBoxShadow: 'rgba(77, 21, 183, 0.25)',
  lightBlue: '#E2F0FF',
  borderGray: '#D6D8DF',
};

const paperworkPalette: PaperworkPaletteOptions = _.merge(
  {},
  DEFAULT_PAPERWORK_PALETTE,
  BRANDING_CONFIG.intake.theme?.palette ?? {}
);

const paperworkOtherColors: PaperworkOtherColors = {
  ...DEFAULT_PAPERWORK_OTHER_COLORS,
  ...(BRANDING_CONFIG.intake.theme?.otherColors ?? {}),
};

const breakpoints: BreakpointsOptions = {
  values: {
    xs: 0,
    sm: 400,
    md: 700,
    lg: 1000,
    xl: 1400,
  },
};

const textFonts = ['Rubik', 'sans-serif'];
const headerFonts = ['Rubik', 'sans-serif'];

// Only the component overrides paperwork rendering actually depends on: buttons
// (ControlButtons, the "Button" question type), grid item spacing (every field row), and the
// MUI-X date-picker calendar rendered by DateInput. No app chrome (MuiAppBar), no page layout
// (MuiContainer), no Tabs/standard-variant Input overrides — nothing in this tree uses them.
const paperworkComponentOverrides: Components = {
  MuiButton: {
    styleOverrides: {
      root: {
        fontSize: 16,
        fontWeight: 700,
        fontFamily: textFonts.join(','),
        textTransform: 'none',
        lineHeight: '140%',
        borderRadius: 50,
      },
    },
  },
  MuiButtonBase: {
    styleOverrides: {
      root: {
        '&.MuiPickersDay-root': {
          fontSize: 16,
          '&.MuiPickersDay-today': {
            borderColor: paperworkPalette.secondary?.main,
          },
          '&.Mui-selected': {
            backgroundColor: paperworkPalette.secondary?.main,
          },
        },
      },
    },
  },
  MuiGrid: {
    styleOverrides: {
      root: {
        '&.MuiGrid-item': {
          marginTop: 6,
        },
      },
    },
  },
  MuiTypography: {
    styleOverrides: {
      root: {
        '&.MuiDayPicker-weekDayLabel': {
          fontSize: 16,
          color: paperworkOtherColors.scheduleBorder,
        },
        '&.PrivatePickersMonth-root:disabled': {
          color: paperworkPalette.text?.disabled,
        },
      },
    },
  },
};

// Only the variants actually rendered by SharedPagedQuestionnaire/form-components
// (h2-h5, body1, body2, caption). No h1/h6/subtitle/overline — nothing renders them here.
const paperworkTypographyOverrides: TypographyOptions = {
  fontFamily: textFonts.join(','),
  h2: { fontSize: 26, fontWeight: '600', fontFamily: headerFonts.join(','), lineHeight: '140%' },
  h3: { fontSize: 20, fontWeight: '600', fontFamily: headerFonts.join(','), lineHeight: '140%' },
  h4: { fontSize: 18, fontWeight: '500', fontFamily: headerFonts.join(','), lineHeight: '140%' },
  h5: { fontSize: 18, fontWeight: '500', fontFamily: headerFonts.join(','), lineHeight: '140%' },
  body1: { fontSize: 16, fontWeight: 400, fontFamily: textFonts.join(','), lineHeight: '140%' },
  body2: { fontSize: 14, fontWeight: 400, fontFamily: textFonts.join(','), lineHeight: '140%' },
  caption: { fontSize: 14, fontWeight: 400, fontFamily: textFonts.join(','), lineHeight: '140%' },
};

const paperworkTheme = createTheme({
  palette: paperworkPalette as PaletteOptions,
  components: paperworkComponentOverrides,
  direction: 'ltr',
  breakpoints,
  typography: paperworkTypographyOverrides,
});

// https://mui.com/material-ui/customization/typography/#responsive-font-sizes
// Only h2 needs this: it's the only paperwork heading with a responsive size (PaperworkPageTitle).
paperworkTheme.typography.h2 = {
  ...paperworkTheme.typography.h2,
  [paperworkTheme.breakpoints.down('md')]: { fontSize: 22 },
};

const PaperworkThemeContext = createContext<PaperworkOtherColors>(paperworkOtherColors);

export interface PaperworkThemeProviderProps extends PropsWithChildren {
  /**
   * Override colors. Any keys omitted fall back to the BRANDING_CONFIG-merged defaults above.
   */
  otherColors?: Partial<PaperworkOtherColors>;
}

export const PaperworkThemeProvider: FC<PaperworkThemeProviderProps> = ({ otherColors, children }) => {
  const value = otherColors ? { ...paperworkOtherColors, ...otherColors } : paperworkOtherColors;
  return (
    <ThemeProvider theme={paperworkTheme}>
      <PaperworkThemeContext.Provider value={value}>{children}</PaperworkThemeContext.Provider>
    </ThemeProvider>
  );
};

export const usePaperworkOtherColors = (): PaperworkOtherColors => useContext(PaperworkThemeContext);
