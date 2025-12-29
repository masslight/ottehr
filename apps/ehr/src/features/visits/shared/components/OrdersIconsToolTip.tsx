import { Badge, Box } from '@mui/material';
import { Link } from 'react-router-dom';
import { MappedStatusChip } from 'src/components/MappedStatusChip';
import { OrdersToolTip } from 'src/features/common/OrdersToolTip';
import { LabsOrderStatusChip } from 'src/features/external-labs/components/ExternalLabsStatusChip';
import { InHouseLabsStatusChip } from 'src/features/in-house-labs/components/InHouseLabsStatusChip';
import { NursingOrdersStatusChip } from 'src/features/nursing-orders/components/NursingOrdersStatusChip';
import { RadiologyTableStatusChip } from 'src/features/radiology/components/RadiologyTableStatusChip';
import { MedicationStatusChip } from 'src/features/visits/in-person/components/medication-administration/statuses/MedicationStatusChip';
import {
  getErxUrl,
  getExternalLabOrderEditUrl,
  getExternalLabOrdersUrl,
  getInHouseLabOrderDetailsUrl,
  getInHouseLabsUrl,
  getInHouseMedicationDetailsUrl,
  getInHouseMedicationMARUrl,
  getNursingOrderDetailsUrl,
  getNursingOrdersUrl,
  getRadiologyOrderEditUrl,
  getRadiologyUrl,
} from 'src/features/visits/in-person/routing/helpers';
import { sidebarMenuIcons } from 'src/features/visits/shared/components/Sidebar';
import { hasAtLeastOneOrder } from 'src/helpers';
import {
  ExternalLabsStatus,
  InPersonAppointmentInformation,
  MedicationOrderStatuses,
  NursingOrdersStatus,
  OrdersForTrackingBoardRow,
  OrderToolTipConfig,
  RadiologyOrderStatus,
  TestStatus,
} from 'utils';
import { GenericToolTip } from '../../../../components/GenericToolTip';
import { medicationStatusMapper } from './plan-tab/ERxContainer';

