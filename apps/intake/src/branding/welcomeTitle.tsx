import { ReactNode } from 'react';
import { BRANDING_CONFIG } from 'utils';

export const getWelcomeTitle = (): ReactNode => {
  if (!BRANDING_CONFIG.intake.welcomeTitleBreak) {
    return `Welcome to ${BRANDING_CONFIG.projectName}`;
  }

  return (
    <>
      Welcome to
      <br />
      {BRANDING_CONFIG.projectName}
    </>
  );
};
