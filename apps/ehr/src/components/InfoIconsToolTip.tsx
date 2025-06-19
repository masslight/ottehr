import { Box } from '@mui/material';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import { otherColors } from 'src/themes/ottehr/colors';
import { GenericToolTip, PaperworkToolTipContent } from './GenericToolTip';
import { InHouseOrderListPageItemDTO, InPersonAppointmentInformation, LabOrderListPageDTO } from 'utils';
import { OrdersIconsToolTip } from './OrdersIconsToolTip';
import { displayOrdersToolTip } from 'src/helpers';
import { ApptTab } from './AppointmentTabs';

interface InfoIconsToolTipProps {
  appointment: InPersonAppointmentInformation;
  tab: ApptTab;
  inHouseLabOrders: InHouseOrderListPageItemDTO[] | undefined;
  externalLabOrders: LabOrderListPageDTO[] | undefined;
}
export const InfoIconsToolTip: React.FC<InfoIconsToolTipProps> = ({
  appointment,
  tab,
  inHouseLabOrders,
  externalLabOrders,
}) => {
  const ordersToolTip = displayOrdersToolTip(appointment, tab);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'left', height: '100%' }}>
      {ordersToolTip ? (
        <OrdersIconsToolTip
          appointment={appointment}
          externalLabOrders={externalLabOrders}
          inHouseLabOrders={inHouseLabOrders}
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
