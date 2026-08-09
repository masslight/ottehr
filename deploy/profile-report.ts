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
    const applyComplete = first(log, (t) => t.includes('Apply complete!'));

    out.push(
      '### Inside `terraform apply`',
      '',
      '| Sub-phase | Duration |',
      '| --- | ---: |',
      `| refresh (${log.filter((l) => l.text.includes('Refreshing state...')).length} resources) | ${secs(refreshStart, refreshEnd)} |`,
      `| plan (refresh end → plan printed) | ${secs(refreshEnd, planLine)} |`,
      `| apply (first mutation → last completion) | ${secs(mutations[0], completions[completions.length - 1])} |`,
      `| tail (last completion → apply complete) | ${secs(completions[completions.length - 1], applyComplete)} |`,
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
      out.push(
        `Per-resource apply: n=${durations.length}, median ${median.toFixed(1)}s, max ${durations[0].seconds.toFixed(1)}s, ` +
          `serial-equivalent ${sum.toFixed(0)}s.`,
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

  const driftFile = path.join(profileDir, 'zambda-drift.md');
  if (fs.existsSync(driftFile)) out.push(fs.readFileSync(driftFile, 'utf-8'));

  const report = out.join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
};

main();
