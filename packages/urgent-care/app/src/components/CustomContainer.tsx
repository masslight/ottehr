import { ottehrLogo as logo } from '../assets';
import Footer from './Footer';
import { IntakeFlowPageRoute } from '../App';
import { CustomContainerFactory } from 'ui-components';

const CustomContainer = CustomContainerFactory(logo, 'Ottehr Urgent Care', <Footer />);

export default CustomContainer;
