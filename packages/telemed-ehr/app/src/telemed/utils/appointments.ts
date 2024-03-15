import { GetTelemedAppointmentsInput, ApptStatus, mapStatusToTelemed } from 'ehr-utils';

export enum ApptTab {
  'ready' = 'ready',
  'provider' = 'provider',
  'not-signed' = 'not-signed',
  'complete' = 'complete',
}

export { ApptStatus, mapStatusToTelemed };

export const ApptTabToStatus: Record<ApptTab, ApptStatus[]> = {
  [ApptTab.ready]: [ApptStatus.ready],
  [ApptTab.provider]: [ApptStatus['pre-video'], ApptStatus['on-video']],
  [ApptTab['not-signed']]: [ApptStatus.unsigned],
  [ApptTab.complete]: [ApptStatus.complete],
};

export const ApptStatusToPalette: {
  [status in ApptStatus]: {
    background: {
      primary: string;
      secondary?: string;
    };
    color: {
      primary: string;
      secondary?: string;
    };
  };
} = {
  ready: {
    background: {
      primary: '#FFE0B2',
    },
    color: {
      primary: '#E65100',
    },
  },
  'pre-video': {
    background: {
      primary: '#B3E5FC',
    },
    color: {
      primary: '#01579B',
    },
  },
  'on-video': {
    background: {
      primary: '#D1C4E9',
    },
    color: {
      primary: '#311B92',
    },
  },
  unsigned: {
    background: {
      primary: '#FFCCBC',
    },
    color: {
      primary: '#BF360C',
    },
  },
  complete: {
    background: {
      primary: '#C8E6C9',
    },
    color: {
      primary: '#1B5E20',
    },
  },
};

export type GetAppointmentsRequestParams = Pick<
  GetTelemedAppointmentsInput,
  'stateFilter' | 'dateFilter' | 'patientFilter' | 'statusesFilter'
>;

export const APPT_STATUS_MAP: {
  [status in ApptStatus]: {
    background: {
      primary: string;
      secondary?: string;
    };
    color: {
      primary: string;
      secondary?: string;
    };
  };
} = {
  ready: {
    background: {
      primary: '#FFE0B2',
    },
    color: {
      primary: '#E65100',
    },
  },
  'pre-video': {
    background: {
      primary: '#B3E5FC',
    },
    color: {
      primary: '#01579B',
    },
  },
  'on-video': {
    background: {
      primary: '#D1C4E9',
    },
    color: {
      primary: '#311B92',
    },
  },
  unsigned: {
    background: {
      primary: '#FFCCBC',
    },
    color: {
      primary: '#BF360C',
    },
  },
  complete: {
    background: {
      primary: '#C8E6C9',
    },
    color: {
      primary: '#1B5E20',
    },
  },
};
