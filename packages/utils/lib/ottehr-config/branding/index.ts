import type { BrandingConfig, LogoConfig } from 'config-types';

const BRANDING_DATA: BrandingConfig = {
  projectName: 'Ottehr',
  projectDomain: 'ottehr.com',
  email: {
    logoURL: '',
    palette: {
      deemphasizedText: '#00000061',
      headerText: '#0F347C',
      bodyText: '#000000DE',
      footerText: '#212130',
      buttonColor: '#295F75',
    },
    sender: 'support@ottehr.com',
  },
  logo: {
    default: '',
    email: '',
    pdf: '',
  },
  intake: {
    primaryIconAlt: 'Ottehr icon',
    welcomeTitleBreak: false,
    primaryIconSize: 90,
    appBar: {
      backgroundColor: '#0a2243',
      logoHeight: '39px',
      logoutButtonTextColor: '#FFFFFF',
    },
  },
};

export const BRANDING_CONFIG = Object.freeze(BRANDING_DATA);

// Derived constant - defined here to avoid circular dependencies
// (types/constants.ts cannot import from ottehr-config without creating a cycle)
export const PROJECT_WEBSITE = `https://${BRANDING_CONFIG.projectDomain}`;

type LogoTarget = Exclude<keyof LogoConfig, 'default' | 'pdfDimensions'>;

export function getLogoFor(target: LogoTarget): string | undefined {
  const value = BRANDING_CONFIG.logo?.[target];
  return (typeof value === 'string' ? value : undefined) || BRANDING_CONFIG.logo?.default;
}

const DEFAULT_PDF_LOGO_DIMENSIONS = { maxWidth: 110, maxHeight: 28 };

export function getPdfLogoDimensions(): { maxWidth: number; maxHeight: number } {
  return BRANDING_CONFIG.logo?.pdfDimensions ?? DEFAULT_PDF_LOGO_DIMENSIONS;
}
