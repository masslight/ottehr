/**
 * Renders the artifacts apply.sh leaves in TF_PROFILE_DIR into a readable
 * profile: how long each deploy phase took, how the single `terraform apply`
 * splits into refresh / plan / apply, and which resources dominated the apply.
 *
 * Usage: TF_PROFILE_DIR=<dir> tsx profile-report.ts
 */
import fs from 'node:fs';
import path from 'node:path';

// Built from a string so the ESC byte does not appear as a literal control
// character in a regex (which `no-control-regex` rejects).
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

interface Stamped {
  at: number;
  text: string;
}

const readStampedLog = (file: string): Stamped[] => {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf-8')
    .split('\n')
    .flatMap((line) => {
      const tab = line.indexOf('\t');
      if (tab < 0) return [];
      const at = Number(line.slice(0, tab));
      if (!Number.isFinite(at)) return [];
      return [{ at, text: line.slice(tab + 1).replace(ANSI, '') }];
    });
};

const first = (log: Stamped[], test: (text: string) => boolean): Stamped | undefined => log.find((l) => test(l.text));
const last = (log: Stamped[], test: (text: string) => boolean): Stamped | undefined =>
  [...log].reverse().find((l) => test(l.text));

const secs = (from?: Stamped, to?: Stamped): string => (from && to ? `${(to.at - from.at).toFixed(1)}s` : '—');

const MUTATION_START = /^(\S+): (Modifying|Creating|Destroying)\.\.\./;
const MUTATION_END = /^(\S+): (Modifications|Creation|Destruction) complete after/;

interface Probe {
  label: string;
  parallelism: number;
  reads: number;
  total: number;
  refresh: number | undefined;
  status: string;
}

const median = (values: number[]): number | undefined => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const renderPlanProbes = (file: string): string[] => {
  const probes: Probe[] = fs
    .readFileSync(file, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [label, parallelism, reads, total, refresh, status] = line.split('\t');
      return {
        label,
        parallelism: Number(parallelism),
        reads: Number(reads),
        total: Number(total),
        refresh: refresh === '-' ? undefined : Number(refresh),
        status,
      };
    });

  const out = [
    '### Plan probes',
    '',
    'Read-only `terraform plan` runs, back to back in this job, so runner and state are held constant.',
    '',
    '| # | Probe | -parallelism | Reads | Total | Refresh window | Status |',
    '| ---: | --- | ---: | ---: | ---: | ---: | --- |',
    ...probes.map(
      (p, i) =>
        `| ${i + 1} | ${p.label} | ${p.parallelism} | ${p.reads} | ${p.total.toFixed(1)}s | ` +
        `${p.refresh === undefined ? '—' : `${p.refresh.toFixed(1)}s`} | ${p.status} |`
    ),
    '',
  ];

  const at = (label: string): Probe[] => probes.filter((p) => p.label === label);
  const totalsOf = (label: string): number[] => at(label).map((p) => p.total);

  // A full plan minus the same plan with -refresh=false is the whole cost of
  // refreshing, and prices `-refresh=false` as a lever.
  const baseline = at('full-norefresh')[0];
  const fullAtBaseline = at('full').filter((p) => p.parallelism === baseline?.parallelism);
  const fullMedian = median(fullAtBaseline.map((p) => p.total));
  const refreshCost = baseline && fullMedian !== undefined ? fullMedian - baseline.total : undefined;

  // The target pair runs the same pruned graph and differs only in refreshing,
  // so the difference is everything refreshing costs on a single resource.
  const targetWith = median(totalsOf('target'));
  const targetWithout = median(totalsOf('target-norefresh'));
  const targetReads = at('target')[0]?.reads ?? 0;
  const fullReads = fullAtBaseline[0]?.reads ?? 0;

  // Turning refresh on costs a fixed amount (Terraform starts and configures the
  // provider, which authenticates) plus the reads themselves. Two probes with
  // very different read counts separate the two:
  //   targetDelta = fixed + targetReads x latency
  //   fullDelta   = fixed + (fullReads / parallelism) x latency
  // Attributing the whole target delta to one read instead would overstate
  // per-read latency by the fixed cost, which is much the larger of the two.
  const targetDelta = targetWith !== undefined && targetWithout !== undefined ? targetWith - targetWithout : undefined;
  const parallelism = baseline?.parallelism ?? 0;
  const fullWaves = parallelism > 0 ? fullReads / parallelism : 0;

  let fixedCost: number | undefined;
  let latency: number | undefined;
  if (targetDelta !== undefined && refreshCost !== undefined && fullWaves !== targetReads) {
    latency = (refreshCost - targetDelta) / (fullWaves - targetReads);
    fixedCost = targetDelta - targetReads * latency;
  }

  out.push('**Derived**', '');
  if (baseline && fullMedian !== undefined) {
    const share = ((baseline.total / fullMedian) * 100).toFixed(0);
    out.push(
      `- A plan that reads nothing still takes **${baseline.total.toFixed(1)}s** — ${share}% of the full ` +
        `${fullMedian.toFixed(1)}s plan. That is Terraform's own graph evaluation and rendering, not the API.`
    );
  }
  if (refreshCost !== undefined) {
    out.push(
      `- Turning refresh on for ${fullReads} resources adds **${refreshCost.toFixed(1)}s**, so \`-refresh=false\` ` +
        'is worth about that much and no more.'
    );
  }
  if (fixedCost !== undefined && latency !== undefined && latency > 0) {
    out.push(
      `- Of that, **${fixedCost.toFixed(1)}s** is fixed cost paid once as soon as anything is read ` +
        '(provider start, configure, authenticate), leaving **' +
        `${(refreshCost! - fixedCost).toFixed(1)}s** of actual reading — about ` +
        `**${latency.toFixed(2)}s** per resource at \`-parallelism=${parallelism}\`.`
    );
    out.push('- Widening `-parallelism` can only shrink that last term, which is why it moves the total so little.');
  }
  out.push('');
  return out;
};

