import { FC } from 'react';
import { createTheme } from '@mui/material';
import { PropsWithChildren, IntakeThemeProviderBase } from 'ottehr-components';
import i18n from './lib/i18n';

export const otherColors = {
  appointmentInfoBackground: '#8F66EF',
  appbarBackground: '#0A2143',
  background: '#5324BE',
  borderGray: '#D6D8DF',
  borderLightBlue: '#4294F3',
  checkIcon: '#7045F2',
  clearImage: '#EB5757',
  coachingVisit: '#EDE8FF',
  lightBlue: '#CFF5FF',
  darkPurple: '#301367',
  brightPurple: '#2169F5',
  darkGreen: '#0F5A4C',
  lightGreen: '#C1FBEA',
  purple: '#4D15B7',
  brown: '#604203',
  white: '#FFFFFF',
  lightPurple: '#F5F2FF',
  lightPurpleAlt: '#F1ECFE',
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
  cancel: '#B22020',
  lightCancel: '#FFD8D8',
  black: '#000000',
  toolTipGrey: '#F9FAFB',
  toolTipClose: '#938B7D',
};

const { palette: p } = createTheme(); // TODO: once https://github.com/mui/material-ui/issues/17410 is resolved, export directly from mui

export const palette = {
  text: {
    primary: '#061B74',
    secondary: '#4F4F4F',
    disabled: '#C3C9D2',
    cancelled: '#D91B1B',
  },
  primary: {
    main: '#061B74',
    contrast: '#FFFFFF',
  },
  secondary: {
    main: '#2169F5',
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
  destructive: p.augmentColor({ color: { main: '#EB5757' } }),
  action: {
    active: 'rgba(0, 0, 0, 0.54)',
    hover: 'rgba(0, 0, 0, 0.04)',
    selected: 'rgba(0, 0, 0, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)',
    focus: 'rgba(0, 0, 0, 0.12)',
  },
  background: {
    default: '#15376A',
    paper: '#FFFFFF',
    cancelled: '#FCBDBD',
  },
  divider: '#C3C9D2',
};

export const IntakeThemeProvider: FC<PropsWithChildren> = (props) => {
  const { children } = props;

  return (
    <IntakeThemeProviderBase palette={palette} otherColors={otherColors} i18n={i18n}>
      {children}
    </IntakeThemeProviderBase>
  );
};
