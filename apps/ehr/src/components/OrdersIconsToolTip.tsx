import { Box } from '@mui/material';
import { Link } from 'react-router-dom';
import { OrdersToolTip } from 'src/features/common/OrdersToolTip';
import { MedicationStatusChip } from 'src/features/css-module/components/medication-administration/statuses/MedicationStatusChip';
import { sidebarMenuIcons } from 'src/features/css-module/components/Sidebar';
import {
  getExternalLabOrderEditUrl,
  getExternalLabOrdersUrl,
  getInHouseLabOrderDetailsUrl,
  getInHouseLabsUrl,
  getInHouseMedicationDetailsUrl,
  getInHouseMedicationMARUrl,
} from 'src/features/css-module/routing/helpers';
import { LabsOrderStatusChip } from 'src/features/external-labs/components/ExternalLabsStatusChip';
import { InHouseLabsStatusChip } from 'src/features/in-house-labs/components/InHouseLabsStatusChip';
import {
  ExtendedMedicationDataForResponse,
  InHouseOrderListPageItemDTO,
  InPersonAppointmentInformation,
  LabOrderListPageDTO,
  OrderToolTipConfig,
} from 'utils';
import { GenericToolTip } from './GenericToolTip';

interface OrdersIconsToolTipProps {
  appointment: InPersonAppointmentInformation;
  inHouseLabOrders: InHouseOrderListPageItemDTO[] | undefined;
  externalLabOrders: LabOrderListPageDTO[] | undefined;
  inHouseMedications: ExtendedMedicationDataForResponse[] | undefined;
}
export const OrdersIconsToolTip: React.FC<OrdersIconsToolTipProps> = ({
  appointment,
  inHouseLabOrders,
  externalLabOrders,
  inHouseMedications,
}) => {
  const hasInHouseOrders = !!inHouseLabOrders?.length;
  const hasExternalOrders = !!externalLabOrders?.length;
  const hasInHouseMedications = !!inHouseMedications?.length;
  const ordersExistForAppointment = hasInHouseOrders || hasExternalOrders || hasInHouseMedications;

  if (!ordersExistForAppointment) return null;

  const orderConfigs: OrderToolTipConfig[] = [];

  if (hasExternalOrders) {
    const externalLabOrderConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['External Labs'],
      title: 'External Labs',
      tableUrl: getExternalLabOrdersUrl(appointment.id),
      orders: externalLabOrders.map((order) => ({
        fhirResourceId: order.serviceRequestId,
        testItemName: order.testItem,
        detailPageUrl: getExternalLabOrderEditUrl(appointment.id, order.serviceRequestId),
        statusChip: <LabsOrderStatusChip status={order.orderStatus} />,
      })),
    };
    orderConfigs.push(externalLabOrderConfig);
  }

  if (hasInHouseOrders) {
    const inHouseLabOrderConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['In-house Labs'],
      title: 'In-House Labs',
      tableUrl: getInHouseLabsUrl(appointment.id),
      orders: inHouseLabOrders.map((order) => ({
        fhirResourceId: order.serviceRequestId,
        testItemName: order.testItemName,
        detailPageUrl: getInHouseLabOrderDetailsUrl(appointment.id, order.serviceRequestId),
        statusChip: <InHouseLabsStatusChip status={order.status} />,
      })),
    };
    orderConfigs.push(inHouseLabOrderConfig);
  }

  if (hasInHouseMedications) {
    const inHouseMedicationConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['Med. Administration'],
      title: 'In-House Medications',
      tableUrl: getInHouseMedicationMARUrl(appointment.id),
      orders: inHouseMedications.map((med) => ({
        fhirResourceId: med.id,
        testItemName: med.medicationName,
        detailPageUrl: `${getInHouseMedicationDetailsUrl(appointment.id)}?scrollTo=${med.id}`,
        statusChip: <MedicationStatusChip medication={med} />,
      })),
    };
    orderConfigs.push(inHouseMedicationConfig);
  }

  return (
    <GenericToolTip title={<OrdersToolTip orderConfigs={orderConfigs} />} customWidth="none" placement="top">
      <Box sx={{ display: 'flex', width: '100%' }}>
        {orderConfigs.map((config) => (
          <Link to={config.tableUrl} style={{ textDecoration: 'none' }} key={`${config.title}-icon-indicator`}>
            <Box
              sx={{
                display: 'flex',
                gap: 0,
                color: '#0F347C',
                backgroundColor: '#2169F514',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px',
              }}
            >
              {config.icon}
            </Box>
          </Link>
        ))}
      </Box>
    </GenericToolTip>
  );
};
