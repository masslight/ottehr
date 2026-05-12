import BadgeIcon from '@mui/icons-material/Badge';
import HealingIcon from '@mui/icons-material/Healing';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import { Box } from '@mui/material';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
// import { intakeFlowPageRoute } from '../App';
import { getWelcomeTitle } from '../branding/welcomeTitle';
import HomepageOption from '../components/HomepageOption';
import { useServiceCategories } from '../hooks/useServiceCategories';
import { CustomContainer } from '../telemed/features/common';

// hardcoding this for now. could move into config someday but more trouble than it's worth at the moment
const IconMap: Record<string, JSX.Element> = {
  'urgent-care': <HealingIcon />,
  'occupational-medicine': <BadgeIcon />,
  'workers-comp': <MedicalServicesIcon />,
};

const SelectServiceCategoryPage = (): JSX.Element => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Scope the category list to whatever bookable entity (group/location/provider)
  // this URL is targeting. Groups additionally filter to their declared category
  // list; other scheduleTypes fall through to the full catalog.
  const scheduleType = searchParams.get('scheduleType') || undefined;
  const bookingOn = searchParams.get('bookingOn') || undefined;
  const { serviceCategories } = useServiceCategories({ scheduleType, bookingOn });

  const location = useLocation();
  const currentPath = location.pathname;
  // Filter to services that support the flow the URL is for: walk-in picker
  // shows only walk-in-capable services; prebook picker shows only prebook.
  // Prevents a patient from arriving via a walk-in URL and selecting a
  // prebook-only category that the subsequent step couldn't actually handle.
  const isWalkinFlow = currentPath.startsWith('/walkin/');
  const requiredVisitType = isWalkinFlow ? 'walk-in' : 'prebook';
  const filteredServiceCategories = serviceCategories?.filter((sc) =>
    (sc.visitTypes ?? ['prebook']).includes(requiredVisitType)
  );

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
        {filteredServiceCategories?.map((sc) => (
          <HomepageOption
            key={sc.category.code}
            title={sc.category.display}
            icon={IconMap[sc.category.code ?? ''] ?? <LocalHospitalOutlinedIcon />}
            handleClick={() => handleSelection(sc.category.code ?? '')}
          />
        ))}
      </Box>
    </CustomContainer>
  );
};

export default SelectServiceCategoryPage;
