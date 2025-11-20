import { CustomContainerFactory } from '../../../components/CustomContainerFactory';
import Footer from '../../components/Footer';

export const CustomContainer = CustomContainerFactory({
  logo: `${window.APP_CONFIG?.projectName ?? ''}`,
  alt: `${window.APP_CONFIG?.projectName ?? ''}`,
  footer: <Footer />,
  showLanguagePicker: false,
});
