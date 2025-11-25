import BadgeIcon from '@mui/icons-material/Badge';
import HealingIcon from '@mui/icons-material/Healing';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import { Box } from '@mui/material';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BOOKING_CONFIG, BRANDING_CONFIG } from 'utils';
// import { intakeFlowPageRoute } from '../App';
import HomepageOption from '../components/HomepageOption';
import { CustomContainer } from '../telemed/features/common';

// hardcoding this for now. could move into config someday but more trouble than it's worth at the moment
const IconMap: Record<string, JSX.Element> = {
  'urgent-care': <HealingIcon />,
  'occupational-medicine': <BadgeIcon />,
  'workmans-comp': <MedicalServicesIcon />,
};

const SelectServiceCategoryPage = (): JSX.Element => {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const location = useLocation();
  const currentPath = location.pathname;

  const handleSelection = (serviceCategory: string): void => {
    const destination = currentPath.replace('/select-service-category', '');
    searchParams.set('serviceCategory', serviceCategory);
    const newDestination = `${destination}?${searchParams.toString()}`;
    console.log('Navigating to:', serviceCategory, newDestination);
    // add the service category to the current query params and navigate to the next page
    navigate(newDestination);
  };

  return (
    <CustomContainer title={`Welcome to ${BRANDING_CONFIG.projectName}`} description="" isFirstPage={true}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {BOOKING_CONFIG.serviceCategories?.map((category) => (
          <HomepageOption
            key={category.code}
            title={category.display}
            icon={IconMap[category.code] ?? <LocalHospitalOutlinedIcon />}
            handleClick={() => handleSelection(category.code)}
          />
        ))}
      </Box>
    </CustomContainer>
  );
};

export default SelectServiceCategoryPage;
