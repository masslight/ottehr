import { BRANDING_CONFIG } from 'utils';
import { primaryIcon } from './assets';

export const PRIMARY_ICON_PAGE = {
  CALL_ENDED: 'callEnded',
  CHOOSE_PATIENT_BANNER: 'choosePatientBanner',
  NEW_USER: 'newUser',
  RESCHEDULE: 'reschedule',
  THANK_YOU: 'thankYou',
  TELEMED_WAITING_ROOM: 'telemedWaitingRoom',
  TELEMED_WELCOME: 'telemedWelcome',
  WAITING_ESTIMATE_CARD: 'waitingEstimateCard',
  WALKIN_LANDING: 'walkinLanding',
} as const;

export type PrimaryIconPage = (typeof PRIMARY_ICON_PAGE)[keyof typeof PRIMARY_ICON_PAGE];

export const getPrimaryIconSize = (): number => BRANDING_CONFIG.intake.primaryIconSize ?? 90;

export const shouldShowPrimaryIcon = (page: PrimaryIconPage): boolean => {
  const visibilityConfig = BRANDING_CONFIG.intake.primaryIconVisibility;
  if (typeof visibilityConfig === 'boolean') {
    return visibilityConfig;
  }

  if (visibilityConfig?.pages?.[page] !== undefined) {
    return visibilityConfig.pages[page];
  }

  return visibilityConfig?.default ?? true;
};

export const getPrimaryIconContainerProps = (
  page: PrimaryIconPage
): {
  img?: string;
  imgAlt?: string;
  imgWidth?: number;
} => {
  if (!shouldShowPrimaryIcon(page)) {
    return {};
  }

  return {
    img: primaryIcon,
    imgAlt: BRANDING_CONFIG.intake.primaryIconAlt,
    imgWidth: getPrimaryIconSize(),
  };
};
