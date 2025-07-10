import { ottehrLogo } from '@theme/index';
import { PROJECT_NAME } from 'utils';
import { CustomContainerFactory } from '../../../components/CustomContainerFactory';
import Footer from '../../components/Footer';

export const CustomContainer = CustomContainerFactory({
  logo: ottehrLogo,
  alt: PROJECT_NAME,
  footer: <Footer />,
  showLanguagePicker: false,
});
