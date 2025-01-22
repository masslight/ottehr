import 'i18next';
import { I18NextFix } from 'utils';

declare module 'i18next' {
  type CustomTypeOptions = I18NextFix;
}
