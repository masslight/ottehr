/**
 * Zambda performance bench.
 *
 * Boots the real local-server express app in-process, seeds (or reuses) a tracking-board-shaped
 * fixture, then invokes a zambda repeatedly over HTTP and reports latency plus a waterfall of every
 * FHIR round trip the handler made. The waterfall's "wave" count is the number of *sequential* FHIR
 * round trips — the quantity that actually sets the floor on latency — and repeated labels within a
 * wave expose N+1 fan-outs.
 *
 * Always run against the local Ottehr environment:
 *
 *   ENV=local npx tsx scripts/perf/bench.ts --scenario=get-appointments
 *   ENV=local npx tsx scripts/perf/bench.ts --scenario=get-appointments --iters=9 --appointments=40
 *   ENV=local npx tsx scripts/perf/bench.ts --teardown
 *
 * Flags:
 *   --scenario=<name>     which scenario to run (default: get-appointments)
 *   --iters=<n>           timed iterations (default 7)
 *   --warmup=<n>          untimed warmup iterations, to prime module-scope caches (default 2)
 *   --appointments=<n>    tracking-board fixture size when seeding (default 30)
 *   --visits=<n>          patient-details visit-history size when seeding (default 10)
 *   --reseed              force a fresh fixture even if a cached one is alive
 *   --all                 run every scenario briefly and rank them by latency (a survey, not a benchmark)
 *   --teardown            delete the cached fixture and exit
 *   --json=<path>         also write the result to a JSON file, for before/after diffing
 *   --label=<name>        label recorded in the JSON output (e.g. "baseline", "batched-provenance")
 *   --quiet-waterfall     skip the per-invocation waterfall dump
 *   --dump=<path>         write the full zambda response body to a file, for before/after diffing
 *   --handler-logs        do not silence the handler's own console output
 */
