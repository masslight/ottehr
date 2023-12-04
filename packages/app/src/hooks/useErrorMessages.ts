import { useTranslation } from 'react-i18next';
import { ErrorCodes } from '../types';

export const useErrorMessages = (): ((errorCode: ErrorCodes) => string) => {
  const { t } = useTranslation();

  const getErrorMessage = (errorCode: ErrorCodes): string => {
    const errorMessages: Record<ErrorCodes, string> = {
      // 10 000: General
      10_001: t('error.unexpected'),
      10_002: t('error.reload'),
      10_003: t('error.unauthorized'),
      10_004: t('error.timedOut'),
      10_005: t('error.notFound'),
      10_006: t('error.duplicate'),
      10_007: t('error.unauthorizedByThirdParty'),
      // 11 000: Failed action
      11_001: t('error.couldNotJoin'),
      11_002: t('error.couldNotCreate'),
      11_003: t('error.couldNotUpdate'),
      11_004: t('error.couldNotDelete'),
      11_005: t('error.couldNotSync'),
      // 20 000: Validation - must match
      20_001: t('error.mustBeNotEmpty'),
      20_002: t('error.mustBeString'),
      20_003: t('error.mustBeLetters'),
      20_004: t('error.mustBeNumber'),
      20_005: t('error.mustBeAlphanumeric'),
      20_006: t('error.mustBeAlphanumericWithSpaces'),
      20_007: t('error.mustBePhone'),
      20_008: t('error.mustBeEmail'),
      20_009: t('error.mustBeUuid'),
      20_010: t('error.mustBeDate'),

      20_101: t('error.mustMatchList'),
      20_102: t('error.mustPassPasswordChecks'),
      // 21 0000: Validation - missing
      21_001: t('error.missingRequired'),
      21_002: t('error.missingProperties'),
    };

    return errorMessages[errorCode] || t('error.default');
  };

  return getErrorMessage;
};
