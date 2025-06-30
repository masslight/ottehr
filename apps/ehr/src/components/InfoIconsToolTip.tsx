import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import { Box } from '@mui/material';
import { displayOrdersToolTip } from 'src/helpers';
import { otherColors } from 'src/themes/ottehr/colors';
import { InHouseOrderListPageItemDTO, InPersonAppointmentInformation, LabOrderListPageDTO, NursingOrder } from 'utils';
import { ApptTab } from './AppointmentTabs';
import { GenericToolTip, PaperworkToolTipContent } from './GenericToolTip';
import { OrdersIconsToolTip } from './OrdersIconsToolTip';

interface InfoIconsToolTipProps {
  appointment: InPersonAppointmentInformation;
  tab: ApptTab;
  inHouseLabOrders: InHouseOrderListPageItemDTO[] | undefined;
  externalLabOrders: LabOrderListPageDTO[] | undefined;
  nursingOrders: NursingOrder[] | undefined;
}
export const InfoIconsToolTip: React.FC<InfoIconsToolTipProps> = ({
  appointment,
  tab,
  inHouseLabOrders,
  externalLabOrders,
  nursingOrders,
}) => {
  const ordersToolTip = displayOrdersToolTip(appointment, tab);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'left', height: '100%' }}>
      {ordersToolTip ? (
        <OrdersIconsToolTip
          appointment={appointment}
          externalLabOrders={externalLabOrders}
          inHouseLabOrders={inHouseLabOrders}
          nursingOrders={nursingOrders}
        />
      ) : (
        // Visit Components
        <GenericToolTip title={<PaperworkToolTipContent appointment={appointment} />} customWidth="none">
          <Box sx={{ display: 'flex', gap: 0 }}>
            <AccountCircleOutlinedIcon
              sx={{ ml: 0, mr: 0.5, color: appointment.paperwork.demographics ? '#43A047' : '#BFC2C6' }}
              fill={otherColors.cardChip}
            ></AccountCircleOutlinedIcon>

            <HealthAndSafetyOutlinedIcon
              sx={{ mx: 0.5, color: appointment.paperwork.insuranceCard ? '#43A047' : '#BFC2C6' }}
              fill={otherColors.cardChip}
            ></HealthAndSafetyOutlinedIcon>

            <BadgeOutlinedIcon
              sx={{ mx: 0.5, color: appointment.paperwork.photoID ? '#43A047' : '#BFC2C6' }}
              fill={otherColors.cardChip}
            ></BadgeOutlinedIcon>

            <AssignmentTurnedInOutlinedIcon
              sx={{ mx: 0.5, color: appointment.paperwork.consent ? '#43A047' : '#BFC2C6' }}
              fill={otherColors.cardChip}
            ></AssignmentTurnedInOutlinedIcon>
          </Box>
        </GenericToolTip>
      )}
    </div>
  );
};