interface OrdersIconsToolTipProps {
  appointment: InPersonAppointmentInformation;
  orders: OrdersForTrackingBoardRow;
}
export const OrdersIconsToolTip: React.FC<OrdersIconsToolTipProps> = ({ appointment, orders }) => {
  const ordersExistForAppointment = hasAtLeastOneOrder(orders);
  if (!ordersExistForAppointment) return null;

  const { externalLabOrders, inHouseLabOrders, nursingOrders, inHouseMedications, radiologyOrders, erxOrders } = orders;

  const filteredInHouseMedications = inHouseMedications?.filter((med) => med?.status !== 'cancelled');

  const orderConfigs: OrderToolTipConfig[] = [];

  if (externalLabOrders?.length) {
    const unreadStatuses = [
      ExternalLabsStatus.pending,
      ExternalLabsStatus.prelim,
      ExternalLabsStatus.sent, // todo this is final status???
      ExternalLabsStatus.corrected,
      ExternalLabsStatus['rejected abn'],
      ExternalLabsStatus['cancelled by lab'],
    ];
    const externalLabOrderConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['External Labs'],
      title: 'External Labs',
      tableUrl: getExternalLabOrdersUrl(appointment.id),
      unreadBadge: Boolean(externalLabOrders.find((ord) => unreadStatuses.includes(ord.orderStatus))),
      orders: externalLabOrders.map((order) => ({
        fhirResourceId: order.serviceRequestId,
        itemDescription: order.testItem,
        detailPageUrl: getExternalLabOrderEditUrl(appointment.id, order.serviceRequestId),
        statusChip: <LabsOrderStatusChip status={order.orderStatus} />,
        unreadBadge: unreadStatuses.includes(order.orderStatus),
      })),
    };
    orderConfigs.push(externalLabOrderConfig);
  }

  if (inHouseLabOrders?.length) {
    const unreadStatuses: TestStatus[] = ['ORDERED', 'COLLECTED', 'FINAL']; // todo this is all statuses possible, is it ok that all of them are 'unread'?
    const inHouseLabOrderConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['In-House Labs'],
      title: 'In-House Labs',
      tableUrl: getInHouseLabsUrl(appointment.id),
      unreadBadge: Boolean(inHouseLabOrders.find((ord) => unreadStatuses.includes(ord.status))),
      orders: inHouseLabOrders.map((order) => ({
        fhirResourceId: order.serviceRequestId,
        itemDescription: order.testItemName,
        detailPageUrl: getInHouseLabOrderDetailsUrl(appointment.id, order.serviceRequestId),
        statusChip: <InHouseLabsStatusChip status={order.status} />,
        unreadBadge: unreadStatuses.includes(order.status),
      })),
    };
    orderConfigs.push(inHouseLabOrderConfig);
  }

  if (nursingOrders?.length) {
    const unreadStatuses = [NursingOrdersStatus.pending];
    const nursingOrdersConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['Nursing Orders'],
      title: 'Nursing Orders',
      tableUrl: getNursingOrdersUrl(appointment.id),
      unreadBadge: Boolean(nursingOrders.find((ord) => unreadStatuses.includes(ord.status))),
      orders: nursingOrders
        .filter((order) => order.status !== NursingOrdersStatus.cancelled)
        .map((order) => ({
          fhirResourceId: order.serviceRequestId,
          itemDescription: order.note,
          detailPageUrl: getNursingOrderDetailsUrl(appointment.id, order.serviceRequestId),
          statusChip: <NursingOrdersStatusChip status={order.status} />,
          unreadBadge: unreadStatuses.includes(order.status),
        })),
    };
    if (nursingOrdersConfig.orders.length > 0) orderConfigs.push(nursingOrdersConfig);
  }

  if (filteredInHouseMedications?.length) {
    const unreadStatuses = [MedicationOrderStatuses.pending];
    const inHouseMedicationConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['Med. Administration'],
      title: 'In-House Medications',
      tableUrl: getInHouseMedicationMARUrl(appointment.id),
      unreadBadge: Boolean(
        filteredInHouseMedications.find((ord) => unreadStatuses.includes(ord.status as MedicationOrderStatuses))
      ),
      orders: filteredInHouseMedications.map((med) => {
        const isPending = med.status === 'pending';
        const targetUrl = isPending
          ? `${getInHouseMedicationDetailsUrl(appointment.id)}?scrollTo=${med.id}`
          : `${getInHouseMedicationMARUrl(appointment.id)}?scrollTo=${med.id}`;

        return {
          fhirResourceId: med.id,
          itemDescription: med.medicationName,
          detailPageUrl: targetUrl,
          statusChip: <MedicationStatusChip medication={med} />,
          unreadBadge: unreadStatuses.includes(med.status as MedicationOrderStatuses),
        };
      }),
    };
    orderConfigs.push(inHouseMedicationConfig);
  }

  if (radiologyOrders?.length) {
    const unreadStatuses = [RadiologyOrderStatus.pending, RadiologyOrderStatus.preliminary, RadiologyOrderStatus.final];
    const radiologyOrdersConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['Radiology'],
      title: 'Radiology Orders',
      tableUrl: getRadiologyUrl(appointment.id),
      unreadBadge: Boolean(radiologyOrders.find((ord) => unreadStatuses.includes(ord.status))),
      orders: radiologyOrders.map((order) => ({
        fhirResourceId: order.serviceRequestId,
        itemDescription: order.studyType,
        detailPageUrl: getRadiologyOrderEditUrl(appointment.id, order.serviceRequestId),
        statusChip: <RadiologyTableStatusChip status={order.status} />,
        unreadBadge: unreadStatuses.includes(order.status),
      })),
    };
    orderConfigs.push(radiologyOrdersConfig);
  }

  if (erxOrders?.length) {
    const ordersConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['eRX'],
      title: 'eRx',
      tableUrl: getErxUrl(appointment.id),
      orders: erxOrders.map((order) => ({
        fhirResourceId: order.resourceId ?? '',
        itemDescription: order.name ?? '',
        detailPageUrl: getErxUrl(appointment.id),
        statusChip: <MappedStatusChip status={order.status ?? 'unknown'} mapper={medicationStatusMapper} />,
      })),
    };
    orderConfigs.push(ordersConfig);
  }

  return (
    <GenericToolTip title={<OrdersToolTip orderConfigs={orderConfigs} />} customWidth="none" placement="top">
      <Box sx={{ display: 'flex', width: '100%' }}>
        {orderConfigs.map((config) => {
          const button = (
            <Link to={config.tableUrl} style={{ textDecoration: 'none' }}>
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
          );
          return (
            <Box key={`${config.title}-icon-indicator`}>
              {config.unreadBadge ? (
                <Badge
                  variant="dot"
                  color="warning"
                  sx={{
                    '& .MuiBadge-badge': {
                      width: '9px',
                      height: '9px',
                      borderRadius: '10px',
                      top: '4px',
                      right: '11px',
                    },
                  }}
                >
                  {button}
                </Badge>
              ) : (
                button
              )}
            </Box>
          );
        })}
      </Box>
    </GenericToolTip>
  );
};
