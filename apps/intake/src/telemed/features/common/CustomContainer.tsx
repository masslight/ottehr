import { BRANDING_CONFIG } from 'utils';
import { intakeLogo } from '../../../branding/assets';
import { CustomContainerFactory } from '../../../components/CustomContainerFactory';
import Footer from '../../components/Footer';

export const CustomContainer = CustomContainerFactory({
  logo: intakeLogo,
  alt: BRANDING_CONFIG.projectName,
  footer: <Footer />,
  showLanguagePicker: false,
});
