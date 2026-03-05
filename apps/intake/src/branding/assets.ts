import { BRANDING_CONFIG } from 'utils';
import {
  ottehrAiLogo,
  ottehrLogo,
  primaryIcon as defaultPrimaryIcon,
  secondaryIcon as defaultSecondaryIcon,
} from '../themes/ottehr';

export const intakeLogo = BRANDING_CONFIG.intake.assets?.logo || ottehrLogo;
export const primaryIcon = BRANDING_CONFIG.intake.assets?.primaryIcon || defaultPrimaryIcon;
export const secondaryIcon = BRANDING_CONFIG.intake.assets?.secondaryIcon || defaultSecondaryIcon;
export const aiLogo = BRANDING_CONFIG.intake.assets?.aiIcon || ottehrAiLogo;
