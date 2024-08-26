import { CustomContainerFactory } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../../App';
import bg from '@assets/bg.png';
import logo from '@assets/Logo.svg';
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
