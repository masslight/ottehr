import { createTheme, ThemeProvider } from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';
import React from 'react';

const palette = {
  background: {
    default: '#F9FAFB',
    paper: '#FFFFFF',
  },
  primary: {
    main: '#2169F5',
    light: '#2169F5',
    dark: '#0F347C',
    contrast: '#FFFFFF',
  },
  secondary: {
    main: '#FFCD75',
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
  appbarContrast: '#FFCD75',
  apptHover: '#F4F6F8',
  badgeDot: '#FB8C00',
  blackTransparent: 'rgba(0, 0, 0, 0.5)',
  cardChip: '#7CB342',
  closeCross: '#773602CC',
  consentBorder: 'rgba(77, 21, 183, 0.5)',
  consentChip: '#1E88E5',
  dialogNote: '#FCD29973',
  disabled: 'rgba(0,0,0,0.38)',
  dottedLine: '#BFC2C6',
  employeeActiveChip: '#C8E6C9',
  employeeActiveText: '#1B5E20',
  employeeBeenSeenChip: '#D1C4E9',
  employeeBeenSeenText: '#311B92',
  employeeDeactivatedChip: '#FECDD2',
  employeeDeactivatedText: '#B71C1C',
  endCallButton: '#EB5757',
  focusRingColor: '#005FCC',
  formCardBg: '#F7F8F9',
  headerBackground: '#15376a',
  idChip: '#00ACC1',
  infoBackground:
    'linear-gradient(0deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)), linear-gradient(0deg, #0288D1, #0288D1)',
  infoIcon: '#0288D1',
  infoText: 'linear-gradient(0deg, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), linear-gradient(0deg, #0288D1, #0288D1)',
  insuranceChip: '#43A047',
  green700: '#388E3C',
  lightBlue: '#E2F0FF',
  lightDivider: 'rgba(0, 0, 0, 0.12)',
  lightIconButton: '#EDE8FF',
  locationGeneralBlue: '#CFF5FF',
  none: '#00000061',
  noteText: '#00000099',
  orange100: '#FFE0B2',
  orange700: '#F57C00',
  orange800: '#EF6C00',
  priorityHighIcon: '#F44336',
  priorityHighText: '#E53935',
  ratingActive: '#FFB400',
  selectMenuHover: '#F8F6FC',
  solidLine: '#DFE5E9',
  tableRow: 'rgba(0,0,0,0.87)',
  warningBackground:
    'linear-gradient(0deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)), linear-gradient(0deg, #ED6C02, #ED6C02)',
  warningIcon: '#ED6C02',
  warningText: '#5F2B00',
  infoAlert: '#e3f2fd',
};

const textFonts = ['Rubik', 'sans-serif'];
const headerFonts = ['Rubik', 'sans-serif'];

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
    fontWeight: '600 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  h4: {
    fontSize: 24,
    fontWeight: '600 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  h5: {
    fontSize: 18,
    fontWeight: '600 !important',
    fontFamily: headerFonts.join(','),
    lineHeight: '140%',
  },
  h6: {
    fontSize: 16,
    fontWeight: '600 !important',
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
  button: {
    fontSize: 14,
    fontWeight: 700,
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
