import { FC } from 'react';
import { createTheme } from '@mui/material';
import { PropsWithChildren, IntakeThemeProviderBase } from 'ottehr-components';
import i18n from './lib/i18n';
import * as customTheme from '@theme/index';
import * as defaults from '@defaultTheme/index';
export const otherColors = { ...defaults.otherColors, ...customTheme.otherColors };

const { palette: p } = createTheme(); // TODO: once https://github.com/mui/material-ui/issues/17410 is resolved, export directly from mui

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
    <IntakeThemeProviderBase
      palette={palette}
      otherColors={otherColors}
      i18n={i18n}
      customComponentsOverrides={customTheme.componentStyles}
      customTypographyOverrides={customTheme.typography}
    >
      {children}
    </IntakeThemeProviderBase>
  );
};
