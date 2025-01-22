import { FC } from 'react';
import { PropsWithChildren, IntakeThemeProviderBase } from 'ui-components';
import i18n from './lib/i18n';
import { otherColors, palette } from './telemed/utils/constants';

export { otherColors } from './telemed/utils/constants';
export { palette } from './telemed/utils/constants';

export const IntakeThemeProvider: FC<PropsWithChildren> = (props) => {
  const { children } = props;

  return (
    <IntakeThemeProviderBase palette={palette} otherColors={otherColors} i18n={i18n}>
      {children}
    </IntakeThemeProviderBase>
  );
};
