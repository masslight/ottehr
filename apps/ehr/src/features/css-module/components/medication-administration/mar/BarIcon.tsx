import { SvgIcon, SvgIconOwnProps } from '@mui/material';

export const BarIcon = (props: SvgIconOwnProps): React.ReactElement => {
  return (
    <SvgIcon
      viewBox="0 0 18 18"
      sx={{
        ...props.sx,
      }}
    >
      <mask id="a" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="18" height="18">
        <path fill="#D9D9D9" d="M0 0h18v18H0z" />
      </mask>
      <g mask="url(#a)">
        <path d="M.75 15.75V12h1.5v2.25H4.5v1.5H.75Zm12.75 0v-1.5h2.25V12h1.5v3.75H13.5ZM3 13.5v-9h1.5v9H3Zm2.25 0v-9H6v9h-.75Zm2.25 0v-9H9v9H7.5Zm2.25 0v-9H12v9H9.75Zm3 0v-9h.75v9h-.75Zm1.5 0v-9H15v9h-.75ZM.75 6V2.25H4.5v1.5H2.25V6H.75Zm15 0V3.75H13.5v-1.5h3.75V6h-1.5Z" />
      </g>
    </SvgIcon>
  );
};
