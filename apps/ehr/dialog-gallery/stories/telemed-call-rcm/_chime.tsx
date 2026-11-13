import {
  BackgroundBlurProvider,
  BackgroundReplacementProvider,
  GlobalStyles,
  lightTheme,
  MeetingProvider,
} from 'amazon-chime-sdk-component-library-react';
import { FC, PropsWithChildren } from 'react';
import { ThemeProvider } from 'styled-components';

/**
 * The exact provider stack InPersonLayout mounts around the video call UI. No meeting is joined, so
 * the Chime hooks answer with their "not connected" defaults (no devices, no video tiles).
 */
export const ChimeProviders: FC<PropsWithChildren> = ({ children }) => (
  <ThemeProvider theme={lightTheme}>
    <GlobalStyles />
    <BackgroundBlurProvider>
      <BackgroundReplacementProvider>
        <MeetingProvider>{children}</MeetingProvider>
      </BackgroundReplacementProvider>
    </BackgroundBlurProvider>
  </ThemeProvider>
);
