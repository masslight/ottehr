/**
 * Loads the current rules data version and builds the lookups the engine needs.
 * To move to a new data version: convert it into a sibling folder (see ../README.md) and change the imports here.
 */
import { AntigenRules, CvxMapEntry, LiveVirusConflictRule, RulesManifest, ScheduleRules } from '../rules-types';
import covid19 from './2026-11/antigens/covid-19.json';
import diphtheria from './2026-11/antigens/diphtheria.json';
import hepa from './2026-11/antigens/hepa.json';
import hepb from './2026-11/antigens/hepb.json';
import hib from './2026-11/antigens/hib.json';
import hpv from './2026-11/antigens/hpv.json';
import influenza from './2026-11/antigens/influenza.json';
import measles from './2026-11/antigens/measles.json';
import meningococcal from './2026-11/antigens/meningococcal.json';
import meningococcalB from './2026-11/antigens/meningococcal-b.json';
import mumps from './2026-11/antigens/mumps.json';
import pertussis from './2026-11/antigens/pertussis.json';
import pneumococcal from './2026-11/antigens/pneumococcal.json';
import polio from './2026-11/antigens/polio.json';
import rotavirus from './2026-11/antigens/rotavirus.json';
import rsv from './2026-11/antigens/rsv.json';
import rubella from './2026-11/antigens/rubella.json';
import tetanus from './2026-11/antigens/tetanus.json';
import varicella from './2026-11/antigens/varicella.json';
import zoster from './2026-11/antigens/zoster.json';
import manifestJson from './2026-11/manifest.json';
import scheduleJson from './2026-11/schedule.json';

export interface RulesData {
  manifest: RulesManifest;
  schedule: ScheduleRules;
  antigens: Map<string, AntigenRules>;
  cvxMap: Map<string, CvxMapEntry>;
  /** currentCvx → conflict rules whose impacted (current) vaccine is that CVX. */
  conflictsByCurrentCvx: Map<string, LiveVirusConflictRule[]>;
  /** Vaccine group name → antigens. */
  vaccineGroupAntigens: Map<string, string[]>;
  vaccineGroupAdministerFull: Map<string, boolean>;
}

const ANTIGEN_FILES = [
  covid19,
  diphtheria,
  hepa,
  hepb,
  hib,
  hpv,
  influenza,
  measles,
  meningococcal,
  meningococcalB,
  mumps,
  pertussis,
  pneumococcal,
  polio,
  rotavirus,
  rsv,
  rubella,
  tetanus,
  varicella,
  zoster,
] as unknown as AntigenRules[];

export function buildRulesData(manifest: RulesManifest, schedule: ScheduleRules, antigens: AntigenRules[]): RulesData {
  const conflictsByCurrentCvx = new Map<string, LiveVirusConflictRule[]>();
  for (const c of schedule.liveVirusConflicts) {
    const list = conflictsByCurrentCvx.get(c.currentCvx) ?? [];
    list.push(c);
    conflictsByCurrentCvx.set(c.currentCvx, list);
  }
  return {
    manifest,
    schedule,
    antigens: new Map(antigens.map((a) => [a.antigen, a])),
    cvxMap: new Map(schedule.cvxToAntigen.map((m) => [m.cvx, m])),
    conflictsByCurrentCvx,
    vaccineGroupAntigens: new Map(schedule.vaccineGroups.map((g) => [g.name, g.antigens])),
    vaccineGroupAdministerFull: new Map(
      schedule.vaccineGroups.map((g) => [g.name, g.administerFullVaccineGroup ?? false])
    ),
  };
}

let current: RulesData | undefined;

/** The rules data shipped with this build (built once, then cached). */
export function getRulesData(): RulesData {
  if (!current) {
    current = buildRulesData(manifestJson as RulesManifest, scheduleJson as unknown as ScheduleRules, ANTIGEN_FILES);
  }
  return current;
}
