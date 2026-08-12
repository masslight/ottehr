import * as defaults from '@defaultTheme/index';
import { createTheme } from '@mui/material';
import * as customTheme from '@theme/index';
import _ from 'lodash';
import { FC } from 'react';
import { IntakeThemeProviderBase } from 'src/providers/IntakeThemeProviderBase';
import { PropsWithChildren } from 'src/types/props-with-children';
import { i18n } from 'utils/lib/frontend';
import { BRANDING_CONFIG } from 'utils/lib/ottehr-config/branding';

const { palette: p } = createTheme();

export const otherColors = {
  ...defaults.otherColors,
  ...customTheme.otherColors,
  ...(BRANDING_CONFIG.intake.theme?.otherColors ?? {}),
};

const mergedPalette = _.merge({}, defaults.palette, customTheme.palette, BRANDING_CONFIG.intake.theme?.palette ?? {});

export const palette = {
  ...mergedPalette,
  tertiary: p.augmentColor({
    color: { main: mergedPalette.tertiary?.main ?? defaults.palette.tertiary.main },
  }),
  destructive: p.augmentColor({
    color: { main: mergedPalette.destructive?.main ?? defaults.palette.destructive.main },
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
