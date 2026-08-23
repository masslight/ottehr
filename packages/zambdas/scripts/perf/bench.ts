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
 *   --appointments=<n>    fixture size when seeding (default 30)
 *   --reseed              force a fresh fixture even if a cached one is alive
 *   --teardown            delete the cached fixture and exit
 *   --json=<path>         also write the result to a JSON file, for before/after diffing
 *   --label=<name>        label recorded in the JSON output (e.g. "baseline", "batched-provenance")
 *   --quiet-waterfall     skip the per-invocation waterfall dump
 *   --dump=<path>         write the full zambda response body to a file, for before/after diffing
 *   --handler-logs        do not silence the handler's own console output
 */
import { writeFileSync } from 'fs';
import { progressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { ServiceMode } from 'utils/lib/types/common';
import { getCurrentQuestionnaireForServiceType } from '../../src/patient/appointment/helpers';
import {
  allCachedFixtures,
  fixtureIsAlive,
  forgetCachedFixture,
  readCachedFixture,
  seedTrackingBoardFixture,
  seedVisitDetailsFixture,
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
  resolveFixture: (server: BenchServer, opts: { appointments: number; reseed: boolean }) => Promise<TFixture>;
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
  const scenarioName = String(args.scenario ?? 'get-appointments');
  const scenario = SCENARIOS[scenarioName];
  if (!scenario && !args.teardown) {
    throw new Error(`Unknown scenario "${scenarioName}". Known: ${Object.keys(SCENARIOS).join(', ')}`);
  }

  const handlerLogs = args['handler-logs'] ? undefined : silenceHandlerLogs();
  const server = await startBenchServer();
  try {
    if (args.teardown) {
      const cached = allCachedFixtures().filter(({ fixture }) => fixture?.tagCode);
      if (!cached.length) {
        say('No cached fixtures to tear down.');
        return;
      }
      for (const { kind, fixture } of cached) {
        say(`Tearing down ${kind} fixture ${fixture.tagCode}`);
        await teardownFixture(server.oystehrAdmin, fixture);
        forgetCachedFixture(kind);
      }
      return;
    }

    const fixture = await scenario.resolveFixture(server, {
      appointments,
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
