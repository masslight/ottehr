import { CustomContainerFactory } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../../App';
import bg from '@theme/bg.png';
import logo from '@theme/Logo.svg';
import Footer from '../../components/Footer';

const imageForBackground = (page: string): string => {
  switch (page) {
    case IntakeFlowPageRoute.PatientPortal.path:
      return bg;
    default:
      return bg;
  }
};

export const CustomContainer = CustomContainerFactory(imageForBackground, logo, 'Ottehr Telemedicine', <Footer />);
