import { FC } from 'react';
import { PropsWithChildren, IntakeThemeProviderBase } from 'ui-components';
import i18n from './lib/i18n';
import * as customTheme from '@theme/index';
import * as defaults from '@defaultTheme/index';
import { createTheme } from '@mui/material';

const { palette: p } = createTheme();

export const otherColors = { ...defaults.otherColors, ...customTheme.otherColors };

export const palette = {
  ...defaults.palette,
  ...customTheme.palette,
  tertiary: p.augmentColor({
    color: { main: customTheme.palette?.tertiary?.main ?? defaults.palette.tertiary.main },
  }),
  destructive: p.augmentColor({
    color: { main: customTheme.palette?.destructive?.main ?? defaults.palette.destructive.main },
  }),
};

export const IntakeThemeProvider: FC<PropsWithChildren> = (props) => {
  const { children } = props;

  return (
    <IntakeThemeProviderBase palette={palette} otherColors={otherColors} i18n={i18n}>
      {children}
    </IntakeThemeProviderBase>
  );
};
