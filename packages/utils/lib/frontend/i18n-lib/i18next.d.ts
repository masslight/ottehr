import 'i18next';
import { I18NextFix } from '../../types/I18NextFix';

declare module 'i18next' {
  type CustomTypeOptions = I18NextFix;
}
