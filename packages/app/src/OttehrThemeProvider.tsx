import { BreakpointsOptions, Components, PaletteColor, ThemeProvider, createTheme } from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';
import { FC, ReactNode } from 'react';

export const textFonts = ['Work Sans'];
export const headerFonts = ['Work Sans'];

/* eslint-disable sort-keys -- Sorting by size makes more sense here */
export const breakpoints: BreakpointsOptions = {
  values: {
    xs: 0,
    sm: 400,
    md: 700,
    lg: 1000,
    xl: 1400,
  },
};
/* eslint-enable sort-keys */

export const otherColors = {
  appointmentInfoBackground: '#8F66EF',
  background: '#5324BE',
  bannerGradient: 'linear-gradient(89deg, rgba(40, 160, 198, 0.60) 5.05%, rgba(80, 96, 241, 0.17) 50.42%), #263954',
  biscay: 'rgba(50, 63, 83, 0.87)',
  blackTransparent: 'rgba(0, 0, 0, 0.5)',
  borderGray: '#D6D8DF',
  borderLightBlue: '#C5D5ED',
  brown: '#604203',
  callIconsBackground: 'rgba(255, 255, 255, 0.2)',
  cardBackground: '#F7F8F9',
  checkIcon: '#7045F2',
  clearImage: '#EB5757',
  coachingVisit: '#EDE8FF',
  darkBackgroundPaper: '#263954',
  darkGreen: '#0F5A4C',
  darkPurple: '#301367',
  dashboardGradient: 'linear-gradient(21deg, rgba(40, 150, 198, 0.60) 3.6%, rgba(80, 96, 241, 0.00) 40%), #263954',
  footerBackground: '#202A3E',
  languageIcon: 'rgba(15, 229, 189, 1)',
  lightBlue: '#CFF5FF',
  lightGray: '#CED4DA',
  lightGreen: '#C1FBEA',
  lightPurple: '#F5F2FF',
  patientGreen: '#C7FDD3',
  patientSubtitle: '#545454',
  pattensBlue: '#E5F2F8',
  placeholder: '#A9A9A9',
  popupBackground: 'rgba(97, 97, 97, 0.9)',
  primaryBackground: '#F5F2FF',
  primaryBoxShadow: 'rgba(77, 21, 183, 0.25)',
  purple: '#4D15B7',
  scheduleBorder: '#8F9AA7',
  shamrock: '#3ECCA2',
  translateIcon: '#0FE5BD',
  transparent: 'rgba(0, 0, 0, 0)',
  wrongPatient: '#8F9AA7',
  zapEHRBlue: '#1BCDFF',
};

export const typography: TypographyOptions = {
  body1: {
    fontFamily: textFonts.join(','),
    fontSize: 16,
    fontWeight: 400,
    lineHeight: '140%',
  },
  body2: {
    fontFamily: textFonts.join(','),
    fontSize: 14,
    fontWeight: 400,
    lineHeight: '140%',
  },
  button: {},
  caption: {
    fontFamily: textFonts.join(','),
    fontSize: 14,
    fontWeight: 400,
    lineHeight: '140%',
  },
  fontFamily: textFonts.join(','),
  fontWeightMedium: 600,
  h1: {
    fontFamily: headerFonts.join(','),
    fontSize: 34,
    fontWeight: '500 !important',
    lineHeight: '140%',
  },
  h2: {
    fontFamily: headerFonts.join(','),
    fontSize: 26,
    fontWeight: '500 !important',
    lineHeight: '140%',
  },
  h3: {
    fontFamily: headerFonts.join(','),
    fontSize: 20,
    fontWeight: '600 !important',
    lineHeight: '140%',
  },
  h4: {
    fontFamily: headerFonts.join(','),
    fontSize: 34,
    fontWeight: '500 !important',
    lineHeight: '140%',
  },
  h5: {
    fontFamily: headerFonts.join(','),
    fontSize: 24,
    fontWeight: '500 !important',
    lineHeight: '140%',
  },
  h6: {
    fontFamily: headerFonts.join(','),
    fontSize: 16,
    fontWeight: '500 !important',
    lineHeight: '140%',
  },
  overline: {
    fontFamily: textFonts.join(','),
    fontSize: 16,
    fontWeight: 700,
    lineHeight: '140%',
  },
  subtitle1: {
    fontFamily: textFonts.join(','),
    fontSize: 16,
    fontWeight: 700,
    lineHeight: '140%',
  },
  subtitle2: {
    fontFamily: textFonts.join(','),
    fontSize: 12,
    fontWeight: 400,
    lineHeight: '140%',
  },
};

