/**
 * Converts CDSi supporting data (CDC XML, plus AIRA's medical-societies XML for the seasonal antigens)
 * into the JSON the immunization forecast engine ships under
 * packages/utils/lib/immunization-forecast/data/<version>/.
 *
 * Usage:
 *   npx tsx scripts/immunization-forecast/convert-supporting-data.ts \
 *     --cdc "<unzipped CDC folder>/XML" --cdc-version 4.64 \
 *     --aira "<unzipped AIRA folder>/XML" --aira-version 26.1 \
 *     --out packages/utils/lib/immunization-forecast/data/2026-11
 *
 * Antigens present in the AIRA folder replace the CDC ones (AIRA 26.1 ships Influenza, RSV, COVID-19 only).
 * Series that require a coded patient observation (Risk series with indications) are dropped: the engine
 * has no coded conditions (decision #6, option C: per-vaccine marks instead).
 */
import fs from 'node:fs';
import path from 'node:path';
import type {
  AllowableIntervalRule,
  AllowableVaccineRule,
  AntigenRules,
  ConditionalSkipRule,
  CvxMapEntry,
  LiveVirusConflictRule,
  PreferableVaccineRule,
  RulesManifest,
  ScheduleRules,
  SeriesAgeRule,
  SeriesDoseRule,
  SeriesIntervalRule,
  SeriesRule,
  SkipCondition,
  SkipConditionType,
  SkipSet,
  VaccineGroupRule,
} from '../../packages/utils/lib/immunization-forecast/rules-types';
import { child, children, parseXml, text, XmlElement } from './xml';

/** Antigens the v1 engine forecasts (decision #6: everything routine, children + adults). */
const ANTIGENS = [
  'COVID-19',
  'Diphtheria',
  'HepA',
  'HepB',
  'Hib',
  'HPV',
  'Influenza',
  'Measles',
  'Meningococcal',
  'Meningococcal B',
  'Mumps',
  'Pertussis',
  'Pneumococcal',
  'Polio',
  'Rotavirus',
  'RSV',
  'Rubella',
  'Tetanus',
  'Varicella',
  'Zoster',
];

const CDC_URL = 'https://www.cdc.gov/iis/cdsi/index.html';
const AIRA_URL = 'https://www.immregistries.org/clinical-decision-support';

function arg(name: string, required = true): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || i + 1 >= process.argv.length) {
    if (required) throw new Error(`Missing --${name}`);
    return undefined;
  }
  return process.argv[i + 1];
}

function readXml(file: string): XmlElement {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  const doc = parseXml(raw);
  if (doc.children.length !== 1) throw new Error(`${file}: expected one root element`);
  return doc.children[0];
}

const isoDate = (s: string | undefined): string | undefined =>
  s && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;

const yes = (s: string | undefined): boolean => (s ?? '').trim().toLowerCase() === 'yes' || s === 'Y';

