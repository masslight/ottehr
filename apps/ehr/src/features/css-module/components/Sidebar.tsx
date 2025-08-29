import { otherColors } from '@ehrTheme/colors';
import { ottehrAiIcon } from '@ehrTheme/icons';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import { alpha, Button, Drawer, IconButton, List, ListItem, ListItemIcon, ListItemText, styled } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { handleChangeInPersonVisitStatus } from 'src/helpers/inPersonVisitStatusUtils';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { getAdmitterPractitionerId, getVisitStatus, PRACTITIONER_CODINGS } from 'utils';
import { dataTestIds } from '../../../constants/data-test-ids';
import { useAppointmentData, useChartData } from '../../../telemed';
import { RouteCSS, useNavigationContext } from '../context/NavigationContext';
import { usePractitionerActions } from '../hooks/usePractitioner';
import { ROUTER_PATH, routesCSS } from '../routing/routesCSS';
import { CompleteIntakeButton } from './CompleteIntakeButton';

const ArrowIcon = ({ direction }: { direction: 'left' | 'right' }): React.ReactElement => (
  <svg width="9" height="18" viewBox="0 0 9 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d={direction === 'right' ? 'M0 18V0H2V18H0ZM4 14V4L9 9L4 14Z' : 'M5 14V4L0 9L5 14ZM7 18H9V0H7V18Z'}
      fill="#2169F5"
    />
  </svg>
);

