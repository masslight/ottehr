import { FC, ReactNode } from 'react';
import { BreakpointsOptions, Components, createTheme, PaletteColor, ThemeProvider } from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';

export const textFonts = ['Work Sans'];
export const headerFonts = ['Work Sans'];

export const breakpoints: BreakpointsOptions = {
  values: {
    xs: 0,
    sm: 400,
    md: 700,
    lg: 1000,
    xl: 1400,
  },
};

export const otherColors = {
  appointmentInfoBackground: '#8F66EF',
  background: '#5324BE',
  borderGray: '#D6D8DF',
  borderLightBlue: '#4294F3',
  checkIcon: '#7045F2',
  clearImage: '#EB5757',
  coachingVisit: '#EDE8FF',
  lightBlue: '#CFF5FF',
  darkPurple: '#301367',
  darkGreen: '#0F5A4C',
  lightGreen: '#C1FBEA',
  purple: '#4D15B7',
  brown: '#604203',
  lightPurple: '#F5F2FF',
  languageIcon: 'rgba(15, 229, 189, 1)',
  lightblue: '#ECF5FF',
  lightGray: '#CED4DA',
  placeholder: '#A9A9A9',
  primaryBackground: '#F5F2FF',
  popupBackground: 'rgba(97, 97, 97, 0.9)',
  primaryBoxShadow: 'rgba(77, 21, 183, 0.25)',
  scheduleBorder: '#8F9AA7',
  translateIcon: '#0FE5BD',
  transparent: 'rgba(0, 0, 0, 0)',
  patientGreen: '#C7FDD3',
  patientSubtitle: '#545454',
  wrongPatient: '#8F9AA7',
  cardBackground: '#F7F8F9',
  footerBackground: '#202A3E',
  darkBackgroundPaper: '#263954',
};

export const typography: TypographyOptions = {
  fontFamily: textFonts.join(','),
  fontWeightMedium: 600,
  h1: {
    fontSize: 34,
    fontWeight: '500 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  h2: {
    fontSize: 26,
    fontWeight: '500 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  h3: {
    fontSize: 20,
    fontWeight: '600 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  h4: {
    fontSize: 34,
    fontWeight: '500 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  h5: {
    fontSize: 24,
    fontWeight: '500 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  h6: {
    fontSize: 16,
    fontWeight: '500 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  subtitle1: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: textFonts.join(','),
    lineHeight: '140%',
  },
  subtitle2: {
    fontSize: 14,
    fontWeight: 700,
    fontFamily: textFonts.join(','),
    lineHeight: '140%',
  },
  body1: {
    fontSize: 16,
    fontWeight: 400,
    fontFamily: textFonts.join(','),
    lineHeight: '140%',
  },
  body2: {
    fontSize: 14,
    fontWeight: 400,
    fontFamily: textFonts.join(','),
    lineHeight: '140%',
  },
  button: {},
  caption: {
    fontSize: 14,
    fontWeight: 400,
    fontFamily: textFonts.join(','),
    lineHeight: '140%',
  },
  overline: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: textFonts.join(','),
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
  text: {
    primary: '#212130',
    secondary: '#4F4F4F',
    light: '#323F53DE',
    disabled: '#C3C9D2',
  },
  primary: {
    main: '#2896C6',
    contrast: '#FFFFFF',
    light: '#4AC0F2',
  },
  secondary: {
    main: '#301367',
    contrast: '#FFFFFF',
  },
  tertiary: p.augmentColor({ color: { main: '#ECE4FB' } }),
  step: {
    main: '#17C4F3',
  },
  info: {
    main: '#C1FBEA',
  },
  success: {
    main: '#66BA70',
  },
  warning: {
    main: '#FFDF9A',
  },
  error: {
    main: '#EC6930',
  },
  action: {
    active: 'rgba(0, 0, 0, 0.54)',
    hover: 'rgba(0, 0, 0, 0.04)',
    selected: 'rgba(0, 0, 0, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)',
    focus: 'rgba(0, 0, 0, 0.12)',
  },
  background: {
    default: '#FFFFFF',
    paper: '#FFFFFF',
  },
  divider: '#C3C9D2',
};

export const components: Components = {
  MuiButton: {
    styleOverrides: {
      root: {
        fontSize: 14,
        fontWeight: 600,
        fontFamily: textFonts.join(','),
        textTransform: 'uppercase',
        lineHeight: '140%',
        '&:not($sizeLarge):not($sizeSmall) $label': {
          fontSize: 16,
        },
        // borderRadius: 49,
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
          fontSize: 16,
          '&.MuiPickersDay-today': {
            borderColor: palette.secondary.main,
          },
          '&.Mui-selected': {
            backgroundColor: palette.secondary.main,
          },
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
        textTransform: 'capitalize',
        fontSize: 16,
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
          fontSize: 16,
          color: otherColors.scheduleBorder,
        },
        '&.PrivatePickersMonth-root:disabled': {
          color: palette.text.disabled,
        },
      },
    },
  },
};

interface IntakeThemeProviderProps {
  children: ReactNode;
}

export const IntakeThemeProvider: FC<IntakeThemeProviderProps> = ({ children }) => {
  const theme = createTheme({
    palette: palette,
    components: components,
    direction: 'ltr',
    breakpoints: breakpoints,
    typography: typography,
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
