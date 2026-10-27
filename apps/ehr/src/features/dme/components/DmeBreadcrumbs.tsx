import { FC } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { getDmeOrdersUrl, withEncounterIdParam } from 'src/features/visits/in-person/routing/helpers';

export const DME_SECTION_TITLE = 'Durable Medical Equipment';

export const DmeBreadcrumbs: FC<{ sectionName: string }> = ({ sectionName }) => {
  const { id: appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const path =
    appointmentId && FEATURE_FLAGS.DME_ORDERS_ENABLED
      ? withEncounterIdParam(getDmeOrdersUrl(appointmentId), searchParams.get('encounterId'))
      : null;
  return <BaseBreadcrumbs sectionName={sectionName} baseCrumb={{ label: DME_SECTION_TITLE, path }} />;
};
