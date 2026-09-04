import { codeCandidateFromInfo, joinWithOr } from '../family-support';
import type { SplintRegion, StrappingRegion, StrapSiteRegion } from './splinting.extract';

interface SplintCodeInfo {
  kind: 'splint';
  region: SplintRegion;
  staticDynamic?: 'static' | 'dynamic';
  display: string;
}

interface StrappingCodeInfo {
  kind: 'strapping';
  region: StrappingRegion;
  display: string;
}

type SplintingCodeInfo = SplintCodeInfo | StrappingCodeInfo;

export const SPLINTING_CODES = {
  longArmSplint: '29105',
  shortArmStaticSplint: '29125',
  shortArmDynamicSplint: '29126',
  fingerStaticSplint: '29130',
  fingerDynamicSplint: '29131',
  longLegSplint: '29505',
  shortLegSplint: '29515',
  chestStrapping: '29200',
  shoulderStrapping: '29240',
  elbowWristStrapping: '29260',
  handFingerStrapping: '29280',
  hipStrapping: '29520',
  kneeStrapping: '29530',
  ankleFootStrapping: '29540',
  toeStrapping: '29550',
  unnaBoot: '29580',
  multiLayerCompression: '29581',
} as const;

export type SplintingCode = (typeof SPLINTING_CODES)[keyof typeof SPLINTING_CODES];

export const SPLINTING_CODE_INFO: Record<SplintingCode, SplintingCodeInfo> = {
  [SPLINTING_CODES.longArmSplint]: {
    kind: 'splint',
    region: 'long-arm',
    display: 'Application of long arm splint (shoulder to hand)',
  },
  [SPLINTING_CODES.shortArmStaticSplint]: {
    kind: 'splint',
    region: 'short-arm',
    staticDynamic: 'static',
    display: 'Application of short arm splint (forearm to hand); static',
  },
  [SPLINTING_CODES.shortArmDynamicSplint]: {
    kind: 'splint',
    region: 'short-arm',
    staticDynamic: 'dynamic',
    display: 'Application of short arm splint (forearm to hand); dynamic',
  },
  [SPLINTING_CODES.fingerStaticSplint]: {
    kind: 'splint',
    region: 'finger',
    staticDynamic: 'static',
    display: 'Application of finger splint; static',
  },
  [SPLINTING_CODES.fingerDynamicSplint]: {
    kind: 'splint',
    region: 'finger',
    staticDynamic: 'dynamic',
    display: 'Application of finger splint; dynamic',
  },
  [SPLINTING_CODES.longLegSplint]: {
    kind: 'splint',
    region: 'long-leg',
    display: 'Application of long leg splint (thigh to ankle or toes)',
  },
  [SPLINTING_CODES.shortLegSplint]: {
    kind: 'splint',
    region: 'short-leg',
    display: 'Application of short leg splint (calf to foot)',
  },
  [SPLINTING_CODES.chestStrapping]: { kind: 'strapping', region: 'chest', display: 'Strapping; thorax' },
  [SPLINTING_CODES.shoulderStrapping]: {
    kind: 'strapping',
    region: 'shoulder',
    display: 'Strapping; shoulder',
  },
  [SPLINTING_CODES.elbowWristStrapping]: {
    kind: 'strapping',
    region: 'elbow-wrist',
    display: 'Strapping; elbow or wrist',
  },
  [SPLINTING_CODES.handFingerStrapping]: {
    kind: 'strapping',
    region: 'hand-finger',
    display: 'Strapping; hand or finger',
  },
  [SPLINTING_CODES.hipStrapping]: { kind: 'strapping', region: 'hip', display: 'Strapping; hip' },
  [SPLINTING_CODES.kneeStrapping]: { kind: 'strapping', region: 'knee', display: 'Strapping; knee' },
  [SPLINTING_CODES.ankleFootStrapping]: {
    kind: 'strapping',
    region: 'ankle-foot',
    display: 'Strapping; ankle and/or foot',
  },
  [SPLINTING_CODES.toeStrapping]: { kind: 'strapping', region: 'toes', display: 'Strapping; toes' },
  [SPLINTING_CODES.unnaBoot]: { kind: 'strapping', region: 'unna-boot', display: 'Strapping; Unna boot' },
  [SPLINTING_CODES.multiLayerCompression]: {
    kind: 'strapping',
    region: 'multi-layer-leg',
    display: 'Application of multi-layer compression system; leg (below knee), including ankle and foot',
  },
};

export function isSplintingCode(code: string): code is SplintingCode {
  return code in SPLINTING_CODE_INFO;
}

export const codeCandidate = codeCandidateFromInfo(SPLINTING_CODE_INFO);

