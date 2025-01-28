import { CustomContainerFactory } from 'ui-components';
import { ottehrLogo } from '../../assets';
import Footer from '../../components/Footer';
import { PROJECT_NAME } from '../../../helpers/constants';

export const CustomContainer = CustomContainerFactory({
  logo: ottehrLogo,
  alt: PROJECT_NAME,
  footer: <Footer />,
  logoutUrl: `${window.location.host}/home`,
  showLanguagePicker: false,
});
