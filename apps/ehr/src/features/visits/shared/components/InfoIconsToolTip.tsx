import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import { Box } from '@mui/material';
import { displayOrdersToolTip } from 'src/helpers';
import { otherColors } from 'src/themes/ottehr/colors';
import { InPersonAppointmentInformation, OrdersForTrackingBoardRow } from 'utils';
import { ApptTab } from '../../../../components/AppointmentTabs';
import { GenericToolTip, PaperworkToolTipContent } from '../../../../components/GenericToolTip';
import { OrdersIconsToolTip } from './OrdersIconsToolTip';

interface InfoIconsToolTipProps {
  appointment: InPersonAppointmentInformation;
  tab: ApptTab;
  orders: OrdersForTrackingBoardRow;
}
export const InfoIconsToolTip: React.FC<InfoIconsToolTipProps> = ({ appointment, tab, orders }) => {
  const ordersToolTip = displayOrdersToolTip(appointment, tab);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'left', height: '100%' }}>
      {ordersToolTip ? (
        <OrdersIconsToolTip appointment={appointment} orders={orders} />
      ) : (
        // Visit Components
        <GenericToolTip title={<PaperworkToolTipContent appointment={appointment} />} customWidth="none">
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: 0.5 }}>
            <AccountCircleOutlinedIcon
              sx={{ color: appointment.paperwork.demographics ? '#43A047' : '#BFC2C6' }}
              fill={otherColors.cardChip}
            />

            <HealthAndSafetyOutlinedIcon
              sx={{ color: appointment.paperwork.insuranceCard ? '#43A047' : '#BFC2C6' }}
              fill={otherColors.cardChip}
            />

            <BadgeOutlinedIcon
              sx={{ color: appointment.paperwork.photoID ? '#43A047' : '#BFC2C6' }}
              fill={otherColors.cardChip}
            />

            <AssignmentTurnedInOutlinedIcon
              sx={{ color: appointment.paperwork.consent ? '#43A047' : '#BFC2C6' }}
              fill={otherColors.cardChip}
            />
          </Box>
        </GenericToolTip>
      )}
    </div>
  );
};
