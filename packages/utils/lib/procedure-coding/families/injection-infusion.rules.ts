import { codeCandidateFromInfo } from '../family-support';

export type InjectionRoute = 'im-subq' | 'iv-push' | 'infusion';

export type InfusionKind = 'hydration' | 'therapeutic';

export const HYDRATION_MINIMUM_MINUTES = 31;

export const IV_PUSH_MAXIMUM_MINUTES = 15;

const ADDITIONAL_HOUR_MINIMUM_MINUTES = 31;

export function additionalHourUnits(durationMinutes: number): number {
  const beyondFirstHour = durationMinutes - 60;
  if (beyondFirstHour < ADDITIONAL_HOUR_MINIMUM_MINUTES) return 0;
  return Math.floor(beyondFirstHour / 60) + (beyondFirstHour % 60 >= ADDITIONAL_HOUR_MINIMUM_MINUTES ? 1 : 0);
}

export const INJECTION_INFUSION_CODES = {
  imSubq: '96372',
  ivPush: '96374',
  hydrationInitial: '96360',
  hydrationAdditionalHour: '96361',
  therapeuticInitial: '96365',
  therapeuticAdditionalHour: '96366',
} as const;

export type InjectionInfusionCode = (typeof INJECTION_INFUSION_CODES)[keyof typeof INJECTION_INFUSION_CODES];

export interface InjectionCodeInfo {
  route: InjectionRoute;
  kind?: InfusionKind;
  baseCode?: InjectionInfusionCode;
  display: string;
}

export const INJECTION_CODE_INFO: Record<InjectionInfusionCode, InjectionCodeInfo> = {
  [INJECTION_INFUSION_CODES.imSubq]: {
    route: 'im-subq',
    display: 'Therapeutic, prophylactic, or diagnostic injection; subcutaneous or intramuscular',
  },
  [INJECTION_INFUSION_CODES.ivPush]: {
    route: 'iv-push',
    display: 'Therapeutic, prophylactic, or diagnostic injection; intravenous push',
  },
  [INJECTION_INFUSION_CODES.hydrationInitial]: {
    route: 'infusion',
    kind: 'hydration',
    display: 'Intravenous infusion, hydration; initial, 31 minutes to 1 hour',
  },
  [INJECTION_INFUSION_CODES.hydrationAdditionalHour]: {
    route: 'infusion',
    kind: 'hydration',
    baseCode: INJECTION_INFUSION_CODES.hydrationInitial,
    display: 'Intravenous infusion, hydration; each additional hour (add-on to 96360)',
  },
  [INJECTION_INFUSION_CODES.therapeuticInitial]: {
    route: 'infusion',
    kind: 'therapeutic',
    display:
      'Intravenous infusion, for therapy, prophylaxis, or diagnosis (specify substance or drug); initial, up to 1 hour',
  },
  [INJECTION_INFUSION_CODES.therapeuticAdditionalHour]: {
    route: 'infusion',
    kind: 'therapeutic',
    baseCode: INJECTION_INFUSION_CODES.therapeuticInitial,
    display: 'Intravenous infusion, for therapy, prophylaxis, or diagnosis; each additional hour (add-on to 96365)',
  },
};

export function isInjectionInfusionCode(code: string): code is InjectionInfusionCode {
  return code in INJECTION_CODE_INFO;
}

export const codeCandidate = codeCandidateFromInfo(INJECTION_CODE_INFO);

export const INFUSION_INITIAL_CODE = {
  hydration: INJECTION_INFUSION_CODES.hydrationInitial,
  therapeutic: INJECTION_INFUSION_CODES.therapeuticInitial,
} as const satisfies Record<InfusionKind, InjectionInfusionCode>;

export const INFUSION_ADD_ON_CODE = {
  hydration: INJECTION_INFUSION_CODES.hydrationAdditionalHour,
  therapeutic: INJECTION_INFUSION_CODES.therapeuticAdditionalHour,
} as const satisfies Record<InfusionKind, InjectionInfusionCode>;

export const INFUSION_KIND_LABELS = {
  hydration: 'hydration (prepackaged fluid or electrolytes, with no drug infused)',
  therapeutic: 'an infusion of a drug or other substance for therapy, prophylaxis, or diagnosis',
} satisfies Record<InfusionKind, string>;

export const INFUSION_KIND_TITLES = {
  hydration: 'IV hydration infusion',
  therapeutic: 'IV infusion of a drug for therapy, prophylaxis, or diagnosis',
} satisfies Record<InfusionKind, string>;

export const ROUTE_CODE_LABELS = {
  'im-subq': 'an IM/SubQ injection code',
  'iv-push': 'an IV push code',
  infusion: 'an IV infusion code',
} satisfies Record<InjectionRoute, string>;

export const ROUTE_DOCUMENTED_LABELS = {
  'im-subq': 'an IM/SubQ injection',
  'iv-push': 'an IV push',
  infusion: 'an IV infusion',
} satisfies Record<InjectionRoute, string>;

export function initialCodeForRoute(route: InjectionRoute, kind: InfusionKind | undefined): string {
  if (route === 'im-subq') return INJECTION_INFUSION_CODES.imSubq;
  if (route === 'iv-push') return INJECTION_INFUSION_CODES.ivPush;

  return kind === undefined ? '96360 for hydration or 96365 for a drug infusion' : INFUSION_INITIAL_CODE[kind];
}

export function codeForRoute(route: InjectionRoute, kind: InfusionKind | undefined): string {
  const initial = initialCodeForRoute(route, kind);

  return route === 'infusion' && kind !== undefined
    ? `${initial} (+${INFUSION_ADD_ON_CODE[kind]} beyond the first hour)`
    : initial;
}
