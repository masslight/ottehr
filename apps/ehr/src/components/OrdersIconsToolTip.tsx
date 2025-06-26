import { Box } from '@mui/material';
import { Link } from 'react-router-dom';
import { OrdersToolTip } from 'src/features/common/OrdersToolTip';
import { sidebarMenuIcons } from 'src/features/css-module/components/Sidebar';
import {
  getExternalLabOrderEditUrl,
  getExternalLabOrdersUrl,
  getInHouseLabOrderDetailsUrl,
  getInHouseLabsUrl,
  getNursingOrderDetailsUrl,
  getNursingOrdersUrl,
} from 'src/features/css-module/routing/helpers';
import { LabsOrderStatusChip } from 'src/features/external-labs/components/ExternalLabsStatusChip';
import { InHouseLabsStatusChip } from 'src/features/in-house-labs/components/InHouseLabsStatusChip';
import { NursingOrdersStatusChip } from 'src/features/nursing-orders/components/NursingOrdersStatusChip';
import {
  InHouseOrderListPageItemDTO,
  InPersonAppointmentInformation,
  LabOrderListPageDTO,
  NursingOrder,
  OrderToolTipConfig,
} from 'utils';
import { GenericToolTip } from './GenericToolTip';

interface OrdersIconsToolTipProps {
  appointment: InPersonAppointmentInformation;
  inHouseLabOrders: InHouseOrderListPageItemDTO[] | undefined;
  externalLabOrders: LabOrderListPageDTO[] | undefined;
  nursingOrders: NursingOrder[] | undefined;
}
export const OrdersIconsToolTip: React.FC<OrdersIconsToolTipProps> = ({
  appointment,
  inHouseLabOrders,
  externalLabOrders,
  nursingOrders,
}) => {
  const hasInHouseOrders = !!inHouseLabOrders?.length;
  const hasExternalOrders = !!externalLabOrders?.length;
  const hasNursingOrders = !!nursingOrders?.length;
  const ordersExistForAppointment = hasInHouseOrders || hasExternalOrders || hasNursingOrders;

  if (!ordersExistForAppointment) return null;

  const orderConfigs: OrderToolTipConfig[] = [];

  if (hasExternalOrders) {
    const externalLabOrderConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['External Labs'],
      title: 'External Labs',
      tableUrl: getExternalLabOrdersUrl(appointment.id),
      orders: externalLabOrders.map((order) => ({
        serviceRequestId: order.serviceRequestId,
        itemDescription: order.testItem,
        detailPageUrl: getExternalLabOrderEditUrl(appointment.id, order.serviceRequestId),
        statusChip: <LabsOrderStatusChip status={order.orderStatus} />,
      })),
    };
    orderConfigs.push(externalLabOrderConfig);
  }

  if (hasInHouseOrders) {
    const inHouseLabOrderConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['In-house Labs'],
      title: 'In-house Labs',
      tableUrl: getInHouseLabsUrl(appointment.id),
      orders: inHouseLabOrders.map((order) => ({
        serviceRequestId: order.serviceRequestId,
        itemDescription: order.testItemName,
        detailPageUrl: getInHouseLabOrderDetailsUrl(appointment.id, order.serviceRequestId),
        statusChip: <InHouseLabsStatusChip status={order.status} />,
      })),
    };
    orderConfigs.push(inHouseLabOrderConfig);
  }

  if (hasNursingOrders) {
    const nursingOrdersConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['Nursing Orders'],
      title: 'Nursing Orders',
      tableUrl: getNursingOrdersUrl(appointment.id),
      orders: nursingOrders.map((order) => ({
        serviceRequestId: order.serviceRequestId,
        itemDescription: order.note,
        detailPageUrl: getNursingOrderDetailsUrl(appointment.id, order.serviceRequestId),
        statusChip: <NursingOrdersStatusChip status={order.status} />,
      })),
    };
    orderConfigs.push(nursingOrdersConfig);
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
