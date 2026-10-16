import { Box, Button } from '@mui/material';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { dataTestIds } from 'src/constants/data-test-ids';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { getDmeOrderEditUrl, getDmeOrdersUrl } from 'src/features/visits/in-person/routing/helpers';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { DmeOrderDTO } from 'utils/lib/types/api/dme.types';
import { DmeBreadcrumbs } from '../components/DmeBreadcrumbs';
import { DmeOrderDetails } from '../components/DmeOrderDetails';
import { DmeOrderLoading, DmeOrderNotFound } from '../components/DmeOrderNotFound';
import { useDmeOrder } from '../dme.queries';

interface DmeOrderDetailsPageProps {
  deviceRequestId?: string;
  onBack?: () => void;
  onEdit?: (order: DmeOrderDTO) => void;
}

export const DmeOrderDetailsPage: React.FC<DmeOrderDetailsPageProps> = ({ deviceRequestId, onBack, onEdit }) => {
  const navigate = useNavigate();
  const isInlineFlow = useIsInlineFlow();
  const { id: appointmentId, dmeOrderId } = useParams();
  const orderId = deviceRequestId ?? dmeOrderId;
  const { data: order, isLoading, error } = useDmeOrder(orderId);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const goBack = onBack ?? ((): void => navigate(getDmeOrdersUrl(appointmentId ?? '')));

  if (isLoading) return <DmeOrderLoading />;
  if (!order) return <DmeOrderNotFound failed={!!error} onBack={goBack} />;

  const details = (
    <DmeOrderDetails
      order={order}
      readOnly={isReadOnly}
      onEdit={() => (onEdit ? onEdit(order) : navigate(getDmeOrderEditUrl(appointmentId ?? '', order.id)))}
      onDeleted={goBack}
    />
  );

  if (isInlineFlow) {
    return (
      <Box>
        {details}
        <Button
          variant="outlined"
          onClick={goBack}
          sx={{ mt: 2, borderRadius: '50px', textTransform: 'none' }}
          data-testid={dataTestIds.dmeOrders.details.backButton}
        >
          Back
        </Button>
      </Box>
    );
  }

  return (
    <DetailPageContainer>
      <DmeBreadcrumbs sectionName={order.itemName} />
      {details}
    </DetailPageContainer>
  );
};
