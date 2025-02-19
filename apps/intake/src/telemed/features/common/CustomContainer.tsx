import { CustomContainerFactory } from 'ui-components';
import { ottehrLogo } from '../../assets';
import Footer from '../../components/Footer';

export const CustomContainer = CustomContainerFactory({
  logo: ottehrLogo,
  alt: 'Ottehr',
  footer: <Footer />,
  showLanguagePicker: false,
});
