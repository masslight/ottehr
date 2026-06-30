import { createContext, FC, PropsWithChildren, useContext, useMemo } from 'react';

/**
 * The subset of intake's `otherColors` map that the shared paperwork render tree reads.
 * Defaults below are intake's production values (`apps/intake/src/themes/ottehr/colors.ts`),
 * so EHR previews that supply no override still render with intake-correct colors.
 */
export interface PaperworkOtherColors {
  toolTipGrey: string;
  black: string;
  scheduleBorder: string;
  purple: string;
  coachingVisit: string;
  clearImage: string;
  cardBackground: string;
  lightGray: string;
  primaryBoxShadow: string;
  lightBlue: string;
  borderGray: string;
}

export const DEFAULT_PAPERWORK_OTHER_COLORS: PaperworkOtherColors = {
  toolTipGrey: '#F9FAFB',
  black: '#000000',
  scheduleBorder: '#8F9AA7',
  purple: '#2169F5',
  coachingVisit: '#aed4fc',
  clearImage: '#EB5757',
  cardBackground: '#F7F8F9',
  lightGray: 'rgba(0, 0, 0, 0.23)',
  primaryBoxShadow: 'rgba(77, 21, 183, 0.25)',
  lightBlue: '#E2F0FF',
  borderGray: '#D6D8DF',
};

const PaperworkThemeContext = createContext<PaperworkOtherColors>(DEFAULT_PAPERWORK_OTHER_COLORS);

export interface PaperworkThemeProviderProps extends PropsWithChildren {
  /**
   * Override colors. Any keys omitted fall back to {@link DEFAULT_PAPERWORK_OTHER_COLORS}.
   * Intake passes its full `otherColors` map here so paperwork renders identically to before.
   */
  otherColors?: Partial<PaperworkOtherColors>;
}

export const PaperworkThemeProvider: FC<PaperworkThemeProviderProps> = ({ otherColors, children }) => {
  const value = useMemo<PaperworkOtherColors>(
    () => ({ ...DEFAULT_PAPERWORK_OTHER_COLORS, ...(otherColors ?? {}) }),
    [otherColors]
  );
  return <PaperworkThemeContext.Provider value={value}>{children}</PaperworkThemeContext.Provider>;
};

export const usePaperworkOtherColors = (): PaperworkOtherColors => useContext(PaperworkThemeContext);
