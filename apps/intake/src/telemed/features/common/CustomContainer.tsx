import { ottehrLogo } from '@theme/index';
import { CustomContainerFactory } from 'ui-components';
import { PROJECT_NAME } from 'utils';
import Footer from '../../components/Footer';

export const CustomContainer = CustomContainerFactory({
  logo: ottehrLogo,
  alt: PROJECT_NAME,
  footer: <Footer />,
  showLanguagePicker: false,
});
