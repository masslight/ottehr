import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import HealthMetricIcon from '@theme/icons/health-metric.svg?react';
import PersonalInjuryIcon from '@theme/icons/personal-injury.svg?react';
import { ReactNode, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BOOKING_CONFIG, serviceCategorySupportsContext } from 'utils';
import { getWelcomeTitle } from '../branding/welcomeTitle';
import ServiceCategoryPicker, { ServiceCategoryOption } from '../components/ServiceCategoryPicker';
import { useServiceCategories } from '../hooks/useServiceCategories';
import { CustomContainer } from '../telemed/features/common';
import { deriveServiceModeFromPath } from './selectServiceCategoryMode';

// hardcoding this for now. could move into config someday but more trouble than it's worth at the moment
const IconMap: Record<string, ReactNode> = {
  'urgent-care': <HealthMetricIcon />,
  'occupational-medicine': <BadgeOutlinedIcon />,
  'workers-comp': <PersonalInjuryIcon />,
};

const SelectServiceCategoryPage = (): JSX.Element => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Group-scoped queries hit the group's allow-list; everything else uses the full catalog.
  const scheduleType = searchParams.get('scheduleType') || undefined;
  const bookingOn = searchParams.get('bookingOn') || undefined;
  const { serviceCategories } = useServiceCategories({ scheduleType, bookingOn });

  const location = useLocation();
  const currentPath = location.pathname;
  // `/start-virtual/` is a walk-in flow too, just virtual instead of in-person
  // (StartVirtualVisit creates its Slot with walkin=true).
  const isWalkinFlow = currentPath.startsWith('/walkin/') || currentPath.startsWith('/start-virtual/');
  const requiredVisitType = isWalkinFlow ? 'walk-in' : 'prebook';

  const requiredServiceMode = useMemo<string | undefined>(() => deriveServiceModeFromPath(currentPath), [currentPath]);

  const options: ServiceCategoryOption[] = useMemo(() => {
    const serviceCategoryIcons = BOOKING_CONFIG.serviceCategoryIcons ?? {};
    // Shared filter with homepage / get-context resolver via
    // serviceCategorySupportsContext — untagged BOOKING_CONFIG entries
    // are admitted via the same rule everywhere. Mode is supplied when
    // the URL declares it (see requiredServiceMode); skipped only on the
    // walkin/schedule/:id route where mode is owner-dependent.
    return (serviceCategories ?? [])
      .filter((sc) => serviceCategorySupportsContext(sc, requiredServiceMode, requiredVisitType))
      .map((sc) => ({
        code: sc.category.code,
        display: sc.category.display ?? sc.category.code,
        icon: serviceCategoryIcons[sc.category.code] ?? IconMap[sc.category.code] ?? <LocalHospitalOutlinedIcon />,
      }));
  }, [serviceCategories, requiredServiceMode, requiredVisitType]);

  const handleSelection = (serviceCategory: string): void => {
    const destination = currentPath.replace('/select-service-category', '');
    searchParams.set('serviceCategory', serviceCategory);
    const newDestination = `${destination}?${searchParams.toString()}`;
    console.log('Navigating to:', serviceCategory, newDestination);
    navigate(newDestination);
  };

  return (
    <CustomContainer title={getWelcomeTitle()} description="" isFirstPage={true}>
      <ServiceCategoryPicker options={options} onSelect={handleSelection} dataTestIdPrefix="service-category-option" />
    </CustomContainer>
  );
};

export default SelectServiceCategoryPage;
