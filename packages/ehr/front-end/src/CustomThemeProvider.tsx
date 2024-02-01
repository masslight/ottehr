import React from 'react';
import { createTheme, ThemeProvider } from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';

const palette = {
  background: {
    default: '#F9FAFB',
    paper: '#FFFFFF',
  },
  primary: {
    main: '#4AC0F2',
    light: '#4AC0F2',
    dark: '#3B98BF',
    contrast: '#FFFFFF',
  },
  secondary: {
    main: '#4294F3',
    light: '#0000009A',
    dark: '#377DCE',
    contrast: '#FFFFFF',
  },
  error: {
    main: '#D32F2F',
    light: '#EF5350',
    dark: '#C62828',
    contrast: '#FFFFFF',
  },
  warning: {
    main: '#FB8C00',
    light: '#FF9800',
    dark: '#E65100',
    contrast: '#FFFFFF',
  },
  info: {
    main: '#0288D1',
    light: '#03A9F4',
    dark: '#01579B',
    contrast: '#FFFFFF',
  },
  success: {
    main: '#2E7D32',
    light: '#4CAF50',
    dark: '#1B5E20',
    contrast: '#FFFFFF',
  },
};

export const otherColors = {
  headerBackground: '#202A3E',
  footerBackground: '#202A3E',
  disabled: 'rgba(0,0,0,0.38)',
  tableRow: 'rgba(0,0,0,0.87)',
  ratingActive: '#FFB400',
  focusRingColor: '#005FCC',
  dottedLine: '#BFC2C6',
  solidLine: '#DFE5E9',
  orange700: '#F57C00',
  orange100: '#FFE0B2',
  locationGeneralBlue: '#CFF5FF',
  insuranceChip: '#43A047',
  consentChip: '#1E88E5',
  cardChip: '#7CB342',
  idChip: '#00ACC1',
  badgeDot: '#FB8C00',
  apptHover: '#F4F6F8',
  warningIcon: '#ED6C02',
  noteText: '#00000099',
  none: '#00000061',
  dialogNote: '#FCD29973',
  selectMenuHover: '#F8F6FC',
  priorityHighText: '#E53935',
  priorityHighIcon: '#F44336',
  zapEHRBlue: '#1BCDFF',
};

const textFonts = ['Work Sans'];
const headerFonts = ['Work Sans'];

const typography: TypographyOptions = {
  fontFamily: textFonts.join(','),
  fontWeightMedium: 500,
  // Headers. Gotta have the "!important" in the fontWeight.
  h1: {
    fontSize: 42,
    fontWeight: '500 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  h2: {
    fontSize: 36,
    fontWeight: '500 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  h3: {
    fontSize: 32,
    fontWeight: '500 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  h4: {
    fontSize: 24,
    fontWeight: '500 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  h5: {
    fontSize: 18,
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
  // Other
  subtitle1: {
    fontSize: 20,
    fontWeight: 700,
    fontFamily: textFonts.join(','),
    lineHeight: '140%',
  },
  subtitle2: {
    fontSize: 12,
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
  caption: {
    fontSize: 12,
    fontWeight: 400,
    fontFamily: textFonts.join(','),
    lineHeight: '140%',
  },
  overline: {
    fontSize: 12,
    fontWeight: 400,
    fontFamily: textFonts.join(','),
    lineHeight: '140%',
  },
};

const theme = createTheme({
  palette: palette,
  typography: typography,
});

export const CustomThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};