export const REGION_LABELS: Record<SplintRegion | StrappingRegion, string> = {
  'long-arm': 'the long-arm territory (elbow-to-shoulder involvement)',
  'short-arm': 'the short-arm territory (forearm/wrist)',
  finger: 'a finger',
  'long-leg': 'the long-leg territory (knee/thigh involvement)',
  'short-leg': 'the short-leg territory (calf to foot)',
  chest: 'the chest',
  shoulder: 'the shoulder',
  'elbow-wrist': 'the elbow or wrist',
  'hand-finger': 'the hand or finger',
  hip: 'the hip',
  knee: 'the knee',
  toes: 'the toes',
  'ankle-foot': 'the ankle/foot',
  'unna-boot': 'an Unna boot (leg below the knee)',
  'multi-layer-leg': 'a multi-layer compression system (leg below the knee)',
};

const SPLINT_REGION_MENU_LABELS: Record<SplintRegion, string> = {
  'long-arm': 'long arm',
  'short-arm': 'short arm',
  finger: 'finger',
  'long-leg': 'long leg',
  'short-leg': 'short leg',
};

export const STRAP_REGION_MENU_LABELS: Record<StrapSiteRegion, string> = {
  chest: 'chest',
  shoulder: 'shoulder',
  'elbow-wrist': 'elbow or wrist',
  'hand-finger': 'hand or finger',
  hip: 'hip',
  knee: 'knee',
  toes: 'toes',
  'ankle-foot': 'ankle/foot',
};

export const SPLINT_REGION_MENU = joinWithOr([
  ...new Set(
    Object.values(SPLINTING_CODE_INFO)
      .filter((info): info is SplintCodeInfo => info.kind === 'splint')
      .map((info) => SPLINT_REGION_MENU_LABELS[info.region])
  ),
]);

export const STRAP_REGION_MENU = joinWithOr(Object.values(STRAP_REGION_MENU_LABELS));
export const ALL_SPLINTING_CODES = Object.values(SPLINTING_CODES);
export const SPLINT_CODES = ALL_SPLINTING_CODES.filter((code) => SPLINTING_CODE_INFO[code].kind === 'splint');
export const STRAPPING_CODES = ALL_SPLINTING_CODES.filter((code) => SPLINTING_CODE_INFO[code].kind === 'strapping');
export const COMPRESSION_CODES = [SPLINTING_CODES.unnaBoot, SPLINTING_CODES.multiLayerCompression];

export function codeRange(codes: string[]): string {
  const sorted = [...codes].sort();
  return `${sorted[0]}–${sorted[sorted.length - 1]}`;
}

export const KIND_ASK_CLAUSE = `whether a splint or strapping was applied selects between the splint codes (${codeRange(
  SPLINT_CODES
)}) and the strapping codes (${codeRange(STRAPPING_CODES)})`;

export function staticDynamicPair(region: 'short-arm' | 'finger'): {
  staticCode: SplintingCode;
  dynamicCode: SplintingCode;
} {
  return region === 'short-arm'
    ? {
        staticCode: SPLINTING_CODES.shortArmStaticSplint,
        dynamicCode: SPLINTING_CODES.shortArmDynamicSplint,
      }
    : { staticCode: SPLINTING_CODES.fingerStaticSplint, dynamicCode: SPLINTING_CODES.fingerDynamicSplint };
}

export const SPLINT_CODE_BY_REGION: Record<Exclude<SplintRegion, 'short-arm' | 'finger'>, SplintingCode> = {
  'long-arm': SPLINTING_CODES.longArmSplint,
  'long-leg': SPLINTING_CODES.longLegSplint,
  'short-leg': SPLINTING_CODES.shortLegSplint,
};

export const STRAPPING_CODE_BY_REGION: Record<StrappingRegion, SplintingCode> = {
  chest: SPLINTING_CODES.chestStrapping,
  shoulder: SPLINTING_CODES.shoulderStrapping,
  'elbow-wrist': SPLINTING_CODES.elbowWristStrapping,
  'hand-finger': SPLINTING_CODES.handFingerStrapping,
  hip: SPLINTING_CODES.hipStrapping,
  knee: SPLINTING_CODES.kneeStrapping,
  'ankle-foot': SPLINTING_CODES.ankleFootStrapping,
  toes: SPLINTING_CODES.toeStrapping,
  'unna-boot': SPLINTING_CODES.unnaBoot,
  'multi-layer-leg': SPLINTING_CODES.multiLayerCompression,
};

export const COMPRESSION_APPLIANCE_LABEL: Record<string, string> = {
  [SPLINTING_CODES.unnaBoot]: 'an Unna boot (zinc paste) dressing',
  [SPLINTING_CODES.multiLayerCompression]: 'a multi-layer compression system',
};
