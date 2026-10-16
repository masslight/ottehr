import { FC } from 'react';
import { useParams } from 'react-router-dom';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';
import { getDmeOrdersUrl } from 'src/features/visits/in-person/routing/helpers';

export const DME_SECTION_TITLE = 'Durable Medical Equipment';

export const DmeBreadcrumbs: FC<{ sectionName: string }> = ({ sectionName }) => {
  const { id: appointmentId } = useParams();
  return (
    <BaseBreadcrumbs
      sectionName={sectionName}
      baseCrumb={{ label: DME_SECTION_TITLE, path: appointmentId ? getDmeOrdersUrl(appointmentId) : null }}
    />
  );
};
