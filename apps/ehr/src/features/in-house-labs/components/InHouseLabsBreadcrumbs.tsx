import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';
import { getInHouseLabsUrl } from 'src/features/visits/in-person/routing/helpers';

export const InHouseLabsBreadcrumbs: React.FC<{ children: React.ReactNode; pageName: string }> = ({
  children,
  pageName,
}) => {
  const { id: appointmentIdFromUrl } = useParams();

  const baseCrumb = useMemo(() => {
    return {
      label: 'In-House Labs',
      path: appointmentIdFromUrl ? getInHouseLabsUrl(appointmentIdFromUrl) : null,
    };
  }, [appointmentIdFromUrl]);

  return (
    <BaseBreadcrumbs sectionName={pageName} baseCrumb={baseCrumb}>
      {children}
    </BaseBreadcrumbs>
  );
};