export const sidebarMenuIcons = {
  'Progress Note': (
    <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15 15c.417 0 .77-.146 1.063-.438.291-.291.437-.645.437-1.062 0-.417-.146-.77-.438-1.063A1.446 1.446 0 0 0 15 12c-.417 0-.77.146-1.063.438A1.446 1.446 0 0 0 13.5 13.5c0 .417.146.77.438 1.063.291.291.645.437 1.062.437Zm0 3c.5 0 .967-.117 1.4-.35a3.011 3.011 0 0 0 1.075-.975 4.455 4.455 0 0 0-1.2-.512 5.048 5.048 0 0 0-2.55 0c-.417.108-.817.279-1.2.512.283.417.642.742 1.075.975.433.233.9.35 1.4.35ZM2 18c-.55 0-1.02-.196-1.413-.587A1.926 1.926 0 0 1 0 16V2C0 1.45.196.98.588.587A1.926 1.926 0 0 1 2 0h14c.55 0 1.02.196 1.413.588C17.803.979 18 1.45 18 2v6.7a8.189 8.189 0 0 0-.975-.387A6.101 6.101 0 0 0 16 8.075V2H2v14h6.05c.05.367.13.717.237 1.05.109.333.238.65.388.95H2Zm0-2V2v6.075V8v8Zm2-2h4.075c.05-.35.13-.692.238-1.025.108-.333.229-.658.362-.975H4v2Zm0-4h6.1c.533-.5 1.13-.917 1.787-1.25A7.041 7.041 0 0 1 14 8.075V8H4v2Zm0-4h10V4H4v2Zm11 14c-1.383 0-2.563-.488-3.537-1.462C10.488 17.562 10 16.383 10 15s.488-2.563 1.463-3.537C12.438 10.488 13.617 10 15 10s2.563.488 3.538 1.463C19.512 12.438 20 13.617 20 15s-.488 2.563-1.462 3.538C17.562 19.512 16.383 20 15 20Z"
        fill="currentColor"
      />
    </svg>
  ),
  Patient: (
    <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M18.5 19.5 20 21M4 21a7 7 0 0 1 7-7m8 3.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  'Reason for Visit': (
    <svg width="18" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 16c.283 0 .52-.096.713-.287A.968.968 0 0 0 10 15a.968.968 0 0 0-.287-.713A.967.967 0 0 0 9 14a.967.967 0 0 0-.713.287A.968.968 0 0 0 8 15c0 .283.096.52.287.713.192.191.43.287.713.287Zm-1-4h2V6H8v6Zm-6 8c-.55 0-1.02-.196-1.413-.587A1.926 1.926 0 0 1 0 18V4c0-.55.196-1.02.588-1.413A1.926 1.926 0 0 1 2 2h4.2c.217-.6.58-1.083 1.087-1.45A2.857 2.857 0 0 1 9 0c.633 0 1.204.183 1.713.55.508.367.87.85 1.087 1.45H16c.55 0 1.02.196 1.413.587C17.803 2.98 18 3.45 18 4v14c0 .55-.196 1.02-.587 1.413A1.926 1.926 0 0 1 16 20H2Zm0-2h14V4H2v14ZM9 3.25a.728.728 0 0 0 .75-.75.728.728 0 0 0-.75-.75.728.728 0 0 0-.75.75.728.728 0 0 0 .75.75Z"
        fill="currentColor"
      />
    </svg>
  ),
  'Screening Questions': (
    <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 13c.283 0 .53-.104.738-.313.208-.208.312-.454.312-.737s-.104-.53-.313-.737A1.009 1.009 0 0 0 12 10.9c-.283 0-.53.104-.738.313a1.009 1.009 0 0 0-.312.737c0 .283.104.53.313.738.208.208.454.312.737.312Zm-.75-3.2h1.5c0-.483.05-.838.15-1.063.1-.225.333-.52.7-.887.5-.5.833-.904 1-1.212.167-.309.25-.671.25-1.088 0-.75-.262-1.362-.787-1.837C13.537 3.236 12.85 3 12 3c-.683 0-1.28.192-1.787.575A2.982 2.982 0 0 0 9.15 5.1l1.35.55c.15-.417.354-.73.613-.938.258-.208.554-.312.887-.312.4 0 .725.112.975.337.25.226.375.53.375.913 0 .233-.067.454-.2.662-.133.209-.367.471-.7.788-.55.483-.887.863-1.012 1.138-.126.274-.188.795-.188 1.562ZM6 16c-.55 0-1.02-.196-1.412-.588A1.926 1.926 0 0 1 4 14V2c0-.55.196-1.02.588-1.413A1.926 1.926 0 0 1 6 0h12c.55 0 1.02.196 1.413.588C19.803.979 20 1.45 20 2v12c0 .55-.196 1.02-.587 1.412A1.926 1.926 0 0 1 18 16H6Zm0-2h12V2H6v12Zm-4 6c-.55 0-1.02-.196-1.413-.587A1.926 1.926 0 0 1 0 18V4h2v14h14v2H2Z"
        fill="currentColor"
      />
    </svg>
  ),
  Vitals: (
    <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 20v-5H0V5h5V0h10v5h5v10h-5v5H5ZM2 9h5c.167 0 .325.042.475.125.15.083.267.192.35.325l.875 1.3 1.35-4.05c.067-.2.188-.367.362-.5a.964.964 0 0 1 1.063-.075c.15.083.267.192.35.325l1.7 2.55H18V7h-5V2H7v5H2v2Zm5 9h6v-5h5v-2h-5a.964.964 0 0 1-.475-.125 1.177 1.177 0 0 1-.375-.325l-.85-1.3-1.35 4.05c-.067.2-.192.367-.375.5a.999.999 0 0 1-.6.2.964.964 0 0 1-.475-.125.942.942 0 0 1-.35-.325L6.45 11H2v2h5v5Z"
        fill="currentColor"
      />
    </svg>
  ),
  Allergies: (
    <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 20a9.738 9.738 0 0 1-3.9-.788 10.099 10.099 0 0 1-3.175-2.137c-.9-.9-1.612-1.958-2.137-3.175A9.738 9.738 0 0 1 0 10c0-1.383.263-2.683.787-3.9a10.099 10.099 0 0 1 2.138-3.175c.9-.9 1.958-1.612 3.175-2.137A9.738 9.738 0 0 1 10 0c1.383 0 2.683.263 3.9.787a10.098 10.098 0 0 1 3.175 2.138c.9.9 1.613 1.958 2.137 3.175A9.738 9.738 0 0 1 20 10a9.738 9.738 0 0 1-.788 3.9 10.098 10.098 0 0 1-2.137 3.175c-.9.9-1.958 1.613-3.175 2.137A9.738 9.738 0 0 1 10 20Zm0-2c.9 0 1.767-.146 2.6-.438a7.951 7.951 0 0 0 2.3-1.262L3.7 5.1a7.95 7.95 0 0 0-1.263 2.3A7.813 7.813 0 0 0 2 10c0 2.233.775 4.125 2.325 5.675C5.875 17.225 7.767 18 10 18Zm6.3-3.1c.55-.7.97-1.467 1.262-2.3.292-.833.438-1.7.438-2.6 0-2.233-.775-4.125-2.325-5.675C14.125 2.775 12.233 2 10 2c-.9 0-1.767.146-2.6.438A7.95 7.95 0 0 0 5.1 3.7l11.2 11.2Z"
        fill="currentColor"
      />
    </svg>
  ),
  Medications: (
    <svg width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5.625 18c-1.567 0-2.896-.546-3.987-1.637C.546 15.27 0 13.942 0 12.375A5.585 5.585 0 0 1 1.65 8.4L8.4 1.65A5.585 5.585 0 0 1 12.375 0c1.567 0 2.896.546 3.988 1.637C17.454 2.73 18 4.058 18 5.625A5.585 5.585 0 0 1 16.35 9.6L9.6 16.35A5.585 5.585 0 0 1 5.625 18Zm6.65-7.15L14.95 8.2A3.677 3.677 0 0 0 16 5.625c0-1-.354-1.854-1.063-2.563A3.492 3.492 0 0 0 12.376 2 3.677 3.677 0 0 0 9.8 3.05L7.15 5.725l5.125 5.125ZM5.625 16A3.677 3.677 0 0 0 8.2 14.95l2.65-2.675L5.725 7.15 3.05 9.8A3.677 3.677 0 0 0 2 12.375c0 1 .354 1.854 1.063 2.563A3.492 3.492 0 0 0 5.624 16Z"
        fill="currentColor"
      />
    </svg>
  ),
  'Medical Conditions': (
    <svg width="16" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 17h8v-2H4v2Zm0-3h8v-2H4v2Zm4-3.7c1.1-1 2.042-1.888 2.825-2.663C11.608 6.864 12 6.05 12 5.2c0-.6-.217-1.117-.65-1.55A2.116 2.116 0 0 0 9.8 3c-.35 0-.688.07-1.013.212A2.02 2.02 0 0 0 8 3.8a2.02 2.02 0 0 0-.787-.587A2.508 2.508 0 0 0 6.2 3c-.6 0-1.117.217-1.55.65C4.217 4.083 4 4.6 4 5.2c0 .85.38 1.65 1.138 2.4.758.75 1.712 1.65 2.862 2.7Zm6 9.7H2c-.55 0-1.02-.196-1.413-.587A1.926 1.926 0 0 1 0 18V2C0 1.45.196.98.588.587A1.926 1.926 0 0 1 2 0h12c.55 0 1.02.196 1.412.587C15.804.979 16 1.45 16 2v16c0 .55-.196 1.02-.588 1.413A1.926 1.926 0 0 1 14 20ZM2 18h12V2H2v16Z"
        fill="currentColor"
      />
    </svg>
  ),
  'Surgical History': (
    <svg width="21" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.4 12.35 7.65 8.6l8.3-8.3c.2-.2.438-.3.713-.3.274 0 .512.1.712.3L19.7 2.625c.2.2.3.438.3.712 0 .275-.1.513-.3.713l-8.3 8.3Zm0-2.85 6.2-6.175-.925-.925L10.5 8.6l.9.9ZM10 18l2-2h9v2H10Zm-5.925 0c-.767 0-1.504-.15-2.213-.45A5.813 5.813 0 0 1 0 16.3l6.625-6.6 2.6 2.6c.233.233.417.5.55.8a2.4 2.4 0 0 1 0 1.912c-.133.309-.317.58-.55.813l-.475.475a5.813 5.813 0 0 1-1.862 1.25c-.709.3-1.446.45-2.213.45h-.6Zm0-2h.6c.5 0 .983-.096 1.45-.287A3.704 3.704 0 0 0 7.35 14.9l.475-.475a.48.48 0 0 0 0-.7l-1.2-1.2-3.4 3.375a3.85 3.85 0 0 0 .85.1Z"
        fill="currentColor"
      />
    </svg>
  ),
  Hospitalization: (
    <svg width="16" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.5 14h3v-2.5H12v-3H9.5V6h-3v2.5H4v3h2.5V14ZM0 18V6l8-6 8 6v12H0Zm2-2h12V7L8 2.5 2 7v9Z"
        fill="currentColor"
      />
    </svg>
  ),
  'Med. Administration': (
    <svg width="14" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5.5 14.5h3V12H11V9H8.5V6.5h-3V9H3v3h2.5v2.5ZM2 18c-.55 0-1.02-.196-1.413-.587A1.926 1.926 0 0 1 0 16V5c0-.55.196-1.02.588-1.413A1.926 1.926 0 0 1 2 3h10c.55 0 1.02.196 1.412.587C13.804 3.98 14 4.45 14 5v11c0 .55-.196 1.02-.588 1.413A1.926 1.926 0 0 1 12 18H2Zm0-2h10V5H2v11ZM1 2V0h12v2H1Z"
        fill="currentColor"
      />
    </svg>
  ),
  Procedures: (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 8C6.9 8 5.95833 7.60833 5.175 6.825C4.39167 6.04167 4 5.1 4 4C4 2.9 4.39167 1.95833 5.175 1.175C5.95833 0.391667 6.9 0 8 0C9.1 0 10.0417 0.391667 10.825 1.175C11.6083 1.95833 12 2.9 12 4C12 5.1 11.6083 6.04167 10.825 6.825C10.0417 7.60833 9.1 8 8 8ZM8 6C8.55 6 9.02083 5.80417 9.4125 5.4125C9.80417 5.02083 10 4.55 10 4C10 3.45 9.80417 2.97917 9.4125 2.5875C9.02083 2.19583 8.55 2 8 2C7.45 2 6.97917 2.19583 6.5875 2.5875C6.19583 2.97917 6 3.45 6 4C6 4.55 6.19583 5.02083 6.5875 5.4125C6.97917 5.80417 7.45 6 8 6ZM0 20V13.225C0 12.6583 0.141667 12.1375 0.425 11.6625C0.708333 11.1875 1.1 10.8167 1.6 10.55C2.45 10.1167 3.4125 9.75 4.4875 9.45C5.5625 9.15 6.73333 9 8 9C9.26667 9 10.4375 9.15 11.5125 9.45C12.5875 9.75 13.55 10.1167 14.4 10.55C14.9 10.8167 15.2917 11.1875 15.575 11.6625C15.8583 12.1375 16 12.6583 16 13.225V18C16 18.55 15.8042 19.0208 15.4125 19.4125C15.0208 19.8042 14.55 20 14 20H5.75C4.98333 20 4.33333 19.7333 3.8 19.2C3.26667 18.6667 3 18.0167 3 17.25C3 16.4833 3.26667 15.8333 3.8 15.3C4.33333 14.7667 4.98333 14.5 5.75 14.5H8.575L10.125 11.2C9.79167 11.1333 9.45 11.0833 9.1 11.05C8.75 11.0167 8.38333 11 8 11C6.8 11 5.73333 11.1458 4.8 11.4375C3.86667 11.7292 3.10833 12.0333 2.525 12.35C2.35833 12.4333 2.22917 12.5542 2.1375 12.7125C2.04583 12.8708 2 13.0417 2 13.225V20H0ZM5.75 18H6.95L7.65 16.5H5.75C5.55 16.5 5.375 16.575 5.225 16.725C5.075 16.875 5 17.05 5 17.25C5 17.45 5.075 17.625 5.225 17.775C5.375 17.925 5.55 18 5.75 18ZM9.15 18H14V13.225C14 13.0417 13.9542 12.8708 13.8625 12.7125C13.7708 12.5542 13.65 12.4333 13.5 12.35C13.3 12.25 13.0833 12.1458 12.85 12.0375C12.6167 11.9292 12.3667 11.825 12.1 11.725L9.15 18Z"
        fill="currentColor"
      />
    </svg>
  ),
  Labs: (
    <svg width="22" height="21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7 15v-2h2.175a5.727 5.727 0 0 0-.15 2H7Zm0 5c-1.383 0-2.563-.488-3.538-1.462C2.487 17.562 2 16.383 2 15V6C1.45 6 .98 5.804.587 5.412A1.926 1.926 0 0 1 0 4V2C0 1.45.196.98.588.587A1.926 1.926 0 0 1 2 0h10c.55 0 1.02.196 1.412.588C13.804.979 14 1.45 14 2v2c0 .55-.196 1.02-.588 1.412A1.926 1.926 0 0 1 12 6v3.025A6.19 6.19 0 0 0 10.025 11H7V9h3V6H4v9c0 .833.292 1.542.875 2.125A2.893 2.893 0 0 0 7 18c.5 0 .954-.108 1.363-.325a3.065 3.065 0 0 0 1.037-.9c.133.333.283.65.45.95.167.3.367.592.6.875-.45.433-.967.775-1.55 1.025A4.772 4.772 0 0 1 7 20ZM2 4h10V2H2v2Zm13.5 13c.7 0 1.292-.242 1.775-.725.483-.483.725-1.075.725-1.775s-.242-1.292-.725-1.775C16.792 12.242 16.2 12 15.5 12s-1.292.242-1.775.725C13.242 13.208 13 13.8 13 14.5s.242 1.292.725 1.775c.483.483 1.075.725 1.775.725Zm5.1 4-2.7-2.7c-.367.233-.75.408-1.15.525A4.44 4.44 0 0 1 15.5 19c-1.25 0-2.313-.438-3.188-1.313C11.438 16.813 11 15.75 11 14.5c0-1.25.438-2.313 1.313-3.188C13.187 10.438 14.25 10 15.5 10c1.25 0 2.313.438 3.188 1.313C19.563 12.187 20 13.25 20 14.5c0 .433-.058.85-.175 1.25-.117.4-.292.783-.525 1.15l2.7 2.7-1.4 1.4Z"
        fill="currentColor"
      />
    </svg>
  ),
  Radiology: (
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="none">
      <path
        d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-560H200v560Zm160 0v-72l-72-84q-11-11-19.5-30t-8.5-44q0-13 2.5-25.5T271-440q-5-11-8-23.5t-3-26.5q0-25 8.5-44t19.5-30l72-84v-72h60v83q0 5-7 19l-80 94q-7 8-10 16.5t-3 17.5q0 20 13 34.5t33 14.5q9 0 17-3t14-10q17-17 38.5-26t44.5-9q23 0 44.5 9t38.5 26q7 7 15 10t16 3q20 0 33-14.5t13-33.5q0-9-3.5-17.5T627-523l-80-95q-4-4-5.5-9t-1.5-10v-83h60v72l73 86q14 16 20.5 34.5T700-489q0 13-3.5 25.5T688-440q6 12 9 24.5t3 25.5q0 25-8.5 44T672-316l-72 84v72h-60v-83q0-6 7-19l80-94q7-8 10-17t3-18q-11 5-22 7.5t-23 2.5q-20 0-40-8t-35-24q-7-8-17.5-12t-22.5-4q-11 0-21.5 4T440-413q-15 16-34.5 24t-39.5 8q-12 0-23.5-2.5T320-391q0 9 3 18t10 17l80 94q3 5 5 9.5t2 9.5v83h-60Zm-160 0v-560 560Z"
        fill="currentColor"
      />
    </svg>
  ),
  eRX: (
    <svg width="20" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="m13.95 19.65 1.15-1.15-1.6-1.6-1.15 1.15c-.233.233-.35.5-.35.8 0 .3.117.567.35.8.233.233.5.35.8.35.3 0 .567-.117.8-.35Zm2.55-2.55 1.15-1.15c.233-.233.35-.5.35-.8 0-.3-.117-.567-.35-.8-.233-.233-.5-.35-.8-.35-.3 0-.567.117-.8.35L14.9 15.5l1.6 1.6Zm-1.125 3.975A3.033 3.033 0 0 1 13.15 22a3.033 3.033 0 0 1-2.225-.925A3.033 3.033 0 0 1 10 18.85c0-.867.308-1.608.925-2.225l3.7-3.7A3.033 3.033 0 0 1 16.85 12c.867 0 1.608.308 2.225.925S20 14.283 20 15.15s-.308 1.608-.925 2.225l-3.7 3.7ZM2 20c-.55 0-1.02-.196-1.413-.587A1.926 1.926 0 0 1 0 18V4c0-.55.196-1.02.588-1.413A1.926 1.926 0 0 1 2 2h4.2c.217-.6.58-1.083 1.087-1.45A2.857 2.857 0 0 1 9 0c.633 0 1.204.183 1.713.55.508.367.87.85 1.087 1.45H16c.55 0 1.02.196 1.413.587C17.803 2.98 18 3.45 18 4v6.125A4.111 4.111 0 0 0 17 10c-.333 0-.667.025-1 .075V4H2v14h6.075c-.05.333-.075.667-.075 1 0 .333.042.667.125 1H2ZM9 3.25a.728.728 0 0 0 .75-.75.728.728 0 0 0-.75-.75.728.728 0 0 0-.75.75.728.728 0 0 0 .75.75ZM4 8V6h10v2H4Zm0 4v-2h10v.85c-.133.083-.262.18-.387.287-.125.109-.255.23-.388.363l-.5.5H4Zm0 4v-2h6.725L9.5 15.225a7.451 7.451 0 0 0-.363.388A3.106 3.106 0 0 0 8.85 16H4Z"
        fill="currentColor"
      />
    </svg>
  ),
  'External Labs': <BiotechOutlinedIcon></BiotechOutlinedIcon>,
  Stethoscope: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.5 20C9.7 20 8.16667 19.3667 6.9 18.1C5.63333 16.8333 5 15.3 5 13.5V12.925C3.56667 12.6917 2.375 12.0208 1.425 10.9125C0.475 9.80417 0 8.5 0 7V1H3V0H5V4H3V3H2V7C2 8.1 2.39167 9.04167 3.175 9.825C3.95833 10.6083 4.9 11 6 11C7.1 11 8.04167 10.6083 8.825 9.825C9.60833 9.04167 10 8.1 10 7V3H9V4H7V0H9V1H12V7C12 8.5 11.525 9.80417 10.575 10.9125C9.625 12.0208 8.43333 12.6917 7 12.925V13.5C7 14.75 7.4375 15.8125 8.3125 16.6875C9.1875 17.5625 10.25 18 11.5 18C12.75 18 13.8125 17.5625 14.6875 16.6875C15.5625 15.8125 16 14.75 16 13.5V11.825C15.4167 11.625 14.9375 11.2667 14.5625 10.75C14.1875 10.2333 14 9.65 14 9C14 8.16667 14.2917 7.45833 14.875 6.875C15.4583 6.29167 16.1667 6 17 6C17.8333 6 18.5417 6.29167 19.125 6.875C19.7083 7.45833 20 8.16667 20 9C20 9.65 19.8125 10.2333 19.4375 10.75C19.0625 11.2667 18.5833 11.625 18 11.825V13.5C18 15.3 17.3667 16.8333 16.1 18.1C14.8333 19.3667 13.3 20 11.5 20ZM17 10C17.2833 10 17.5208 9.90417 17.7125 9.7125C17.9042 9.52083 18 9.28333 18 9C18 8.71667 17.9042 8.47917 17.7125 8.2875C17.5208 8.09583 17.2833 8 17 8C16.7167 8 16.4792 8.09583 16.2875 8.2875C16.0958 8.47917 16 8.71667 16 9C16 9.28333 16.0958 9.52083 16.2875 9.7125C16.4792 9.90417 16.7167 10 17 10Z"
        fill="currentColor"
      />
    </svg>
  ),
  Prescription: (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13.95 19.65L15.1 18.5L13.5 16.9L12.35 18.05C12.1167 18.2833 12 18.55 12 18.85C12 19.15 12.1167 19.4167 12.35 19.65C12.5833 19.8833 12.85 20 13.15 20C13.45 20 13.7167 19.8833 13.95 19.65ZM16.5 17.1L17.65 15.95C17.8833 15.7167 18 15.45 18 15.15C18 14.85 17.8833 14.5833 17.65 14.35C17.4167 14.1167 17.15 14 16.85 14C16.55 14 16.2833 14.1167 16.05 14.35L14.9 15.5L16.5 17.1ZM15.375 21.075C14.7583 21.6917 14.0167 22 13.15 22C12.2833 22 11.5417 21.6917 10.925 21.075C10.3083 20.4583 10 19.7167 10 18.85C10 17.9833 10.3083 17.2417 10.925 16.625L14.625 12.925C15.2417 12.3083 15.9833 12 16.85 12C17.7167 12 18.4583 12.3083 19.075 12.925C19.6917 13.5417 20 14.2833 20 15.15C20 16.0167 19.6917 16.7583 19.075 17.375L15.375 21.075ZM2 20C1.45 20 0.979167 19.8042 0.5875 19.4125C0.195833 19.0208 0 18.55 0 18V4C0 3.45 0.195833 2.97917 0.5875 2.5875C0.979167 2.19583 1.45 2 2 2H6.2C6.41667 1.4 6.77917 0.916667 7.2875 0.55C7.79583 0.183333 8.36667 0 9 0C9.63333 0 10.2042 0.183333 10.7125 0.55C11.2208 0.916667 11.5833 1.4 11.8 2H16C16.55 2 17.0208 2.19583 17.4125 2.5875C17.8042 2.97917 18 3.45 18 4V10.125C17.6667 10.0417 17.3333 10 17 10C16.6667 10 16.3333 10.025 16 10.075V4H2V18H8.075C8.025 18.3333 8 18.6667 8 19C8 19.3333 8.04167 19.6667 8.125 20H2ZM9 3.25C9.21667 3.25 9.39583 3.17917 9.5375 3.0375C9.67917 2.89583 9.75 2.71667 9.75 2.5C9.75 2.28333 9.67917 2.10417 9.5375 1.9625C9.39583 1.82083 9.21667 1.75 9 1.75C8.78333 1.75 8.60417 1.82083 8.4625 1.9625C8.32083 2.10417 8.25 2.28333 8.25 2.5C8.25 2.71667 8.32083 2.89583 8.4625 3.0375C8.60417 3.17917 8.78333 3.25 9 3.25ZM4 8V6H14V8H4ZM4 12V10H14V10.85C13.8667 10.9333 13.7375 11.0292 13.6125 11.1375C13.4875 11.2458 13.3583 11.3667 13.225 11.5L12.725 12H4ZM4 16V14H10.725L9.5 15.225C9.36667 15.3583 9.24583 15.4875 9.1375 15.6125C9.02917 15.7375 8.93333 15.8667 8.85 16H4Z"
        fill="currentColor"
      />
    </svg>
  ),
  'Lab profile': (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 10V8H12V10H4ZM4 6V4H12V6H4ZM2 12H9.5C9.98333 12 10.4333 12.1042 10.85 12.3125C11.2667 12.5208 11.6167 12.8167 11.9 13.2L14 15.95V2H2V12ZM2 18H13.05L10.325 14.425C10.225 14.2917 10.1042 14.1875 9.9625 14.1125C9.82083 14.0375 9.66667 14 9.5 14H2V18ZM14 20H2C1.45 20 0.979167 19.8042 0.5875 19.4125C0.195833 19.0208 0 18.55 0 18V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H14C14.55 0 15.0208 0.195833 15.4125 0.5875C15.8042 0.979167 16 1.45 16 2V18C16 18.55 15.8042 19.0208 15.4125 19.4125C15.0208 19.8042 14.55 20 14 20Z"
        fill="currentColor"
      />
    </svg>
  ),
  'Oystehr AI': <img src={ottehrAiIcon} style={{ width: '22px' }} />,
  'In-House Labs': (
    <svg width="14" height="20" viewBox="0 0 14 20" xmlns="http://www.w3.org/2000/svg" fill="none">
      <path
        fill="currentColor"
        d="M7 20c-1.4 0-2.6-.5-3.5-1.5-1-1-1.5-2.1-1.5-3.5V6a2 2 0 0 1-1.4-.6A2 2 0 0 1 0 4V2C0 1.4.2 1 .6.6A2 2 0 0 1 2 0h10c.6 0 1 .2 1.4.6.4.4.6.8.6 1.4v2c0 .5-.2 1-.6 1.4A2 2 0 0 1 12 6v9c0 1.4-.5 2.6-1.5 3.5-1 1-2.1 1.5-3.5 1.5ZM2 4h10V2H2v2Zm5 14c.8 0 1.5-.3 2.1-.9.6-.6.9-1.3.9-2.1H7v-2h3v-2H7V9h3V6H4v9c0 .8.3 1.5.9 2.1.6.6 1.3.9 2.1.9Z"
      />
    </svg>
  ),
  'Nursing Orders': (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="currentColor"
        d="m10 18-3.2-2.8a93.2 93.2 0 0 1-5.2-5.3C1.1 9 .6 8.3.4 7.6 0 7 0 6.2 0 5.5c0-1.6.5-2.9 1.6-4C2.6.6 3.9 0 5.5 0A5.8 5.8 0 0 1 10 2.1 6 6 0 0 1 14.5 0c1.3 0 2.5.4 3.4 1.1 1 .8 1.5 1.8 1.9 2.9h-2.2c-.3-.7-.7-1.2-1.3-1.5-.6-.3-1.2-.5-1.8-.5-.8 0-1.6.2-2.2.7a8 8 0 0 0-1.7 1.8H9.4a7 7 0 0 0-1.7-1.8C7 2.2 6.3 2 5.5 2A3.5 3.5 0 0 0 2 5.5c0 .5.1 1 .4 1.7.2.5.6 1.2 1.2 2L6 11.6l4 3.6a131.6 131.6 0 0 1 3-2.6l1.3 1.5a83.6 83.6 0 0 1-2.9 2.5L10 18Zm7-4v-3h-3V9h3V6h2v3h3v2h-3v3h-2Z"
      />
    </svg>
  ),
  Immunization: (
    <svg width="21" height="19" viewBox="0 0 21 19" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0.9 9.17422C0.716667 8.97422 0.625 8.73672 0.625 8.46172C0.625 8.18672 0.716667 7.94922 0.9 7.74922L3.7 4.94922L2.625 3.87422L2.325 4.17422C2.125 4.37422 1.8875 4.47422 1.6125 4.47422C1.3375 4.47422 1.1 4.37422 0.9 4.17422C0.716667 3.99089 0.625 3.75755 0.625 3.47422C0.625 3.19089 0.716667 2.95755 0.9 2.77422L2.9 0.774219C3.1 0.574219 3.3375 0.474219 3.6125 0.474219C3.8875 0.474219 4.125 0.574219 4.325 0.774219C4.50833 0.957552 4.6 1.19089 4.6 1.47422C4.6 1.75755 4.50833 1.99089 4.325 2.17422L4.025 2.47422L5.1 3.54922L7.9 0.749219C8.1 0.549219 8.3375 0.449219 8.6125 0.449219C8.8875 0.449219 9.125 0.549219 9.325 0.749219C9.525 0.949219 9.625 1.18672 9.625 1.46172C9.625 1.73672 9.525 1.97422 9.325 2.17422L8.65 2.82422L16.025 10.1992C16.4083 10.5826 16.6 11.0534 16.6 11.6117C16.6 12.1701 16.4083 12.6409 16.025 13.0242L15.325 13.7492L20.05 18.4492H17.2L13.9 15.1492L13.2 15.8742C12.8167 16.2576 12.3458 16.4492 11.7875 16.4492C11.2292 16.4492 10.7583 16.2576 10.375 15.8742L3 8.49922L2.325 9.17422C2.125 9.35755 1.8875 9.44922 1.6125 9.44922C1.3375 9.44922 1.1 9.35755 0.9 9.17422ZM4.4 7.09922L11.775 14.4742L14.6 11.6242L13.1 10.0992L11.7 11.4992C11.5 11.6826 11.2625 11.7784 10.9875 11.7867C10.7125 11.7951 10.4833 11.7076 10.3 11.5242C10.1 11.3242 10 11.0867 10 10.8117C10 10.5367 10.1 10.2992 10.3 10.0992L11.7 8.69922L10.2 7.19922L8.8 8.59922C8.6 8.78255 8.3625 8.87422 8.0875 8.87422C7.8125 8.87422 7.575 8.78255 7.375 8.59922C7.19167 8.39922 7.1 8.16172 7.1 7.88672C7.1 7.61172 7.19167 7.37422 7.375 7.17422L8.775 5.77422L7.25 4.24922L4.4 7.09922Z"
        fill="currentColor"
      />
    </svg>
  ),
};