const num = (s: string | undefined): number | undefined => {
  if (s === undefined || s.toLowerCase() === 'n/a') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const list = (s: string | undefined): string[] | undefined => {
  if (!s || s.toLowerCase() === 'n/a') return undefined;
  const items = s
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
};

const strip = <T extends object>(o: T): T => {
  for (const k of Object.keys(o) as (keyof T)[]) {
    const v = o[k];
    if (v === undefined) delete o[k];
  }
  return o;
};

function convertAge(el: XmlElement): SeriesAgeRule {
  return strip({
    absMinAge: text(el, 'absMinAge'),
    minAge: text(el, 'minAge'),
    earliestRecAge: text(el, 'earliestRecAge'),
    latestRecAge: text(el, 'latestRecAge'),
    maxAge: text(el, 'maxAge'),
    effectiveDate: isoDate(text(el, 'effectiveDate')),
    cessationDate: isoDate(text(el, 'cessationDate')),
  });
}

function convertInterval(el: XmlElement): SeriesIntervalRule {
  const priority = text(el, 'intervalPriority')?.toLowerCase();
  return strip({
    fromPrevious: text(el, 'fromPrevious') === 'Y',
    fromTargetDose: num(text(el, 'fromTargetDose')),
    fromMostRecent: list(text(el, 'fromMostRecent')),
    fromRelevantObs: text(el, 'fromRelevantObs'),
    absMinInt: text(el, 'absMinInt'),
    minInt: text(el, 'minInt'),
    earliestRecInt: text(el, 'earliestRecInt'),
    latestRecInt: text(el, 'latestRecInt'),
    priority: priority === 'override' ? ('override' as const) : undefined,
    effectiveDate: isoDate(text(el, 'effectiveDate')),
    cessationDate: isoDate(text(el, 'cessationDate')),
  });
}

function convertAllowableInterval(el: XmlElement): AllowableIntervalRule {
  return strip({
    fromPrevious: text(el, 'fromPrevious') === 'Y',
    fromTargetDose: num(text(el, 'fromTargetDose')),
    absMinInt: text(el, 'absMinInt'),
    effectiveDate: isoDate(text(el, 'effectiveDate')),
    cessationDate: isoDate(text(el, 'cessationDate')),
  });
}

function convertPreferable(el: XmlElement): PreferableVaccineRule {
  return strip({
    vaccineType: text(el, 'vaccineType') ?? '',
    cvx: text(el, 'cvx') ?? '',
    beginAge: text(el, 'beginAge'),
    endAge: text(el, 'endAge'),
    tradeName: text(el, 'tradeName'),
    mvx: text(el, 'mvx'),
    volume: text(el, 'volume'),
    forecastVaccineType: text(el, 'forecastVaccineType') === 'Y',
  });
}

function convertAllowable(el: XmlElement): AllowableVaccineRule {
  return strip({
    vaccineType: text(el, 'vaccineType') ?? '',
    cvx: text(el, 'cvx') ?? '',
    beginAge: text(el, 'beginAge'),
    endAge: text(el, 'endAge'),
  });
}

const CONDITION_TYPES: Record<string, SkipConditionType> = {
  age: 'Age',
  interval: 'Interval',
  'vaccine count by age': 'Vaccine Count by Age',
  'vaccine count by date': 'Vaccine Count by Date',
  'vaccine count by date and age': 'Vaccine Count by Date and Age',
  'completed series': 'Completed Series',
};

function convertCondition(el: XmlElement): SkipCondition {
  const rawType = (text(el, 'conditionType') ?? '').toLowerCase();
  const type = CONDITION_TYPES[rawType];
  if (!type) throw new Error(`Unknown conditional skip condition type "${rawType}"`);
  const logic = text(el, 'doseCountLogic')?.toLowerCase();
  const doseType = text(el, 'doseType')?.toLowerCase();
  return strip({
    id: num(text(el, 'conditionID')) ?? 0,
    type,
    startDate: isoDate(text(el, 'startDate')),
    endDate: isoDate(text(el, 'endDate')),
    beginAge: text(el, 'beginAge'),
    endAge: text(el, 'endAge'),
    interval: text(el, 'interval'),
    doseCount: num(text(el, 'doseCount')),
    doseType: doseType === 'valid' ? ('Valid' as const) : doseType === 'total' ? ('Total' as const) : undefined,
    doseCountLogic:
      logic === 'greater than'
        ? ('greater than' as const)
        : logic === 'equal to'
        ? ('equal to' as const)
        : logic === 'less than'
        ? ('less than' as const)
        : undefined,
    vaccineTypes: list(text(el, 'vaccineTypes')),
    seriesGroups: list(text(el, 'seriesGroups'))?.map(Number),
  });
}

function convertSkip(el: XmlElement): ConditionalSkipRule {
  const context = text(el, 'context');
  if (context !== 'Evaluation' && context !== 'Forecast' && context !== 'Both') {
    throw new Error(`Unknown conditional skip context "${context}"`);
  }
  const setLogic = text(el, 'setLogic')?.toUpperCase();
  return strip({
    context,
    setLogic: setLogic === 'AND' || setLogic === 'OR' ? setLogic : undefined,
    sets: children(el, 'set').map((s): SkipSet => {
      const conditionLogic = text(s, 'conditionLogic')?.toUpperCase();
      return strip({
        id: num(text(s, 'setID')) ?? 0,
        description: text(s, 'setDescription'),
        effectiveDate: isoDate(text(s, 'effectiveDate')),
        cessationDate: isoDate(text(s, 'cessationDate')),
        conditionLogic: conditionLogic === 'AND' || conditionLogic === 'OR' ? conditionLogic : undefined,
        conditions: children(s, 'condition').map(convertCondition),
      });
    }),
  });
}

function convertDose(el: XmlElement): SeriesDoseRule {
  const seasonal = child(el, 'seasonalRecommendation');
  const seasonalRecommendation = seasonal
    ? strip({ startDate: isoDate(text(seasonal, 'startDate')), endDate: isoDate(text(seasonal, 'endDate')) })
    : undefined;
  return strip({
    doseNumber: text(el, 'doseNumber') ?? '',
    ages: children(el, 'age')
      .map(convertAge)
      .filter((a) => Object.keys(a).length > 0),
    intervals: children(el, 'interval')
      .filter((i) => i.children.length > 0)
      .map(convertInterval),
    allowableIntervals: children(el, 'allowableInterval')
      .filter((i) => i.children.length > 0)
      .map(convertAllowableInterval),
    preferableVaccines: children(el, 'preferableVaccine').map(convertPreferable),
    allowableVaccines: children(el, 'allowableVaccine').map(convertAllowable),
    inadvertentVaccines: children(el, 'inadvertentVaccine')
      .map((v) => text(v, 'cvx'))
      .filter((cvx): cvx is string => !!cvx),
    conditionalSkips: children(el, 'conditionalSkip')
      .filter((s) => s.children.length > 0)
      .map(convertSkip),
    recurringDose: yes(text(el, 'recurringDose')),
    seasonalRecommendation:
      seasonalRecommendation && Object.keys(seasonalRecommendation).length > 0 ? seasonalRecommendation : undefined,
  });
}

function convertSeries(el: XmlElement): SeriesRule {
  const select = child(el, 'selectSeries');
  if (!select) throw new Error(`Series "${text(el, 'seriesName')}" has no selectSeries`);
  const seriesType = text(el, 'seriesType');
  if (seriesType !== 'Standard' && seriesType !== 'Risk' && seriesType !== 'Evaluation Only') {
    throw new Error(`Unknown series type "${seriesType}"`);
  }
  const genders = children(el, 'requiredGender')
    .map((g) => g.text.trim())
    .filter((g): g is 'Female' | 'Male' | 'Unknown' => g === 'Female' || g === 'Male' || g === 'Unknown');
  const requiresIndication = children(el, 'indication').some((i) => i.children.length > 0);
  return strip({
    seriesName: text(el, 'seriesName') ?? '',
    targetDisease: text(el, 'targetDisease') ?? '',
    vaccineGroup: text(el, 'vaccineGroup') ?? '',
    seriesType,
    equivalentSeriesGroups: list(text(el, 'equivalentSeriesGroups'))?.map(Number),
    requiredGender: genders.length ? genders : undefined,
    select: strip({
      defaultSeries: yes(text(select, 'defaultSeries')),
      productPath: yes(text(select, 'productPath')),
      seriesGroupName: text(select, 'seriesGroupName'),
      seriesGroup: num(text(select, 'seriesGroup')) ?? 1,
      seriesPriority: text(select, 'seriesPriority'),
      seriesPreference: num(text(select, 'seriesPreference')) ?? 99,
      minAgeToStart: text(select, 'minAgeToStart'),
      maxAgeToStart: text(select, 'maxAgeToStart'),
    }),
    requiresIndication,
    seriesAdminGuidance: children(el, 'seriesAdminGuidance')
      .map((g) => g.text.trim())
      .filter(Boolean),
    doses: children(el, 'seriesDose').map(convertDose),
  });
}

function convertAntigen(file: string, source: string): AntigenRules {
  const root = readXml(file);
  const allSeries = children(root, 'series').map(convertSeries);
  const series = allSeries.filter((s) => !s.requiresIndication);
  const antigen = series[0]?.targetDisease ?? allSeries[0]?.targetDisease;
  if (!antigen) throw new Error(`${file}: no series found`);
  const immunityEl = child(root, 'immunity');
  const birth = immunityEl ? children(immunityEl, 'dateOfBirth')[0] : undefined;
  const birthDate = birth ? text(birth, 'immunityBirthDate') : undefined;
  const m = birthDate ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(birthDate) : null;
  const immunity = m
    ? strip({ birthDate: `${m[3]}-${m[1]}-${m[2]}`, birthCountry: text(birth!, 'birthCountry') })
    : undefined;
  console.log(`  ${antigen}: ${series.length} of ${allSeries.length} series kept (${source})`);
  return strip({ antigen, source, immunity, series });
}

function convertSchedule(file: string): ScheduleRules {
  const root = readXml(file);
  const cvxToAntigen: CvxMapEntry[] = children(child(root, 'cvxToAntigenMap')!, 'cvxMap').map((m) => ({
    cvx: text(m, 'cvx') ?? '',
    shortDescription: text(m, 'shortDescription') ?? '',
    associations: children(m, 'association').map((a) =>
      strip({
        antigen: text(a, 'antigen') ?? '',
        beginAge: text(a, 'associationBeginAge'),
        endAge: text(a, 'associationEndAge'),
      })
    ),
  }));
  const liveVirusConflicts: LiveVirusConflictRule[] = children(
    child(root, 'liveVirusConflicts')!,
    'liveVirusConflict'
  ).map((c) => ({
    previousCvx: text(child(c, 'previous')!, 'cvx') ?? '',
    currentCvx: text(child(c, 'current')!, 'cvx') ?? '',
    conflictBeginInterval: text(c, 'conflictBeginInterval') ?? '0 days',
    minConflictEndInterval: text(c, 'minConflictEndInterval') ?? '0 days',
    conflictEndInterval: text(c, 'conflictEndInterval') ?? '0 days',
  }));
  const fullGroup = new Map(
    children(child(root, 'vaccineGroups')!, 'vaccineGroup').map((g) => [
      text(g, 'name') ?? '',
      text(g, 'administerFullVaccineGroup'),
    ])
  );
  const vaccineGroups: VaccineGroupRule[] = children(child(root, 'vaccineGroupToAntigenMap')!, 'vaccineGroupMap')
    .map((g) => {
      const name = text(g, 'name') ?? '';
      const flag = fullGroup.get(name);
      return strip({
        name,
        antigens: children(g, 'antigen').map((a) => a.text.trim()),
        administerFullVaccineGroup: flag === undefined ? undefined : yes(flag),
      });
    })
    .filter((g) => g.antigens.some((a) => ANTIGENS.includes(a)));
  return {
    cvxToAntigen: cvxToAntigen.filter((m) => m.associations.some((a) => ANTIGENS.includes(a.antigen))),
    liveVirusConflicts,
    vaccineGroups,
  };
}

function findAntigenFile(dir: string, antigen: string): string | undefined {
  const files = fs.readdirSync(dir);
  const wanted = `antigensupportingdata- ${antigen}`.toLowerCase();
  return files
    .filter((f) => f.toLowerCase().endsWith('.xml'))
    .map((f) => path.join(dir, f))
    .find((f) => {
      const base = path.basename(f, '.xml').toLowerCase().replace(/-508$/, '');
      return base === wanted;
    });
}

function main(): void {
  const cdcDir = arg('cdc')!;
  const cdcVersion = arg('cdc-version')!;
  const airaDir = arg('aira', false);
  const airaVersion = arg('aira-version', false);
  const outDir = arg('out')!;
  const version = path.basename(outDir);
  // --antigens "Influenza,RSV" converts only those antigens and writes no schedule or manifest (test fixtures).
  const onlyAntigens = arg('antigens', false)
    ?.split(',')
    .map((a) => a.trim());

  fs.mkdirSync(path.join(outDir, 'antigens'), { recursive: true });

  const cdcSource = `cdc-${cdcVersion}`;
  const airaSource = airaVersion ? `aira-${airaVersion}` : undefined;
  const fromCdc: string[] = [];
  const fromAira: string[] = [];

  console.log('Antigens:');
  for (const antigen of onlyAntigens ?? ANTIGENS) {
    const airaFile = airaDir ? findAntigenFile(airaDir, antigen) : undefined;
    const file = airaFile ?? findAntigenFile(cdcDir, antigen);
    if (!file) throw new Error(`No supporting data file for ${antigen}`);
    const source = airaFile && airaSource ? airaSource : cdcSource;
    (airaFile ? fromAira : fromCdc).push(antigen);
    const rules = convertAntigen(file, source);
    const outFile = path.join(outDir, 'antigens', `${antigen.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`);
    fs.writeFileSync(outFile, JSON.stringify(rules, null, 1) + '\n');
  }
  if (onlyAntigens) {
    console.log(`Wrote ${outDir} (antigens only)`);
    return;
  }

  const scheduleFile = path.join(cdcDir, 'ScheduleSupportingData.xml');
  const schedule = convertSchedule(scheduleFile);
  if (airaDir) {
    // AIRA ships its own schedule file with the CVX codes its seasonal antigens need (e.g. CVX 338).
    const airaSchedule = convertSchedule(path.join(airaDir, 'ScheduleSupportingData.xml'));
    const known = new Set(schedule.cvxToAntigen.map((m) => m.cvx));
    for (const m of airaSchedule.cvxToAntigen) if (!known.has(m.cvx)) schedule.cvxToAntigen.push(m);
  }
  schedule.cvxToAntigen.sort((a, b) => Number(a.cvx) - Number(b.cvx));
  fs.writeFileSync(path.join(outDir, 'schedule.json'), JSON.stringify(schedule, null, 1) + '\n');
  console.log(
    `Schedule: ${schedule.cvxToAntigen.length} CVX codes, ${schedule.liveVirusConflicts.length} live virus conflicts, ${schedule.vaccineGroups.length} vaccine groups`
  );

  const manifest: RulesManifest = {
    version,
    generatedAt: new Date().toISOString().slice(0, 10),
    sources: [
      {
        name: 'CDC CDSi Supporting Data',
        version: cdcVersion,
        url: CDC_URL,
        file: `supporting-data-${cdcVersion}-508.zip`,
        antigens: fromCdc,
      },
      ...(airaSource
        ? [
            {
              name: 'AIRA medical societies (AAP/AAFP/ACOG/IDSA) Supporting Data',
              version: airaVersion!,
              url: AIRA_URL,
              file: `Version ${airaVersion}.zip`,
              antigens: fromAira,
            },
          ]
        : []),
    ],
    notes: [
      'Series that require a coded patient observation (Risk series with indications) are not shipped.',
      'Contraindication and immunity tables are not shipped: the engine takes per-vaccine marks instead.',
    ],
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${outDir}`);
}

main();