const main = (): void => {
  const profileDir = process.env.TF_PROFILE_DIR;
  if (!profileDir) throw new Error('TF_PROFILE_DIR is required');

  const phasesFile = path.join(profileDir, 'phases.tsv');
  const phases = fs.existsSync(phasesFile)
    ? fs
        .readFileSync(phasesFile, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [name, seconds] = line.split('\t');
          return { name, seconds: Number(seconds) };
        })
    : [];

  const log = readStampedLog(path.join(profileDir, 'terraform.log'));

  const out: string[] = ['## Terraform deploy profile', ''];

  if (phases.length) {
    const totalSeconds = phases.reduce((sum, p) => sum + p.seconds, 0);
    out.push('### Deploy phases', '', '| Phase | Duration | Share |', '| --- | ---: | ---: |');
    for (const phase of phases) {
      const share = totalSeconds ? `${((phase.seconds / totalSeconds) * 100).toFixed(0)}%` : '—';
      out.push(`| ${phase.name} | ${phase.seconds}s | ${share} |`);
    }
    out.push(`| **total** | **${totalSeconds}s** | |`, '');
  }

  if (log.length) {
    const refreshStart = first(log, (t) => t.includes('Refreshing state...'));
    const refreshEnd = last(log, (t) => t.includes('Refreshing state...'));
    const planLine = first(log, (t) => t.trimStart().startsWith('Plan:'));
    const mutations = log.filter((l) => MUTATION_START.test(l.text));
    const completions = log.filter((l) => MUTATION_END.test(l.text));
    const lastCompletion = completions[completions.length - 1];
    const applyComplete = first(log, (t) => t.includes('Apply complete!'));
    const refreshCount = log.filter((l) => l.text.includes('Refreshing state...')).length;

    out.push(
      '### Inside `terraform apply`',
      '',
      '| Sub-phase | Duration |',
      '| --- | ---: |',
      `| refresh (${refreshCount} resources) | ${secs(refreshStart, refreshEnd)} |`,
      `| plan (refresh end → plan printed) | ${secs(refreshEnd, planLine)} |`,
      `| apply (first mutation → last completion) | ${secs(mutations[0], lastCompletion)} |`,
      `| tail (last completion → apply complete) | ${secs(lastCompletion, applyComplete)} |`,
      ''
    );

    if (planLine) out.push(`\`${planLine.text.trim()}\``, '');
    if (applyComplete) out.push(`\`${applyComplete.text.trim()}\``, '');

    const zambdaMutations = mutations.filter((l) => l.text.includes('oystehr_zambda')).length;
    if (mutations.length) {
      out.push(`${zambdaMutations} of ${mutations.length} applied changes were \`oystehr_zambda\` resources.`, '');
    }

    // Per-resource apply durations, to see whether the tail is a few slow
    // resources or uniformly wide.
    const started = new Map<string, number>();
    for (const line of mutations) started.set(MUTATION_START.exec(line.text)![1], line.at);
    const durations: { address: string; seconds: number }[] = [];
    for (const line of completions) {
      const address = MUTATION_END.exec(line.text)![1];
      const start = started.get(address);
      if (start !== undefined) durations.push({ address, seconds: line.at - start });
    }
    durations.sort((a, b) => b.seconds - a.seconds);
    if (durations.length) {
      const sum = durations.reduce((acc, d) => acc + d.seconds, 0);
      const median = durations[Math.floor(durations.length / 2)].seconds;
      const slowest = durations[0].seconds;
      const summary =
        `Per-resource apply: n=${durations.length}, median ${median.toFixed(1)}s, ` +
        `max ${slowest.toFixed(1)}s, serial-equivalent ${sum.toFixed(0)}s.`;
      out.push(
        summary,
        '',
        '<details><summary>10 slowest resources</summary>',
        '',
        '| Resource | Duration |',
        '| --- | ---: |',
        ...durations.slice(0, 10).map((d) => `| \`${d.address}\` | ${d.seconds.toFixed(1)}s |`),
        '',
        '</details>',
        ''
      );
    }
  }

  const assetsFile = path.join(profileDir, 'assets-summary.txt');
  if (fs.existsSync(assetsFile)) {
    out.push('### Zambda assets', '', fs.readFileSync(assetsFile, 'utf-8').trim(), '');
  }

  const probesFile = path.join(profileDir, 'plan-probes.tsv');
  if (fs.existsSync(probesFile)) out.push(...renderPlanProbes(probesFile));

  const driftFile = path.join(profileDir, 'zambda-drift.md');
  if (fs.existsSync(driftFile)) out.push(fs.readFileSync(driftFile, 'utf-8'));

  const report = out.join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
};

main();
