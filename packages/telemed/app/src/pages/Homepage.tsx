import { IntakeFlowPageRoute } from '../App';
import { CustomContainer } from '../features/common';
import { clockFullColor } from '../assets';
import HomepageOption from '../features/homepage/HomepageOption';
import { useNavigate } from 'react-router-dom';

const Homepage = (): JSX.Element => {
  const navigate = useNavigate();

  const handleRequestVisit = (): void => {
    navigate(IntakeFlowPageRoute.RequestVisit.path);
  };

  // const handlePastVisits = (): void => {
  //   console.log('Past Visits');
  // };

  // const handleContactSupport = (): void => {
  //   console.log('Contact Support');
  // };

  return (
    <CustomContainer
      title="Welcome to Ottehr Telemedicine"
      description=""
      bgVariant={IntakeFlowPageRoute.Homepage.path}
      isFirstPage={true}
    >
      <HomepageOption title="Request Visit" icon={clockFullColor} handleClick={handleRequestVisit} />
      {/* <HomepageOptions title="Past Visits" icon={pastVisits} handleClick={handlePastVisits} />
      <HomepageOptions title="Contact Support" icon={contactSupport} handleClick={handleContactSupport} /> */}
    </CustomContainer>
  );
};

export default Homepage;
