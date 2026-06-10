// Outreach-scoped color palette.
//
// This is a temporary, feature-local palette so the scheduled-patient-outreach UI
// stops hardcoding raw hex values inline. The intent is to fold these tokens into
// the site-wide theme palette later; until then, all outreach components should
// reference these semantic tokens instead of literal hex strings.

export const outreachColors = {
  white: '#FFFFFF',
  surfaceMuted: '#F5F5F5',

  // Neutral / default chips and avatars
  neutral: {
    main: '#757575',
    text: '#616161',
    bg: '#EEEEEE',
    avatar: '#e0e0e0',
  },

  // Status: success / sent / completed
  success: {
    main: '#2e7d32',
    text: '#1B5E20',
    bg: '#C8E6C9',
    bgSubtle: '#E8F5E9',
  },

  // Status: error / failed / cancelled
  error: {
    main: '#c62828',
    text: '#B71C1C',
    bg: '#FFCDD2',
    bgSubtle: '#FFEBEE',
  },

  // Status: warning / on-hold / retrying
  warning: {
    main: '#E65100',
    text: '#E65100',
    bg: '#FFE0B2',
    bgSubtle: '#FFF3E0',
  },

  // Status: info / in-progress / primary actions
  info: {
    main: '#1976d2',
    text: '#0D47A1',
    dark: '#1565c0',
    bg: '#BBDEFB',
    bgSubtle: '#E3F2FD',
  },

  // Status: requested / pending (amber)
  pending: {
    text: '#7A5E00',
    bg: '#FFF3CD',
  },

  // Cancellation / meta detail (purple)
  purple: {
    text: '#4A148C',
    bg: '#F3E5F5',
  },

  // Communication medium accents
  medium: {
    sms: '#43a047',
    email: '#0277bd',
    paperMail: '#4e342e',
  },

  // Action-type chip accents
  action: {
    chargeCard: '#e65100',
    sendNotification: '#2e7d32',
    collections: '#b71c1c',
    log: '#546e7a',
  },

  // Paper-mail history button (brown)
  paperMailButton: {
    main: '#6d4c41',
    hover: '#5d4037',
  },

  // History dialog avatars
  avatar: {
    clinic: '#1976d2',
    patient: '#e0e0e0',
  },
} as const;