const drawerWidth = 244;

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

const StyledButton = styled(Button)<{ isactive: string }>(({ theme, isactive: isActive }) => ({
  display: 'flex',
  width: '100%',
  height: '42px',
  borderBottom: '1px solid #e0e0e0',
  alignItems: 'center',
  textDecoration: 'none',
  color: 'inherit',
  padding: '0',
  margin: '0',
  transition: 'background-color 0.3s',
  textTransform: 'none',
  '& .MuiListItemText-primary': {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  '& .MuiListItem-root:hover': {
    backgroundColor: otherColors.sidebarItemHover,
  },
  '&.Mui-disabled': {
    color: theme.palette.text.primary,
  },
  ...(isActive === 'true' && {
    color: theme.palette.primary.main,
    borderRight: `2px solid ${theme.palette.primary.main}`,
    backgroundColor: alpha(theme.palette.primary.main, 0.05),
    '& .MuiListItemIcon-root': {
      color: theme.palette.primary.main,
    },
    '& .MuiListItemText-primary': {
      fontWeight: 'bold',
    },
  }),
}));

export const Sidebar = (): JSX.Element => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const { oystehrZambda } = useApiClients();
  const user = useEvolveUser();
  const { interactionMode } = useNavigationContext();
  const { id: appointmentID } = useParams();
  const { visitState, appointmentRefetch } = useAppointmentData();
  const { chartData } = useChartData();
  const { appointment, encounter } = visitState;
  const status = appointment && encounter ? getVisitStatus(appointment, encounter) : undefined;

  const { isEncounterUpdatePending, handleUpdatePractitioner } = usePractitionerActions(
    encounter,
    'end',
    PRACTITIONER_CODINGS.Admitter
  );

  const assignedIntakePerformerId = encounter ? getAdmitterPractitionerId(encounter) : undefined;

  const handleCompleteIntake = async (): Promise<void> => {
    try {
      if (assignedIntakePerformerId) {
        await handleUpdatePractitioner(assignedIntakePerformerId);

        await handleChangeInPersonVisitStatus(
          {
            encounterId: encounter!.id!,
            user: user!,
            updatedStatus: 'ready for provider',
          },
          oystehrZambda
        );

        await appointmentRefetch();
      } else {
        enqueueSnackbar('Please select intake practitioner first', { variant: 'error' });
      }
    } catch (error: any) {
      console.log(error.message);
      enqueueSnackbar('An error occurred trying to complete intake. Please try again.', { variant: 'error' });
    }
  };

  const handleDrawerToggle = (): void => {
    setOpen(!open);
  };

  type MenuItem = {
    text: string;
    icon: React.ReactNode;
    to: string;
    visibility: Set<string>;
    activeCheckPath?: string;
  };

  const generateMenuItems = (routes: RouteCSS[]): MenuItem[] => {
    return routes
      .map((route) => ({
        text: route.text,
        icon: sidebarMenuIcons[route.iconKey],
        to: route.sidebarPath || route.path, // Use sidebarPath if available, otherwise use path
        activeCheckPath: route.activeCheckPath,
        visibility: new Set(route.modes),
      }))
      .filter((item) => item.visibility.has(interactionMode));
  };

  const menuItems = generateMenuItems(
    Object.values(routesCSS)
      .filter((route) => !route.isSkippedInNavigation)
      .filter((route) => route.path !== ROUTER_PATH.OTTEHR_AI || chartData?.aiChat != null)
  );

  return (
    <Drawer
      variant="permanent"
      open={open}
      sx={{
        position: 'relative',
        width: open ? drawerWidth : (theme) => theme.spacing(7),
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          position: 'relative',
          width: open ? drawerWidth : (theme) => theme.spacing(7),
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: 'width 0.1s',
        },
      }}
    >
      <DrawerHeader
        sx={{
          display: 'flex',
          padding: '0px',
          ...(open
            ? { justifyContent: 'end', paddingRight: '10px' }
            : { justifyContent: 'center', paddingRight: '0px' }),
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <IconButton
          sx={{
            width: 40,
            height: 40,
            padding: 0,
            '&:hover': {
              backgroundColor: otherColors.sidebarItemHover,
            },
          }}
          onClick={handleDrawerToggle}
        >
          <ArrowIcon direction={open ? 'left' : 'right'} />
        </IconButton>
      </DrawerHeader>
      <List sx={{ padding: '0px' }}>
        {menuItems.map((item) => {
          const comparedPath = item?.activeCheckPath || item.to;
          return (
            <StyledButton
              isactive={location.pathname.includes(comparedPath).toString()}
              key={item.text}
              onClick={() => {
                requestAnimationFrame(() => {
                  navigate(item.to);
                });
              }}
            >
              <ListItem
                data-testid={dataTestIds.sideMenu.sideMenuItem(item.to)}
                sx={{ width: '100%', height: 'inherit' }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} sx={{ opacity: open ? 1 : 0 }} />
              </ListItem>
            </StyledButton>
          );
        })}
      </List>
      <br />
      <CompleteIntakeButton
        isDisabled={!appointmentID || isEncounterUpdatePending || status !== 'intake'}
        handleCompleteIntake={handleCompleteIntake}
        status={status}
      />
    </Drawer>
  );
};
