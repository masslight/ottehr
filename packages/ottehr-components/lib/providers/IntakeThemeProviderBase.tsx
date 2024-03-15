import { FC } from 'react';
import { i18n } from 'i18next';
import {
  BreakpointsOptions,
  Components,
  createTheme,
  PaletteColor,
  PaletteOptions,
  ThemeProvider,
} from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';
import { PropsWithChildren } from '../types';
import { IntakeThemeContext } from '../contexts';

export const breakpoints: BreakpointsOptions = {
  values: {
    xs: 0,
    sm: 400,
    md: 700,
    lg: 1000,
    xl: 1400,
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

type IntakeThemeProviderProps = PropsWithChildren & {
  palette: PaletteOptions & {
    secondary: {
      main: string;
    };
    error: {
      main: string;
    };
    text: {
      disabled: string;
    };
  };
  otherColors: Record<string, string>;
  i18n: i18n;
  textFonts?: string[];
  headerFonts?: string[];
  customTypographyOverrides?: TypographyOptions;
  customComponentsOverrides?: Components;
};

export const IntakeThemeProviderBase: FC<IntakeThemeProviderProps> = (props) => {
  const {
    children,
    palette,
    otherColors,
    i18n,
    textFonts = ['Arial', 'Nunito Sans'],
    headerFonts = ['Arial', 'Nunito Sans'],
    customTypographyOverrides,
    customComponentsOverrides,
  } = props;

  const defaultComponentsOverrides: Components = {
    MuiButton: {
      styleOverrides: {
        root: {
          fontSize: 16,
          fontWeight: 700,
          fontFamily: textFonts.join(','),
          textTransform: 'none',
          lineHeight: '140%',
          '&:not($sizeLarge):not($sizeSmall) $label': {
            fontSize: 16,
          },
          borderRadius: 50,
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

  const defaultTypographyOverrides: TypographyOptions = {
    fontFamily: textFonts.join(','),
    fontWeightMedium: 600,
    h1: {
      fontSize: 34,
      fontWeight: '500',
      fontFamily: headerFonts.join(','),
      lineHeight: '140%',
    },
    h2: {
      fontSize: 26,
      fontWeight: '500',
      fontFamily: headerFonts.join(','),
      lineHeight: '140%',
    },
    h3: {
      fontSize: 20,
      fontWeight: '500',
      fontFamily: headerFonts.join(','),
      lineHeight: '140%',
    },
    h4: {
      fontSize: 18,
      fontWeight: '500',
      fontFamily: headerFonts.join(','),
      lineHeight: '140%',
    },
    h5: {
      fontSize: 18,
      fontWeight: '500',
      fontFamily: headerFonts.join(','),
      lineHeight: '140%',
    },
    h6: {
      fontSize: 16,
      fontWeight: '500',
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
      fontSize: 16,
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

  const theme = createTheme({
    palette: palette,
    components: { ...defaultComponentsOverrides, ...customComponentsOverrides },
    direction: 'ltr',
    breakpoints: breakpoints,
    typography: { ...defaultTypographyOverrides, ...customTypographyOverrides },
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

  return (
    <ThemeProvider theme={theme}>
      <IntakeThemeContext.Provider value={{ otherColors, i18n }}>{children}</IntakeThemeContext.Provider>
    </ThemeProvider>
  );
};
