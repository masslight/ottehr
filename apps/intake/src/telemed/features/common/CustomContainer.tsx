import { CustomContainerFactory } from 'ui-components';
import Footer from '../../components/Footer';
import { PROJECT_NAME } from '../../../helpers/constants';
import { ottehrLogo } from '@theme/index';

export const CustomContainer = CustomContainerFactory({
  logo: ottehrLogo,
  alt: PROJECT_NAME,
  footer: <Footer />,
  logoutUrl: `${window.location.host}/home`,
  showLanguagePicker: false,
});
