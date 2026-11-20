#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';

const API = 'https://api.github.com';
const POLL_INTERVAL_MS = 20_000;
const MAX_CONSECUTIVE_POLL_FAILURES = 15;

const env = process.env;
const downstreamRepo = required('DOWNSTREAM_REPO');
const downstreamWorkflow = env.DOWNSTREAM_WORKFLOW;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function required(name) {
  const value = env[name];
  if (!value || value.endsWith('/')) {
    console.log(`::error::${name} is not configured`);
    process.exit(1);
  }
  return value;
}

function setOutput(key, value) {
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

function appJwt() {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 540, iss: required('APP_ID') })}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), required('APP_PRIVATE_KEY')).toString('base64url');
  return `${unsigned}.${signature}`;
}

let installationToken = '';
let installationTokenExpiresAt = 0;

async function token() {
  if (installationToken && Date.now() < installationTokenExpiresAt - 10 * 60_000) return installationToken;
  const jwt = appJwt();
  const installation = await request('GET', `/repos/${downstreamRepo}/installation`, { auth: jwt });
  const created = await request('POST', `/app/installations/${installation.id}/access_tokens`, {
    auth: jwt,
    body: { repositories: [downstreamRepo.split('/')[1]], permissions: { actions: 'write' } },
  });
  console.log(`::add-mask::${created.token}`);
  installationToken = created.token;
  installationTokenExpiresAt = Date.parse(created.expires_at);
  return installationToken;
}

async function request(method, path, { auth, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${auth ?? (await token())}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} failed with ${response.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function collectFlags() {
  const fromBody = (env.PR_BODY ?? '').match(/\/(?:skip|run)-[a-z0-9-]+/g) ?? [];
  const extra = (env.EXTRA_FLAGS ?? '').split(/\s+/).filter(Boolean);
  return [...new Set([...fromBody, ...extra])].join(' ');
}

async function dispatch() {
  required('DOWNSTREAM_WORKFLOW');
  const dispatchId = `${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;
  const inputs = {
    core_sha: env.GITHUB_SHA,
    core_head_ref: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME,
    core_base_ref: env.GITHUB_BASE_REF ?? '',
    event: env.GITHUB_EVENT_NAME,
    flags: collectFlags(),
    dispatch_id: dispatchId,
  };
  if (env.TARGET_ENVIRONMENT) inputs.environment = env.TARGET_ENVIRONMENT;

  await request('POST', `/repos/${downstreamRepo}/actions/workflows/${downstreamWorkflow}/dispatches`, {
    body: { ref: env.DOWNSTREAM_REF || 'develop', inputs },
  });
  console.log(`Dispatched ${inputs.core_sha} (${inputs.core_head_ref} -> ${inputs.core_base_ref || 'n/a'}) flags: ${inputs.flags || 'none'}`);

  for (let attempt = 1; attempt <= 36; attempt++) {
    const { workflow_runs: runs } = await request(
      'GET',
      `/repos/${downstreamRepo}/actions/workflows/${downstreamWorkflow}/runs?event=workflow_dispatch&per_page=50`
    );
    const run = runs.find((candidate) => candidate.display_title.includes(`[${dispatchId}]`));
    if (run) {
      console.log(`Downstream run: ${run.html_url}`);
      setOutput('run_id', run.id);
      setOutput('run_url', run.html_url);
      return;
    }
    console.log(`Run not visible yet (attempt ${attempt}/36)`);
    await sleep(5_000);
  }
  throw new Error('Could not find the dispatched downstream run');
}

async function findJob(runId, jobName) {
  const { jobs } = await request('GET', `/repos/${downstreamRepo}/actions/runs/${runId}/jobs?filter=latest&per_page=100`);
  return jobs.find((job) => job.name === jobName);
}

async function printFailedJobs(runId) {
  const { jobs } = await request('GET', `/repos/${downstreamRepo}/actions/runs/${runId}/jobs?filter=latest&per_page=100`);
  for (const job of jobs.filter((j) => !['success', 'skipped'].includes(j.conclusion))) {
    console.log(`  ${job.name}: ${job.conclusion ?? job.status}`);
  }
}

async function wait() {
  const runId = env.RUN_ID;
  if (!runId) throw new Error('No downstream run to wait for: the dispatch job failed');
  const jobName = env.JOB_NAME;
  const runUrl = `https://github.com/${downstreamRepo}/actions/runs/${runId}`;
  console.log(`Waiting for ${jobName ? `job "${jobName}" in ` : ''}${runUrl}`);

  if (env.CANCEL_ON_ABORT === 'true') {
    const cancel = async () => {
      try {
        await request('POST', `/repos/${downstreamRepo}/actions/runs/${runId}/cancel`);
        console.log('Cancelled the downstream run');
      } catch (error) {
        console.log(`Could not cancel the downstream run: ${error.message}`);
      }
      process.exit(1);
    };
    process.once('SIGINT', cancel);
    process.once('SIGTERM', cancel);
  }

  let failures = 0;
  let lastStatus = '';
  for (;;) {
    try {
      const run = await request('GET', `/repos/${downstreamRepo}/actions/runs/${runId}`);
      const job = jobName ? await findJob(runId, jobName) : undefined;
      failures = 0;

      if (job?.status === 'completed' && job.conclusion !== 'skipped') {
        console.log(`${jobName}: ${job.conclusion}`);
        console.log(`See ${job.html_url}`);
        return job.conclusion === 'success';
      }
      if (run.status === 'completed') {
        if (jobName) console.log(`${jobName}: ${job?.conclusion ?? 'did not run'}`);
        console.log(`Downstream run completed with conclusion: ${run.conclusion}`);
        if (run.conclusion !== 'success') await printFailedJobs(runId);
        console.log(`See ${runUrl}`);
        return run.conclusion === 'success';
      }

      const status = job ? `${jobName}: ${job.status}` : `run: ${run.status}`;
      if (status !== lastStatus) console.log(`${new Date().toISOString()} ${status}`);
      lastStatus = status;
    } catch (error) {
      failures += 1;
      console.log(`Poll failed (${failures}/${MAX_CONSECUTIVE_POLL_FAILURES}): ${error.message}`);
      if (failures >= MAX_CONSECUTIVE_POLL_FAILURES) throw error;
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

const command = process.argv[2];
try {
  if (command === 'dispatch') {
    await dispatch();
  } else if (command === 'wait') {
    if (!(await wait())) process.exitCode = 1;
  } else {
    console.log('Usage: downstream-ci.mjs dispatch|wait');
    process.exitCode = 2;
  }
} catch (error) {
  console.log(`::error::${error.message}`);
  process.exitCode = 1;
}
