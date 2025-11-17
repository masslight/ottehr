import { otherColors } from '@ehrTheme/colors';
import { aiIcon } from '@ehrTheme/icons';
import AddIcon from '@mui/icons-material/Add';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import {
  alpha,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  styled,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { CreateTaskDialog } from 'src/features/tasks/components/CreateTaskDialog';
import { handleChangeInPersonVisitStatus } from 'src/helpers/inPersonVisitStatusUtils';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { getAdmitterPractitionerId, getInPersonVisitStatus, PRACTITIONER_CODINGS } from 'utils';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { CompleteIntakeButton } from '../../in-person/components/CompleteIntakeButton';
import { EncounterSwitcher } from '../../in-person/components/EncounterSwitcher';
import { RouteInPerson, useInPersonNavigationContext } from '../../in-person/context/InPersonNavigationContext';
import { ROUTER_PATH, routesInPerson } from '../../in-person/routing/routesInPerson';
import { useGetAppointmentAccessibility } from '../hooks/useGetAppointmentAccessibility';
import { usePractitionerActions } from '../hooks/usePractitioner';
import { useAppointmentData, useChartData } from '../stores/appointment/appointment.store';

const ArrowIcon = ({ direction }: { direction: 'left' | 'right' }): React.ReactElement => (
  <svg width="9" height="18" viewBox="0 0 9 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d={direction === 'right' ? 'M0 18V0H2V18H0ZM4 14V4L9 9L4 14Z' : 'M5 14V4L0 9L5 14ZM7 18H9V0H7V18Z'}
      fill="#2169F5"
    />
  </svg>
);

export const sidebarMenuIcons = {
  'CC & Intake Notes': (
    <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.33301 4.00033C7.87467 4.00033 7.48231 3.83713 7.15592 3.51074C6.82954 3.18435 6.66634 2.79199 6.66634 2.33366C6.66634 1.87533 6.82954 1.48296 7.15592 1.15658C7.48231 0.830187 7.87467 0.666992 8.33301 0.666992C8.79134 0.666992 9.1837 0.830187 9.51009 1.15658C9.83648 1.48296 9.99967 1.87533 9.99967 2.33366C9.99967 2.79199 9.83648 3.18435 9.51009 3.51074C9.1837 3.83713 8.79134 4.00033 8.33301 4.00033ZM13.7497 14.0003C14.333 14.0003 14.8261 13.7989 15.2288 13.3962C15.6316 12.9934 15.833 12.5003 15.833 11.917C15.833 11.3337 15.6316 10.8406 15.2288 10.4378C14.8261 10.035 14.333 9.83366 13.7497 9.83366C13.1663 9.83366 12.6733 10.035 12.2705 10.4378C11.8677 10.8406 11.6663 11.3337 11.6663 11.917C11.6663 12.5003 11.8677 12.9934 12.2705 13.3962C12.6733 13.7989 13.1663 14.0003 13.7497 14.0003ZM17.9997 17.3337L15.7497 15.0837C15.4441 15.2781 15.1247 15.4239 14.7913 15.5212C14.458 15.6184 14.1108 15.667 13.7497 15.667C12.708 15.667 11.8226 15.3024 11.0934 14.5732C10.3643 13.8441 9.99967 12.9587 9.99967 11.917C9.99967 10.8753 10.3643 9.98991 11.0934 9.26074C11.8226 8.53158 12.708 8.16699 13.7497 8.16699C14.7913 8.16699 15.6768 8.53158 16.4059 9.26074C17.1351 9.98991 17.4997 10.8753 17.4997 11.917C17.4997 12.2781 17.4511 12.6253 17.3538 12.9587C17.2566 13.292 17.1108 13.6114 16.9163 13.917L19.1663 16.167L17.9997 17.3337ZM9.16634 17.3337V14.8128C9.37467 15.1462 9.6212 15.4517 9.90592 15.7295C10.1906 16.0073 10.4997 16.2573 10.833 16.4795V17.3337H9.16634ZM5.83301 17.3337V6.50033C4.98579 6.43088 4.14551 6.33019 3.31217 6.19824C2.47884 6.0663 1.65245 5.88921 0.833008 5.66699L1.24967 4.00033C2.41634 4.31977 3.58648 4.53852 4.76009 4.65658C5.9337 4.77463 7.12467 4.83366 8.33301 4.83366C9.54134 4.83366 10.7323 4.77463 11.9059 4.65658C13.0795 4.53852 14.2497 4.31977 15.4163 4.00033L15.833 5.66699C15.0136 5.88921 14.1872 6.0663 13.3538 6.19824C12.5205 6.33019 11.6802 6.43088 10.833 6.50033V7.35449C10.083 7.8406 9.47884 8.48296 9.02051 9.28158C8.56217 10.0802 8.33301 10.9587 8.33301 11.917V12.1253C8.33301 12.1948 8.33995 12.2642 8.35384 12.3337H7.49967V17.3337H5.83301Z"
        fill="currentColor"
      />
    </svg>
  ),
  'Review & Sign': (
    <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14.59 5.58L8 12.17L4.41 8.59L3 10L8 15L16 7L14.59 5.58ZM10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM10 18C5.58 18 2 14.42 2 10C2 5.58 5.58 2 10 2C14.42 2 18 5.58 18 10C18 14.42 14.42 18 10 18Z"
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
        d="M7.5 16H9.5V8.75L7.4 4.55L5.6 5.45L7.5 9.25V16ZM10.5 16H12.5V9.25L14.4 5.45L12.6 4.55L10.5 8.75V16ZM14.9 11.45L16.9 7.45L15.1 6.55L13.1 10.55L14.9 11.45ZM5.1 11.45L6.9 10.55L4.9 6.55L3.1 7.45L5.1 11.45ZM10 20C8.61667 20 7.31667 19.7375 6.1 19.2125C4.88333 18.6875 3.825 17.975 2.925 17.075C2.025 16.175 1.3125 15.1167 0.7875 13.9C0.2625 12.6833 0 11.3833 0 10C0 8.61667 0.2625 7.31667 0.7875 6.1C1.3125 4.88333 2.025 3.825 2.925 2.925C3.825 2.025 4.88333 1.3125 6.1 0.7875C7.31667 0.2625 8.61667 0 10 0C11.3833 0 12.6833 0.2625 13.9 0.7875C15.1167 1.3125 16.175 2.025 17.075 2.925C17.975 3.825 18.6875 4.88333 19.2125 6.1C19.7375 7.31667 20 8.61667 20 10C20 11.3833 19.7375 12.6833 19.2125 13.9C18.6875 15.1167 17.975 16.175 17.075 17.075C16.175 17.975 15.1167 18.6875 13.9 19.2125C12.6833 19.7375 11.3833 20 10 20ZM10 18C12.2333 18 14.125 17.225 15.675 15.675C17.225 14.125 18 12.2333 18 10C18 7.76667 17.225 5.875 15.675 4.325C14.125 2.775 12.2333 2 10 2C7.76667 2 5.875 2.775 4.325 4.325C2.775 5.875 2 7.76667 2 10C2 12.2333 2.775 14.125 4.325 15.675C5.875 17.225 7.76667 18 10 18Z"
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
  Radiology: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="20" viewBox="0 0 18 20" fill="none">
      <path
        d="M2 20C1.45 20 0.979167 19.8042 0.5875 19.4125C0.195833 19.0208 0 18.55 0 18V4C0 3.45 0.195833 2.97917 0.5875 2.5875C0.979167 2.19583 1.45 2 2 2H3V0H5V2H13V0H15V2H16C16.55 2 17.0208 2.19583 17.4125 2.5875C17.8042 2.97917 18 3.45 18 4V18C18 18.55 17.8042 19.0208 17.4125 19.4125C17.0208 19.8042 16.55 20 16 20H2ZM2 18H16V4H2V18ZM6 18V16.2L4.2 14.1C4.01667 13.9167 3.85417 13.6667 3.7125 13.35C3.57083 13.0333 3.5 12.6667 3.5 12.25C3.5 12.0333 3.52083 11.8208 3.5625 11.6125C3.60417 11.4042 3.675 11.2 3.775 11C3.69167 10.8167 3.625 10.6208 3.575 10.4125C3.525 10.2042 3.5 9.98333 3.5 9.75C3.5 9.33333 3.57083 8.96667 3.7125 8.65C3.85417 8.33333 4.01667 8.08333 4.2 7.9L6 5.8V4H7.5V6.075C7.5 6.15833 7.44167 6.31667 7.325 6.55L5.325 8.9C5.20833 9.03333 5.125 9.17083 5.075 9.3125C5.025 9.45417 5 9.6 5 9.75C5 10.0833 5.10833 10.3708 5.325 10.6125C5.54167 10.8542 5.81667 10.975 6.15 10.975C6.3 10.975 6.44167 10.95 6.575 10.9C6.70833 10.85 6.825 10.7667 6.925 10.65C7.20833 10.3667 7.52917 10.15 7.8875 10C8.24583 9.85 8.61667 9.775 9 9.775C9.38333 9.775 9.75417 9.85 10.1125 10C10.4708 10.15 10.7917 10.3667 11.075 10.65C11.1917 10.7667 11.3167 10.85 11.45 10.9C11.5833 10.95 11.7167 10.975 11.85 10.975C12.1833 10.975 12.4583 10.8542 12.675 10.6125C12.8917 10.3708 13 10.0917 13 9.775C13 9.625 12.9708 9.47917 12.9125 9.3375C12.8542 9.19583 12.775 9.05833 12.675 8.925L10.675 6.55C10.6083 6.48333 10.5625 6.40833 10.5375 6.325C10.5125 6.24167 10.5 6.15833 10.5 6.075V4H12V5.8L13.825 7.95C14.0583 8.21667 14.2292 8.50417 14.3375 8.8125C14.4458 9.12083 14.5 9.44167 14.5 9.775C14.5 9.99167 14.4708 10.2042 14.4125 10.4125C14.3542 10.6208 14.2833 10.8167 14.2 11C14.3 11.2 14.375 11.4042 14.425 11.6125C14.475 11.8208 14.5 12.0333 14.5 12.25C14.5 12.6667 14.4292 13.0333 14.2875 13.35C14.1458 13.6667 13.9833 13.9167 13.8 14.1L12 16.2V18H10.5V15.925C10.5 15.825 10.5583 15.6667 10.675 15.45L12.675 13.1C12.7917 12.9667 12.875 12.825 12.925 12.675C12.975 12.525 13 12.375 13 12.225C12.8167 12.3083 12.6333 12.3708 12.45 12.4125C12.2667 12.4542 12.075 12.475 11.875 12.475C11.5417 12.475 11.2083 12.4083 10.875 12.275C10.5417 12.1417 10.25 11.9417 10 11.675C9.88333 11.5417 9.7375 11.4417 9.5625 11.375C9.3875 11.3083 9.2 11.275 9 11.275C8.81667 11.275 8.6375 11.3083 8.4625 11.375C8.2875 11.4417 8.13333 11.5417 8 11.675C7.75 11.9417 7.4625 12.1417 7.1375 12.275C6.8125 12.4083 6.48333 12.475 6.15 12.475C5.95 12.475 5.75417 12.4542 5.5625 12.4125C5.37083 12.3708 5.18333 12.3083 5 12.225C5 12.375 5.025 12.525 5.075 12.675C5.125 12.825 5.20833 12.9667 5.325 13.1L7.325 15.45C7.375 15.5333 7.41667 15.6125 7.45 15.6875C7.48333 15.7625 7.5 15.8417 7.5 15.925V18H6Z"
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
  'External Labs': <BiotechOutlinedIcon />,
  History: (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.5 16C5.95 16 5.47917 15.8042 5.0875 15.4125C4.69583 15.0208 4.5 14.55 4.5 14V11H7.5V8.75C6.91667 8.71667 6.3625 8.5875 5.8375 8.3625C5.3125 8.1375 4.83333 7.8 4.4 7.35V6.25H3.25L0 3C0.6 2.23333 1.34167 1.69167 2.225 1.375C3.10833 1.05833 4 0.9 4.9 0.9C5.35 0.9 5.7875 0.933333 6.2125 1C6.6375 1.06667 7.06667 1.19167 7.5 1.375V0H19.5V13C19.5 13.8333 19.2083 14.5417 18.625 15.125C18.0417 15.7083 17.3333 16 16.5 16H6.5ZM9.5 11H15.5V13C15.5 13.2833 15.5958 13.5208 15.7875 13.7125C15.9792 13.9042 16.2167 14 16.5 14C16.7833 14 17.0208 13.9042 17.2125 13.7125C17.4042 13.5208 17.5 13.2833 17.5 13V2H9.5V2.6L15.5 8.6V10H14.1L11.25 7.15L11.05 7.35C10.8167 7.58333 10.5708 7.79167 10.3125 7.975C10.0542 8.15833 9.78333 8.3 9.5 8.4V11ZM4.1 4.25H6.4V6.4C6.6 6.53333 6.80833 6.625 7.025 6.675C7.24167 6.725 7.46667 6.75 7.7 6.75C8.08333 6.75 8.42917 6.69167 8.7375 6.575C9.04583 6.45833 9.35 6.25 9.65 5.95L9.85 5.75L8.45 4.35C7.96667 3.86667 7.425 3.50417 6.825 3.2625C6.225 3.02083 5.58333 2.9 4.9 2.9C4.56667 2.9 4.25 2.925 3.95 2.975C3.65 3.025 3.35 3.1 3.05 3.2L4.1 4.25ZM13.5 13H6.5V14H13.65C13.6 13.85 13.5625 13.6917 13.5375 13.525C13.5125 13.3583 13.5 13.1833 13.5 13Z"
        fill="currentColor"
      />
    </svg>
  ),
  Stethoscope: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.5 20C9.7 20 8.16667 19.3667 6.9 18.1C5.63333 16.8333 5 15.3 5 13.5V12.925C3.56667 12.6917 2.375 12.0208 1.425 10.9125C0.475 9.80417 0 8.5 0 7V1H3V0H5V4H3V3H2V7C2 8.1 2.39167 9.04167 3.175 9.825C3.95833 10.6083 4.9 11 6 11C7.1 11 8.04167 10.6083 8.825 9.825C9.60833 9.04167 10 8.1 10 7V3H9V4H7V0H9V1H12V7C12 8.5 11.525 9.80417 10.575 10.9125C9.625 12.0208 8.43333 12.6917 7 12.925V13.5C7 14.75 7.4375 15.8125 8.3125 16.6875C9.1875 17.5625 10.25 18 11.5 18C12.75 18 13.8125 17.5625 14.6875 16.6875C15.5625 15.8125 16 14.75 16 13.5V11.825C15.4167 11.625 14.9375 11.2667 14.5625 10.75C14.1875 10.2333 14 9.65 14 9C14 8.16667 14.2917 7.45833 14.875 6.875C15.4583 6.29167 16.1667 6 17 6C17.8333 6 18.5417 6.29167 19.125 6.875C19.7083 7.45833 20 8.16667 20 9C20 9.65 19.8125 10.2333 19.4375 10.75C19.0625 11.2667 18.5833 11.625 18 11.825V13.5C18 15.3 17.3667 16.8333 16.1 18.1C14.8333 19.3667 13.3 20 11.5 20ZM17 10C17.2833 10 17.5208 9.90417 17.7125 9.7125C17.9042 9.52083 18 9.28333 18 9C18 8.71667 17.9042 8.47917 17.7125 8.2875C17.5208 8.09583 17.2833 8 17 8C16.7167 8 16.4792 8.09583 16.2875 8.2875C16.0958 8.47917 16 8.71667 16 9C16 9.28333 16.0958 9.52083 16.2875 9.7125C16.4792 9.90417 16.7167 10 17 10Z"
        fill="currentColor"
      />
    </svg>
  ),
  Prescription: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14 13C13.1667 13 12.4583 12.7083 11.875 12.125C11.2917 11.5417 11 10.8333 11 10C11 9.16667 11.2917 8.45833 11.875 7.875C12.4583 7.29167 13.1667 7 14 7C14.8333 7 15.5417 7.29167 16.125 7.875C16.7083 8.45833 17 9.16667 17 10C17 10.8333 16.7083 11.5417 16.125 12.125C15.5417 12.7083 14.8333 13 14 13ZM14 11C14.2833 11 14.5208 10.9042 14.7125 10.7125C14.9042 10.5208 15 10.2833 15 10C15 9.71667 14.9042 9.47917 14.7125 9.2875C14.5208 9.09583 14.2833 9 14 9C13.7167 9 13.4792 9.09583 13.2875 9.2875C13.0958 9.47917 13 9.71667 13 10C13 10.2833 13.0958 10.5208 13.2875 10.7125C13.4792 10.9042 13.7167 11 14 11ZM8 20V17.1C8 16.75 8.08333 16.4208 8.25 16.1125C8.41667 15.8042 8.65 15.5583 8.95 15.375C9.48333 15.0583 10.0458 14.7958 10.6375 14.5875C11.2292 14.3792 11.8333 14.225 12.45 14.125L14 16L15.55 14.125C16.1667 14.225 16.7667 14.3792 17.35 14.5875C17.9333 14.7958 18.4917 15.0583 19.025 15.375C19.325 15.5583 19.5625 15.8042 19.7375 16.1125C19.9125 16.4208 20 16.75 20 17.1V20H8ZM9.975 18H13.05L11.7 16.35C11.4 16.4333 11.1083 16.5417 10.825 16.675C10.5417 16.8083 10.2583 16.95 9.975 17.1V18ZM14.95 18H18V17.1C17.7333 16.9333 17.4583 16.7875 17.175 16.6625C16.8917 16.5375 16.6 16.4333 16.3 16.35L14.95 18ZM2 18C1.45 18 0.979167 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H16C16.55 0 17.0208 0.195833 17.4125 0.5875C17.8042 0.979167 18 1.45 18 2V7C17.7333 6.66667 17.4417 6.35 17.125 6.05C16.8083 5.75 16.4333 5.55 16 5.45V2H2V16H6.15C6.1 16.1833 6.0625 16.3667 6.0375 16.55C6.0125 16.7333 6 16.9167 6 17.1V18H2ZM4 6H11C11.4333 5.66667 11.9083 5.41667 12.425 5.25C12.9417 5.08333 13.4667 5 14 5V4H4V6ZM4 10H9C9 9.65 9.0375 9.30833 9.1125 8.975C9.1875 8.64167 9.29167 8.31667 9.425 8H4V10ZM4 14H7.45C7.63333 13.85 7.82917 13.7167 8.0375 13.6C8.24583 13.4833 8.45833 13.375 8.675 13.275V12H4V14ZM2 16V2V5.425V5V16Z"
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
  'Oystehr AI': <img src={aiIcon} style={{ width: '22px' }} />,
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

const StyledButton = styled(Button)<{ isActive: string }>(({ theme, isActive: isActive }) => ({
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
  const { interactionMode } = useInPersonNavigationContext();
  const { id: appointmentID } = useParams();
  const { visitState, appointmentRefetch } = useAppointmentData();
  const { chartData } = useChartData();
  const { appointment, encounter } = visitState;
  const status = appointment && encounter ? getInPersonVisitStatus(appointment, encounter) : undefined;
  const { visitType } = useGetAppointmentAccessibility();
  const isFollowup = visitType === 'follow-up';

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

  const GroupLabel = styled(Box)(({ theme }) => ({
    padding: '8px 16px 6px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: theme.palette.primary.dark,
    textTransform: 'uppercase',
    letterSpacing: '0px',
  }));

  type MenuItem = {
    text: string;
    icon: React.ReactNode;
    to: string;
    visibility: Set<string>;
    activeCheckPath?: string;
    groupLabel?: string;
  };

  const generateMenuItems = (routes: RouteInPerson[]): MenuItem[] => {
    return routes
      .map((route) => ({
        text: route.text,
        icon: sidebarMenuIcons[route.iconKey],
        to: route.sidebarPath || route.path, // Use sidebarPath if available, otherwise use path
        activeCheckPath: route.activeCheckPath,
        visibility: new Set(route.modes),
        groupLabel: route.groupLabel,
      }))
      .filter((item) => item.visibility.has(interactionMode));
  };

  const menuItems = generateMenuItems(
    Object.values(routesInPerson)
      .filter((route) => !route.isSkippedInNavigation)
      .filter((route) => route.path !== ROUTER_PATH.OTTEHR_AI || chartData?.aiChat?.documents?.[0])
  );

  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const onCreateTaskClick = (): void => {
    setShowCreateTaskDialog(true);
  };

  return (
    <>
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
          }}
          style={{ minHeight: '48px' }}
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

        <EncounterSwitcher open={open} />

        <List sx={{ padding: '0px' }}>
          <Box style={{ width: '100%', padding: '8px 16px' }}>
            {open ? (
              <RoundedButton
                variant="outlined"
                onClick={onCreateTaskClick}
                startIcon={<AddIcon />}
                style={{ width: '100%' }}
              >
                Create Task
              </RoundedButton>
            ) : null}
          </Box>
          {menuItems.map((item, index) => {
            const comparedPath = item?.activeCheckPath || item.to;
            const showGroupLabel =
              item.groupLabel && (index === 0 || menuItems[index - 1].groupLabel !== item.groupLabel);

            return (
              <React.Fragment key={item.text}>
                {showGroupLabel && open && <GroupLabel>{item.groupLabel}</GroupLabel>}
                <StyledButton
                  isActive={location.pathname.includes(comparedPath).toString()}
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
                    <ListItemIcon sx={{ minWidth: 30 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} sx={{ opacity: open ? 1 : 0 }} />
                  </ListItem>
                </StyledButton>
              </React.Fragment>
            );
          })}
        </List>
        <br />
        {!isFollowup && (
          <CompleteIntakeButton
            isDisabled={!appointmentID || isEncounterUpdatePending || status !== 'intake'}
            handleCompleteIntake={handleCompleteIntake}
            status={status}
          />
        )}
      </Drawer>
      <CreateTaskDialog
        open={showCreateTaskDialog}
        handleClose={(): void => {
          setShowCreateTaskDialog(false);
        }}
      />
    </>
  );
};
