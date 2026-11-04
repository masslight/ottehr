import { Typography } from '@mui/material';
import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { dataTestIds } from 'src/constants/data-test-ids';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { getDmeOrdersUrl, withEncounterIdParam } from 'src/features/visits/in-person/routing/helpers';
import { DmeBreadcrumbs } from '../components/DmeBreadcrumbs';
import { DmeOrderForm } from '../components/DmeOrderForm';

interface DmeOrderCreatePageProps {
  onFinished?: () => void;
  onCancel?: () => void;
}

export const DmeOrderCreatePage: React.FC<DmeOrderCreatePageProps> = ({ onFinished, onCancel }) => {
  const navigate = useNavigate();
  const isInlineFlow = useIsInlineFlow();
  const { id: appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const exit =
    onFinished ??
    ((): void => navigate(withEncounterIdParam(getDmeOrdersUrl(appointmentId ?? ''), searchParams.get('encounterId'))));

  const form = <DmeOrderForm onFinished={() => exit()} onCancel={onCancel ?? exit} />;

  if (isInlineFlow) return form;

  return (
    <DetailPageContainer>
      <DmeBreadcrumbs sectionName="Order DME" />
      <Typography variant="h4" color="primary.dark" data-testid={dataTestIds.dmeOrders.form.title}>
        Order DME
      </Typography>
      {form}
    </DetailPageContainer>
  );
};