// https://stackoverflow.com/questions/50069724/how-to-add-custom-mui-palette-colors
declare module '@mui/material/styles' {
  interface Palette {
    tertiary: PaletteColor;
  }
  interface PaletteOptions {
    tertiary: PaletteColor;
  }
}
const { palette: p } = createTheme(); // TODO: once https://github.com/mui/material-ui/issues/17410 is resolved, export directly from mui
export const palette = {
  action: {
    active: 'rgba(0, 0, 0, 0.54)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)',
    focus: 'rgba(0, 0, 0, 0.12)',
    hover: 'rgba(0, 0, 0, 0.04)',
    selected: 'rgba(0, 0, 0, 0.08)',
  },
  background: {
    default: '#FFFFFF',
    paper: '#FFFFFF',
  },
  divider: '#C3C9D2',
  error: {
    main: '#EC6930',
  },
  info: {
    main: '#C1FBEA',
  },
  primary: {
    contrast: '#FFFFFF',
    light: '#4AC0F2',
    main: '#2896C6',
  },
  secondary: {
    contrast: '#FFFFFF',
    main: '#301367',
  },
  step: {
    main: '#17C4F3',
  },
  success: {
    main: '#66BA70',
  },
  tertiary: p.augmentColor({ color: { main: '#ECE4FB' } }),
  text: {
    disabled: '#C3C9D2',
    light: '#323F53DE',
    primary: '#212130',
    secondary: '#4F4F4F',
  },
  warning: {
    main: '#FFDF9A',
  },
};

export const components: Components = {
  MuiButton: {
    styleOverrides: {
      root: {
        '&:not($sizeLarge):not($sizeSmall) $label': {
          fontSize: 16,
        },
        fontFamily: textFonts.join(','),
        fontSize: 14,
        fontWeight: 600,
        lineHeight: '140%',
        textTransform: 'uppercase',
      },
      sizeLarge: {
        '& $label': {
          fontSize: 17,
        },
      },
      sizeSmall: {
        '& $label': {
          fontSize: 15,
        },
      },
    },
  },
  MuiButtonBase: {
    styleOverrides: {
      root: {
        '&.MuiPickersDay-root': {
          '&.Mui-selected': {
            backgroundColor: palette.secondary.main,
          },
          '&.MuiPickersDay-today': {
            borderColor: palette.secondary.main,
          },
          fontSize: 16,
        },
      },
    },
  },
  MuiContainer: {
    styleOverrides: {
      maxWidthMd: {
        '&.MuiContainer-maxWidthMd': {
          maxWidth: 550,
          paddingLeft: 0,
          paddingRight: 0,
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
  MuiInput: {
    styleOverrides: {
      root: {
        fontSize: 16,
      },
    },
  },
  MuiInputBase: {
    styleOverrides: {
      root: {
        '&.Mui-error': {
          '&& .MuiInput-input': {
            borderColor: palette.error.main,
          },
        },
      },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        fontSize: 16,
        textTransform: 'capitalize',
      },
    },
  },
  MuiTabs: {
    styleOverrides: {
      flexContainer: {
        borderBottom: `1px solid ${otherColors.scheduleBorder}`,
        marginBottom: '2.5px',
      },
    },
  },
  MuiTypography: {
    styleOverrides: {
      root: {
        '&.MuiDayPicker-weekDayLabel': {
          color: otherColors.scheduleBorder,
          fontSize: 16,
        },
        '&.PrivatePickersMonth-root:disabled': {
          color: palette.text.disabled,
        },
      },
    },
  },
};

interface OttehrThemeProviderProps {
  children: ReactNode;
}

export const OttehrThemeProvider: FC<OttehrThemeProviderProps> = ({ children }) => {
  const theme = createTheme({
    breakpoints,
    components,
    direction: 'ltr',
    palette,
    typography,
  });

  // https://mui.com/material-ui/customization/typography/#responsive-font-sizes
  theme.typography.h1 = {
    ...theme.typography.h1,
    [theme.breakpoints.down('md')]: {
      fontSize: 28,
    },
  };
  theme.typography.h2 = {
    ...theme.typography.h2,
    [theme.breakpoints.down('md')]: {
      fontSize: 22,
    },
  };

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};
