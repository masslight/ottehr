import i18next, { i18n } from 'i18next';
import { createContext, useContext } from 'react';

export type IntakeThemeContextProps = {
  otherColors: Record<string, string>;
  i18n: i18n;
};

export const IntakeThemeContext = createContext<IntakeThemeContextProps>({
  otherColors: {},
  i18n: i18next,
});

export const useIntakeThemeContext = (): IntakeThemeContextProps => useContext(IntakeThemeContext);
