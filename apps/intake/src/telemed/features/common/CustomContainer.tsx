import { ottehrLogo } from '@theme/index';
import { BRANDING_CONFIG } from 'utils';
import { CustomContainerFactory } from '../../../components/CustomContainerFactory';
import Footer from '../../components/Footer';

export const CustomContainer = CustomContainerFactory({
  logo: ottehrLogo,
  alt: BRANDING_CONFIG.projectName,
  footer: <Footer />,
  showLanguagePicker: false,
});
