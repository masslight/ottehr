import { BRANDING_CONFIG } from 'utils';
import { CustomContainerFactory } from '../../../components/CustomContainerFactory';
import Footer from '../../components/Footer';

export const CustomContainer = CustomContainerFactory({
  logo: '/intakeLogo.png',
  alt: BRANDING_CONFIG.projectName,
  footer: <Footer />,
  showLanguagePicker: false,
});
