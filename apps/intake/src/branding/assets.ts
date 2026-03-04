import { primaryIcon as defaultPrimaryIcon, secondaryIcon as defaultSecondaryIcon } from '@theme/icons';
import { ottehrAiLogo, ottehrLogo as defaultIntakeLogo } from '@theme/index';
import { getIconFor, getLogoFor } from 'utils';

export const intakeLogo = getLogoFor('intake') ?? defaultIntakeLogo;
export const primaryIcon = getIconFor('primary') ?? defaultPrimaryIcon;
export const secondaryIcon = getIconFor('secondary') ?? defaultSecondaryIcon;
export const aiLogo = getIconFor('ai') ?? ottehrAiLogo;
