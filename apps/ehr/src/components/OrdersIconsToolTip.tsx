import { Box } from '@mui/material';
import { Link } from 'react-router-dom';
import { GenericToolTip } from './GenericToolTip';
import { OrdersToolTip } from 'src/features/common/OrdersToolTip';
import { sidebarMenuIcons } from 'src/features/css-module/components/Sidebar';
import {
  getInHouseLabsUrl,
  getInHouseLabOrderDetailsUrl,
  getExternalLabOrdersUrl,
  getExternalLabOrderEditUrl,
} from 'src/features/css-module/routing/helpers';
import {
  InHouseOrderListPageItemDTO,
  InPersonAppointmentInformation,
  LabOrderListPageDTO,
  OrderToolTipConfig,
} from 'utils';
import { InHouseLabsStatusChip } from 'src/features/in-house-labs/components/InHouseLabsStatusChip';
import { LabsOrderStatusChip } from 'src/features/external-labs/components/ExternalLabsStatusChip';

interface OrdersIconsToolTipProps {
  appointment: InPersonAppointmentInformation;
  inHouseLabOrders: InHouseOrderListPageItemDTO[] | undefined;
  externalLabOrders: LabOrderListPageDTO[] | undefined;
}
export const OrdersIconsToolTip: React.FC<OrdersIconsToolTipProps> = ({
  appointment,
  inHouseLabOrders,
  externalLabOrders,
}) => {
  const hasInHouseOrders = !!inHouseLabOrders?.length;
  const hasExternalOrders = !!externalLabOrders?.length;
  const ordersExistForAppointment = hasInHouseOrders || hasExternalOrders;

  if (!ordersExistForAppointment) return null;

  const orderConfigs: OrderToolTipConfig[] = [];

  if (hasExternalOrders) {
    const externalLabOrderConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['External Labs'],
      title: 'External Labs',
      tableUrl: getExternalLabOrdersUrl(appointment.id),
      orders: externalLabOrders.map((order) => ({
        serviceRequestId: order.serviceRequestId,
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
      title: 'In-house Labs',
      tableUrl: getInHouseLabsUrl(appointment.id),
      orders: inHouseLabOrders.map((order) => ({
        serviceRequestId: order.serviceRequestId,
        testItemName: order.testItemName,
        detailPageUrl: getInHouseLabOrderDetailsUrl(appointment.id, order.serviceRequestId),
        statusChip: <InHouseLabsStatusChip status={order.status} />,
      })),
    };
    orderConfigs.push(inHouseLabOrderConfig);
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
