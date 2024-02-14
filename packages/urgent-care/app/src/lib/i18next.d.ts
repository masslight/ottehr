import 'i18next';
import { I18NextFix } from 'ottehr-utils';

declare module 'i18next' {
  type CustomTypeOptions = I18NextFix;
}