import Oystehr from '@oystehr/sdk';
import { writeFileSync } from 'fs';
import { progressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { ServiceMode } from 'utils/lib/types/common';
import { getCurrentQuestionnaireForServiceType } from '../../src/patient/appointment/helpers';
import {
  allCachedFixtures,
  fixtureIsAlive,
  forgetCachedFixture,
  PATIENT_DETAILS_FIXTURE_KIND,
  PatientDetailsFixture,
  patientDetailsFixtureIsAlive,
  readCachedFixture,
  seedPatientDetailsFixture,
  seedTrackingBoardFixture,
  seedVisitDetailsFixture,
  teardownAllFixtures,
  teardownFixture,
  TRACKING_BOARD_FIXTURE_KIND,
  TrackingBoardFixture,
  VISIT_DETAILS_FIXTURE_KIND,
  VisitDetailsFixture,
  visitDetailsFixtureIsAlive,
} from './fixtures';
import {
  BenchServer,
  fmt,
  groupIntoWaves,
  printWaterfall,
  recorder,
  say,
  silenceHandlerLogs,
  startBenchServer,
  summarize,
} from './lib';

interface Scenario<TFixture = any> {
  name: string;
  /** Seeds (or reuses) whatever data this scenario needs to measure real work. */
  resolveFixture: (
    server: BenchServer,
    opts: { appointments: number; visits: number; reseed: boolean }
  ) => Promise<TFixture>;
  /** Builds the zambda.execute payload for this scenario. */
  buildInput: (fixture: TFixture) => Record<string, unknown>;
  /** Optional one-line summary of the response, to confirm the bench is measuring real work. */
  describeOutput?: (output: any) => string;
}

const SCENARIOS: Record<string, Scenario> = {
  'get-appointments': {
    name: 'get-appointments',
    resolveFixture: (server, opts) => resolveTrackingBoardFixture(server.oystehrAdmin, opts),
    buildInput: (fixture: TrackingBoardFixture) => ({
      id: 'get-appointments',
      searchDateFrom: fixture.searchDate,
      searchDateTo: fixture.searchDate,
      timezone: fixture.timezone,
      visitType: ['in-person-walk-in'],
      locationIds: [fixture.locationId],
    }),
    describeOutput: (output) =>
      `preBooked=${output?.preBooked?.length ?? 0} inOffice=${output?.inOffice?.length ?? 0} completed=${
        output?.completed?.length ?? 0
      } cancelled=${output?.cancelled?.length ?? 0}`,
  },
  // The progress note fires two get-chart-data calls on mount: `useChartData` sends no
  // requestedFields (the "everything" default) and `useChartFields` sends the progress-note field
  // set. Both are benched.
  'get-chart-data-default': {
    name: 'get-chart-data-default',
    resolveFixture: (server, opts) => resolveVisitDetailsFixture(server, opts),
    buildInput: (fixture: VisitDetailsFixture) => ({
      id: 'get-chart-data',
      encounterId: fixture.encounterId,
    }),
    describeOutput: (output) => `keys=${Object.keys(output ?? {}).length}`,
  },
  'get-chart-data-progress-note': {
    name: 'get-chart-data-progress-note',
    resolveFixture: (server, opts) => resolveVisitDetailsFixture(server, opts),
    buildInput: (fixture: VisitDetailsFixture) => ({
      id: 'get-chart-data',
      encounterId: fixture.encounterId,
      requestedFields: progressNoteChartDataRequestedFields,
    }),
    describeOutput: (output) => `keys=${Object.keys(output ?? {}).length}`,
  },
  // The tracking board also asks for every visible encounter's vitals in one call.
  'get-vitals-for-list-of-encounters': {
    name: 'get-vitals-for-list-of-encounters',
    resolveFixture: (server, opts) => resolveTrackingBoardFixture(server.oystehrAdmin, opts),
    buildInput: (fixture: TrackingBoardFixture) => ({
      id: 'get-vitals-for-list-of-encounters',
      encounterIds: fixture.encounterIds,
    }),
    describeOutput: (output) => {
      const encounters = Object.keys(output ?? {});
      const vitals = Object.values(output ?? {}).reduce<number>(
        (total, map) => total + Object.keys(map ?? {}).length,
        0
      );
      return `encounters=${encounters.length} vitalFields=${vitals}`;
    },
  },
  'get-patient-visit-history': {
    name: 'get-patient-visit-history',
    resolveFixture: (server, opts) => resolvePatientDetailsFixture(server.oystehrAdmin, opts),
    buildInput: (fixture: PatientDetailsFixture) => ({
      id: 'get-patient-visit-history',
      patientId: fixture.patientId,
    }),
    describeOutput: (output) => `visits=${output?.visits?.length ?? 0} total=${output?.metadata?.totalCount ?? 0}`,
  },
  'get-patient-account': {
    name: 'get-patient-account',
    resolveFixture: (server, opts) => resolvePatientDetailsFixture(server.oystehrAdmin, opts),
    buildInput: (fixture: PatientDetailsFixture) => ({
      id: 'get-patient-account',
      patientId: fixture.patientId,
    }),
    describeOutput: (output) =>
      `patient=${output?.patient?.id ? 'yes' : 'no'} coverages=${
        Object.values(output?.coverages ?? {}).filter(Boolean).length
      } eligibilityChecks=${output?.coverageChecks?.length ?? 0} guarantor=${
        output?.guarantorResource?.resourceType ?? 'none'
      } pcp=${output?.primaryCarePhysician ? 'yes' : 'no'}`,
  },
  'ehr-get-visit-details': {
    name: 'ehr-get-visit-details',
    resolveFixture: (server, opts) => resolveVisitDetailsFixture(server, opts),
    buildInput: (fixture: VisitDetailsFixture) => ({
      id: 'ehr-get-visit-details',
      appointmentId: fixture.appointmentId,
    }),
    describeOutput: (output) =>
      `appointment=${output?.appointment?.id ? 'yes' : 'no'} patient=${output?.patient?.id ? 'yes' : 'no'} flags=${
        output?.flags?.length ?? 0
      } timezone=${output?.visitTimezone} consent=${output?.consentDetails ? 'yes' : 'no'} responsibleParty=${
        output?.responsiblePartyName ?? 'none'
      }`,
  },
};

/**
 * Survey scenarios: the remaining EHR-facing, non-admin, auth'd getter endpoints, wired to the ids
 * the existing fixtures already provide. These exist so `--all` can produce a *measured* ranking of
 * where the remaining latency is, rather than picking targets by reading code. Their inputs are the
 * shapes the EHR actually sends; anything that errors is reported as such by `--all` rather than
 * aborting the survey.
 */
const surveyScenario = (
  name: string,
  fixtureKind: 'tracking-board' | 'visit-details' | 'patient-details',
  buildInput: (fixture: any) => Record<string, unknown>
): Scenario => ({
  name,
  resolveFixture: (server, opts) =>
    fixtureKind === 'tracking-board'
      ? resolveTrackingBoardFixture(server.oystehrAdmin, opts)
      : fixtureKind === 'visit-details'
      ? resolveVisitDetailsFixture(server, opts)
      : resolvePatientDetailsFixture(server.oystehrAdmin, opts),
  buildInput: (fixture) => ({ id: name, ...buildInput(fixture) }),
});

const SURVEY: Record<string, Scenario> = {
  // encounter-scoped readers, from the visit-details fixture's encounter
  'get-vitals': surveyScenario('get-vitals', 'visit-details', (f) => ({
    encounterId: f.encounterId,
    currentOrHistorical: 'current',
  })),
  'get-medication-orders': surveyScenario('get-medication-orders', 'tracking-board', (f) => ({
    searchBy: { field: 'encounterIds', value: f.encounterIds },
  })),
  'get-nursing-orders': surveyScenario('get-nursing-orders', 'tracking-board', (f) => ({
    searchBy: { field: 'encounterIds', value: f.encounterIds },
  })),
  'get-erx-orders': surveyScenario('get-erx-orders', 'tracking-board', (f) => ({
    encounterIds: f.encounterIds,
  })),
  'get-immunization-orders': surveyScenario('get-immunization-orders', 'tracking-board', (f) => ({
    encounterIds: f.encounterIds,
  })),
  'get-lab-orders': surveyScenario('get-lab-orders', 'tracking-board', (f) => ({
    searchBy: { field: 'encounterIds', value: f.encounterIds },
    itemsPerPage: 100,
    pageIndex: 0,
  })),
  'get-in-house-orders': surveyScenario('get-in-house-orders', 'tracking-board', (f) => ({
    searchBy: { field: 'encounterIds', value: f.encounterIds },
    itemsPerPage: 100,
    pageIndex: 0,
  })),

  // patient-scoped readers
  'get-patient-balances': surveyScenario('get-patient-balances', 'patient-details', (f) => ({
    patientId: f.patientId,
  })),
  'get-login-phone-numbers': surveyScenario('get-login-phone-numbers', 'patient-details', (f) => ({
    patientId: f.patientId,
  })),
  'get-patient-profile-photo-url': surveyScenario('get-patient-profile-photo-url', 'patient-details', (f) => ({
    patientId: f.patientId,
  })),
  'get-conversation': surveyScenario('get-conversation', 'patient-details', (f) => ({
    patientId: f.patientId,
    timezone: 'America/New_York',
  })),

  // appointment-scoped readers
  'get-visit-files': surveyScenario('get-visit-files', 'visit-details', (f) => ({
    appointmentId: f.appointmentId,
  })),
  'get-visit-fax-history': surveyScenario('get-visit-fax-history', 'visit-details', (f) => ({
    appointmentId: f.appointmentId,
  })),
  'get-invoices-tasks': surveyScenario('get-invoices-tasks', 'patient-details', (f) => ({
    patientId: f.patientId,
  })),
  'get-action-logs': surveyScenario('get-action-logs', 'patient-details', (f) => ({
    channel: 'fax',
    patientId: f.patientId,
    pageIndex: 0,
  })),

  // config / list readers the EHR loads without any id
  'get-patient-instructions': surveyScenario('get-patient-instructions', 'visit-details', () => ({})),
  'get-progress-note-config': surveyScenario('get-progress-note-config', 'visit-details', () => ({})),
  'get-support-dialog': surveyScenario('get-support-dialog', 'visit-details', () => ({})),
  'get-label-printing-config': surveyScenario('get-label-printing-config', 'visit-details', () => ({})),
  'get-in-house-medications': surveyScenario('get-in-house-medications', 'visit-details', () => ({})),
  'get-em-codes': surveyScenario('get-em-codes', 'visit-details', () => ({})),
  'list-templates': surveyScenario('list-templates', 'visit-details', () => ({})),
  'list-adhoc-reports': surveyScenario('list-adhoc-reports', 'visit-details', () => ({})),
  'list-provider-groups': surveyScenario('list-provider-groups', 'visit-details', () => ({})),
  'list-approved-patient-education': surveyScenario('list-approved-patient-education', 'visit-details', () => ({})),
  'get-employees': surveyScenario('get-employees', 'visit-details', () => ({})),

  // Clinical order screens: radiology orders render on both the tracking board and the visit screen;
  // the lab-order-resources pair loads when a provider opens the corresponding order form.
  // The tracking board's filter row: the provider dropdown calls get-employees in *lite* mode (a
  // different path from the one the visit screens use), and the service-category dropdown calls an
  // admin-*named* endpoint that every board user nonetheless loads.
  'get-employees-lite': {
    name: 'get-employees',
    resolveFixture: (server, opts) => resolveVisitDetailsFixture(server, opts),
    buildInput: () => ({ id: 'get-employees', lite: true }),
    describeOutput: (output) => `employees=${output?.employees?.length ?? 0}`,
  },
  'admin-list-service-categories': surveyScenario('admin-list-service-categories', 'visit-details', () => ({})),
  'radiology-order-list': surveyScenario('radiology-order-list', 'tracking-board', (f) => ({
    encounterIds: f.encounterIds,
  })),
  'get-create-lab-order-resources': surveyScenario('get-create-lab-order-resources', 'visit-details', (f) => ({
    encounterId: f.encounterId,
    patientId: f.patientId,
  })),
  'get-create-in-house-lab-order-resources': surveyScenario(
    'get-create-in-house-lab-order-resources',
    'visit-details',
    (f) => ({ encounterId: f.encounterId })
  ),
};

const ALL_SCENARIOS: Record<string, Scenario> = { ...SCENARIOS, ...SURVEY };

const parseArgs = (): Record<string, string | boolean> => {
  const args: Record<string, string | boolean> = {};
  process.argv.slice(2).forEach((raw) => {
    if (!raw.startsWith('--')) return;
    const [key, value] = raw.slice(2).split('=');
    args[key] = value === undefined ? true : value;
  });
  return args;
};

const resolveTrackingBoardFixture = async (
  oystehr: Oystehr,
  opts: { appointments: number; reseed: boolean }
): Promise<TrackingBoardFixture> => {
  const cached = readCachedFixture<TrackingBoardFixture>(TRACKING_BOARD_FIXTURE_KIND);
  if (
    !opts.reseed &&
    cached?.tagCode &&
    cached.appointmentCount === opts.appointments &&
    (await fixtureIsAlive(oystehr, cached))
  ) {
    say(`Reusing cached fixture ${cached.tagCode} (${cached.appointmentCount} appointments)`);
    return cached;
  }
  if (cached?.tagCode) {
    say(`Cached fixture ${cached.tagCode} unusable; tearing it down first`);
    await teardownFixture(oystehr, cached);
    forgetCachedFixture(TRACKING_BOARD_FIXTURE_KIND);
  }
  say(`Seeding fixture with ${opts.appointments} appointments...`);
  const fixture = await seedTrackingBoardFixture(oystehr, opts.appointments);
  say(`Seeded fixture ${fixture.tagCode}`);
  return fixture;
};

const resolvePatientDetailsFixture = async (
  oystehr: Oystehr,
  opts: { visits: number; reseed: boolean }
): Promise<PatientDetailsFixture> => {
  const cached = readCachedFixture<PatientDetailsFixture>(PATIENT_DETAILS_FIXTURE_KIND);
  if (
    !opts.reseed &&
    cached?.patientId &&
    cached.visitCount === opts.visits &&
    (await patientDetailsFixtureIsAlive(oystehr, cached))
  ) {
    say(`Reusing cached patient-details fixture ${cached.tagCode} (${cached.visitCount} visits)`);
    return cached;
  }
  if (cached?.tagCode) {
    say(`Cached patient-details fixture ${cached.tagCode} unusable; tearing it down first`);
    await teardownFixture(oystehr, cached);
    forgetCachedFixture(PATIENT_DETAILS_FIXTURE_KIND);
  }
  say(`Seeding patient-details fixture with ${opts.visits} past visits...`);
  const fixture = await seedPatientDetailsFixture(oystehr, opts.visits);
  say(`Seeded patient-details fixture ${fixture.tagCode}`);
  return fixture;
};

const resolveVisitDetailsFixture = async (
  server: BenchServer,
  opts: { reseed: boolean }
): Promise<VisitDetailsFixture> => {
  const cached = readCachedFixture<VisitDetailsFixture>(VISIT_DETAILS_FIXTURE_KIND);
  if (!opts.reseed && cached?.appointmentId && (await visitDetailsFixtureIsAlive(server.oystehrAdmin, cached))) {
    say(`Reusing cached visit-details fixture ${cached.tagCode}`);
    return cached;
  }
  if (cached?.tagCode) {
    say(`Cached visit-details fixture ${cached.tagCode} unusable; tearing it down first`);
    await teardownFixture(server.oystehrAdmin, cached);
    forgetCachedFixture(VISIT_DETAILS_FIXTURE_KIND);
  }
  // The QR has to point at the instance's *active* intake questionnaire, or the handler rejects the
  // appointment for having no intake paperwork.
  const questionnaire = await getCurrentQuestionnaireForServiceType(ServiceMode['in-person'], server.oystehrAdmin);
  say(`Seeding visit-details fixture (intake questionnaire ${questionnaire.url}|${questionnaire.version})...`);
  const fixture = await seedVisitDetailsFixture(server.oystehrAdmin, `${questionnaire.url}|${questionnaire.version}`);
  say(`Seeded visit-details fixture ${fixture.tagCode}`);
  return fixture;
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const iters = Number(args.iters ?? 7);
  const warmup = Number(args.warmup ?? 2);
  const appointments = Number(args.appointments ?? 30);
  const visits = Number(args.visits ?? 10);
  const scenarioName = String(args.scenario ?? 'get-appointments');
  const scenario = ALL_SCENARIOS[scenarioName];
  if (!scenario && !args.teardown) {
    throw new Error(`Unknown scenario "${scenarioName}". Known: ${Object.keys(ALL_SCENARIOS).join(', ')}`);
  }

  const handlerLogs = args['handler-logs'] ? undefined : silenceHandlerLogs();
  const server = await startBenchServer();
  try {
    if (args.teardown) {
      // Sweeps by tag system, not by cached fixture id, so a seed that threw partway through — or a
      // fixture whose cache entry was lost — is still cleaned up.
      say('Tearing down every resource this bench has created...');
      const deleted = await teardownAllFixtures(server.oystehrAdmin);
      allCachedFixtures().forEach(({ kind }) => forgetCachedFixture(kind));
      say(deleted ? `Deleted ${deleted} resource(s)` : 'Nothing to tear down');
      return;
    }

    if (args.all) {
      // Measured survey: run every scenario briefly and rank by latency, so targets are chosen from
      // data rather than by reading handlers.
      recorder.install();
      const results: {
        name: string;
        median: number;
        min: number;
        calls: number;
        waves: number;
        note: string;
      }[] = [];
      for (const [name, candidate] of Object.entries(ALL_SCENARIOS)) {
        try {
          const candidateFixture = await candidate.resolveFixture(server, {
            appointments,
            visits,
            reseed: false,
          });
          const candidateInput = candidate.buildInput(candidateFixture);
          await server.oystehrZambda.zambda.execute(candidateInput as any); // warm
          const candidateSamples: number[] = [];
          let calls = 0;
          let waves = 0;
          let note = '';
          for (let i = 0; i < iters; i++) {
            recorder.start();
            const started = performance.now();
            const response = await server.oystehrZambda.zambda.execute(candidateInput as any);
            candidateSamples.push(performance.now() - started);
            const handlerCalls = recorder.stop().filter((c) => !c.host.startsWith('localhost'));
            calls = handlerCalls.length;
            waves = groupIntoWaves(handlerCalls).length;
            if (i === 0) note = candidate.describeOutput?.((response as any).output) ?? '';
          }
          const candidateStats = summarize(candidateSamples);
          results.push({ name, median: candidateStats.median, min: candidateStats.min, calls, waves, note });
          say(
            `${name.padEnd(36)} median=${fmt(candidateStats.median).padStart(7)} min=${fmt(candidateStats.min).padStart(
              7
            )} calls=${String(calls).padStart(3)} waves=${waves}`
          );
        } catch (error: any) {
          say(`${name.padEnd(36)} ERROR: ${String(error?.message ?? error).slice(0, 90)}`);
        }
      }
      say('');
      say('=== ranked by median latency ===');
      results
        .sort((a, b) => b.median - a.median)
        .forEach((r) =>
          say(
            `${fmt(r.median).padStart(7)}  ${r.name.padEnd(36)} calls=${String(r.calls).padStart(3)} waves=${
              r.waves
            }  ${r.note}`
          )
        );
      return;
    }

    const fixture = await scenario.resolveFixture(server, {
      appointments,
      visits,
      reseed: Boolean(args.reseed),
    });

    const input = scenario.buildInput(fixture);
    recorder.install();

    say(`\n=== ${scenario.name} — ${warmup} warmup + ${iters} timed iterations ===`);

    for (let i = 0; i < warmup; i++) {
      const started = performance.now();
      await server.oystehrZambda.zambda.execute(input as any);
      say(`warmup ${i + 1}: ${fmt(performance.now() - started)}`);
    }

    const samples: number[] = [];
    const callCounts: number[] = [];
    const waveCounts: number[] = [];
    let firstOutputSummary = '';

    for (let i = 0; i < iters; i++) {
      recorder.start();
      const started = performance.now();
      const response = await server.oystehrZambda.zambda.execute(input as any);
      const elapsed = performance.now() - started;
      const calls = recorder.stop();
      // Drop the bench's own call to the local zambda server; keep the handler's outbound traffic.
      const handlerCalls = calls.filter((c) => !c.host.startsWith('localhost'));
      samples.push(elapsed);
      callCounts.push(handlerCalls.length);
      waveCounts.push(groupIntoWaves(handlerCalls).length);
      if (i === 0) {
        firstOutputSummary = scenario.describeOutput?.((response as any).output) ?? '';
        if (typeof args.dump === 'string') {
          writeFileSync(args.dump, JSON.stringify((response as any).output, null, 2));
          say(`wrote response dump to ${args.dump}`);
        }
        if (!args['quiet-waterfall']) {
          say(`\n--- waterfall (iteration 1) ---`);
          printWaterfall(handlerCalls);
          say();
        }
      }
      say(`iter ${i + 1}: ${fmt(elapsed)}  (${handlerCalls.length} fhir calls)`);
    }

    const stats = summarize(samples);
    say(`\n=== ${scenario.name} result ===`);
    if (firstOutputSummary) say(`output: ${firstOutputSummary}`);
    say(
      `latency  min=${fmt(stats.min)} median=${fmt(stats.median)} mean=${fmt(stats.mean)} p90=${fmt(
        stats.p90
      )} max=${fmt(stats.max)}  (n=${stats.n})`
    );
    say(
      `fhir calls per invocation: ${Math.min(...callCounts)}–${Math.max(...callCounts)}   sequential waves: ${Math.min(
        ...waveCounts
      )}–${Math.max(...waveCounts)}`
    );

    if (typeof args.json === 'string') {
      writeFileSync(
        args.json,
        JSON.stringify(
          {
            label: args.label ?? 'unlabeled',
            scenario: scenario.name,
            fixture: { tagCode: fixture.tagCode, appointmentCount: (fixture as TrackingBoardFixture).appointmentCount },
            stats,
            samples,
            callCounts,
            waveCounts,
          },
          null,
          2
        )
      );
      say(`wrote ${args.json}`);
    }
  } finally {
    await server.close();
    handlerLogs?.restore();
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
