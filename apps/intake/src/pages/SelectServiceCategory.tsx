import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import { Box } from '@mui/material';
import HealthMetricIcon from '@theme/icons/health-metric.svg?react';
import PersonalInjuryIcon from '@theme/icons/personal-injury.svg?react';
import { ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BOOKING_CONFIG } from 'utils';
// import { intakeFlowPageRoute } from '../App';
import { getWelcomeTitle } from '../branding/welcomeTitle';
import HomepageOption from '../components/HomepageOption';
import { CustomContainer } from '../telemed/features/common';

// hardcoding this for now. could move into config someday but more trouble than it's worth at the moment
const IconMap: Record<string, ReactNode> = {
  'urgent-care': <HealthMetricIcon />,
  'occupational-medicine': <BadgeOutlinedIcon />,
  'workers-comp': <PersonalInjuryIcon />,
};

const SelectServiceCategoryPage = (): JSX.Element => {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const location = useLocation();
  const currentPath = location.pathname;
  const serviceCategoryIcons = BOOKING_CONFIG.serviceCategoryIcons ?? {};

  const handleSelection = (serviceCategory: string): void => {
    const destination = currentPath.replace('/select-service-category', '');
    searchParams.set('serviceCategory', serviceCategory);
    const newDestination = `${destination}?${searchParams.toString()}`;
    console.log('Navigating to:', serviceCategory, newDestination);
    // add the service category to the current query params and navigate to the next page
    navigate(newDestination);
  };

  return (
    <CustomContainer title={getWelcomeTitle()} description="" isFirstPage={true}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {BOOKING_CONFIG.serviceCategories?.map((sc) => (
          <HomepageOption
            key={sc.category.code}
            title={sc.category.display}
            icon={serviceCategoryIcons[sc.category.code] ?? IconMap[sc.category.code] ?? <LocalHospitalOutlinedIcon />}
            handleClick={() => handleSelection(sc.category.code)}
          />
        ))}
      </Box>
    </CustomContainer>
  );
};

export default SelectServiceCategoryPage;
