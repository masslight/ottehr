import { SvgIcon, SvgIconOwnProps } from '@mui/material';

export const FeeSchedulesIcon = (props: SvgIconOwnProps): React.ReactElement => (
  <SvgIcon viewBox="0 0 24 24" {...props}>
    <mask
      id="fee-schedules-icon-mask"
      style={{ maskType: 'alpha' }}
      maskUnits="userSpaceOnUse"
      x="0"
      y="0"
      width="24"
      height="24"
    >
      <rect width="24" height="24" fill="#D9D9D9" />
    </mask>
    <g mask="url(#fee-schedules-icon-mask)">
      <path d="M15 22V20H19V10H5V14H3V6C3 5.45 3.19583 4.97917 3.5875 4.5875C3.97917 4.19583 4.45 4 5 4H6V2H8V4H16V2H18V4H19C19.55 4 20.0208 4.19583 20.4125 4.5875C20.8042 4.97917 21 5.45 21 6V20C21 20.55 20.8042 21.0208 20.4125 21.4125C20.0208 21.8042 19.55 22 19 22H15ZM8 24L6.6 22.6L9.175 20H1V18H9.175L6.6 15.4L8 14L13 19L8 24ZM5 8H19V6H5V8Z" />
    </g>
  </SvgIcon>
);
