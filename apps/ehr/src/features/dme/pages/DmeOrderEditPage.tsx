import { Typography } from '@mui/material';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { dataTestIds } from 'src/constants/data-test-ids';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { getDmeOrderDetailsUrl } from 'src/features/visits/in-person/routing/helpers';
import { DmeBreadcrumbs } from '../components/DmeBreadcrumbs';
import { DmeOrderForm } from '../components/DmeOrderForm';
import { DmeOrderLoading, DmeOrderNotFound } from '../components/DmeOrderNotFound';
import { useDmeOrder } from '../dme.queries';

interface DmeOrderEditPageProps {
  deviceRequestId?: string;
  onFinished?: () => void;
  onCancel?: () => void;
}

export const DmeOrderEditPage: React.FC<DmeOrderEditPageProps> = ({ deviceRequestId, onFinished, onCancel }) => {
  const navigate = useNavigate();
  const isInlineFlow = useIsInlineFlow();
  const { id: appointmentId, dmeOrderId } = useParams();
  const orderId = deviceRequestId ?? dmeOrderId;
  const { data: order, isLoading, error } = useDmeOrder(orderId);
  const exit = onFinished ?? ((): void => navigate(getDmeOrderDetailsUrl(appointmentId ?? '', orderId ?? '')));

  if (isLoading) return <DmeOrderLoading />;
  if (!order) return <DmeOrderNotFound failed={!!error} onBack={onCancel ?? exit} />;

  const form = <DmeOrderForm order={order} onFinished={() => exit()} onCancel={onCancel ?? exit} />;

  if (isInlineFlow) return form;

  return (
    <DetailPageContainer>
      <DmeBreadcrumbs sectionName="Edit DME Order" />
      <Typography variant="h4" color="primary.dark" data-testid={dataTestIds.dmeOrders.form.title}>
        Edit DME Order
      </Typography>
      {form}
    </DetailPageContainer>
  );
};
