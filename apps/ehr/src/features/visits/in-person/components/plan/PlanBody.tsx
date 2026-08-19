import { Stack } from '@mui/material';
import { FC } from 'react';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { DispositionCard } from '../../../shared/components/DispositionCard';
import { FormsCard } from '../../../shared/components/FormsCard';
import { PatientEducationCard } from '../../../shared/components/plan-tab/PatientEducationCard';
import { PatientInstructionsCard } from '../../../shared/components/plan-tab/PatientInstructionsCard';
import { SchoolWorkExcuseCard } from '../../../shared/components/SchoolWorkExcuseCard';
import { useAppointmentData } from '../../../shared/stores/appointment/appointment.store';
import { useInPersonNavigationContext } from '../../context/InPersonNavigationContext';

// Everything on the Plan screen below the page title. Rendered by the Plan page and
// inline on the Review & Sign page (InlineEditSection).
export const PlanBody: FC = () => {
  const { location } = useAppointmentData();
  const { interactionMode } = useInPersonNavigationContext();
  const locationName = location?.name;
  const isFollowUp = interactionMode === 'follow-up';

  return (
    <Stack spacing={1}>
      {!isFollowUp && <PatientInstructionsCard />}
      {!isFollowUp && <DispositionCard />}
      {!isFollowUp && <PatientEducationCard />}
      <SchoolWorkExcuseCard locationName={locationName} />
      {!isFollowUp && FEATURE_FLAGS.FORMS_ENABLED && <FormsCard />}
    </Stack>
  );
};
