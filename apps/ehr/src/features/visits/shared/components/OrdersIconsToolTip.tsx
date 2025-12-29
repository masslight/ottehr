import { Box } from '@mui/material';
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
  InPersonAppointmentInformation,
  NursingOrdersStatus,
  OrdersForTrackingBoardRow,
  OrderToolTipConfig,
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

  const orderConfigs: OrderToolTipConfig[] = [];

  if (externalLabOrders?.length) {
    const externalLabOrderConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['External Labs'],
      title: 'External Labs',
      tableUrl: getExternalLabOrdersUrl(appointment.id),
      orders: externalLabOrders.map((order) => ({
        fhirResourceId: order.serviceRequestId,
        itemDescription: order.testItem,
        detailPageUrl: getExternalLabOrderEditUrl(appointment.id, order.serviceRequestId),
        statusChip: <LabsOrderStatusChip status={order.orderStatus} />,
      })),
    };
    orderConfigs.push(externalLabOrderConfig);
  }

  if (inHouseLabOrders?.length) {
    const inHouseLabOrderConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['In-House Labs'],
      title: 'In-House Labs',
      tableUrl: getInHouseLabsUrl(appointment.id),
      orders: inHouseLabOrders.map((order) => ({
        fhirResourceId: order.serviceRequestId,
        itemDescription: order.testItemName,
        detailPageUrl: getInHouseLabOrderDetailsUrl(appointment.id, order.serviceRequestId),
        statusChip: <InHouseLabsStatusChip status={order.status} />,
      })),
    };
    orderConfigs.push(inHouseLabOrderConfig);
  }

  if (nursingOrders?.length) {
    const nursingOrdersConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['Nursing Orders'],
      title: 'Nursing Orders',
      tableUrl: getNursingOrdersUrl(appointment.id),
      orders: nursingOrders
        .filter((order) => order.status !== NursingOrdersStatus.cancelled)
        .map((order) => ({
          fhirResourceId: order.serviceRequestId,
          itemDescription: order.note,
          detailPageUrl: getNursingOrderDetailsUrl(appointment.id, order.serviceRequestId),
          statusChip: <NursingOrdersStatusChip status={order.status} />,
        })),
    };
    if (nursingOrdersConfig.orders.length > 0) orderConfigs.push(nursingOrdersConfig);
  }

  if (inHouseMedications?.length) {
    const inHouseMedicationConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['Med. Administration'],
      title: 'In-House Medications',
      tableUrl: getInHouseMedicationMARUrl(appointment.id),
      orders: inHouseMedications.map((med) => {
        const isPending = med.status === 'pending';
        const targetUrl = isPending
          ? `${getInHouseMedicationDetailsUrl(appointment.id)}?scrollTo=${med.id}`
          : `${getInHouseMedicationMARUrl(appointment.id)}?scrollTo=${med.id}`;

        return {
          fhirResourceId: med.id,
          itemDescription: med.medicationName,
          detailPageUrl: targetUrl,
          statusChip: <MedicationStatusChip medication={med} />,
        };
      }),
    };
    orderConfigs.push(inHouseMedicationConfig);
  }

  if (radiologyOrders?.length) {
    const radiologyOrdersConfig: OrderToolTipConfig = {
      icon: sidebarMenuIcons['Radiology'],
      title: 'Radiology Orders',
      tableUrl: getRadiologyUrl(appointment.id),
      orders: radiologyOrders.map((order) => ({
        fhirResourceId: order.serviceRequestId,
        itemDescription: order.studyType,
        detailPageUrl: getRadiologyOrderEditUrl(appointment.id, order.serviceRequestId),
        statusChip: <RadiologyTableStatusChip status={order.status} />,
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
