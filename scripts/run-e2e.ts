import { execSync, spawn } from 'child_process';
import { DateTime } from 'luxon';
import path from 'path';

const ENV = process.env.ENV?.trim?.() || 'local';
const INTEGRATION_TEST = process.env.INTEGRATION_TEST || 'false';
const isUI = process.argv.includes('--ui');
const isLoginOnly = process.argv.includes('--login-only');
const isSpecsOnly = process.argv.includes('--specs-only');
const isLocal = ENV === 'local';
const isCI = Boolean(process.env.CI);
const supportedApps = ['ehr', 'intake'] as const;

const ports = {
  intake: 3002,
  ehr: 4002,
  backend: 3000,
} as const;

const envMapping = {
  ehr: {
    local: 'local',
    demo: 'demo',
    development: 'development',
    staging: 'staging',
    testing: 'testing',
  },
  intake: {
    local: 'default',
    demo: 'demo',
    development: 'development',
    staging: 'staging',
    testing: 'testing',
  },
} as const;

const appName = ((): 'ehr' | 'intake' => {
  const appArg = process.argv.find((arg) => arg.startsWith('--app='));
  if (!appArg) {
    throw new Error('App name is required');
  }
  const appName = appArg.split('=')[1] as 'ehr' | 'intake';
  if (!supportedApps.includes(appName)) {
    throw new Error(`App name should be one of the following: ${supportedApps.join(', ')}`);
  }
  return appName;
})();

const pwSuiteId = `${appName}-${DateTime.now().toMillis()}`;
process.env.PLAYWRIGHT_SUITE_ID = pwSuiteId;
console.log('PLAYWRIGHT_SUITE_ID in run-e2e.ts:', pwSuiteId);

const clearPorts = (): void => {
  if (isCI) {
    return;
  }
  for (const port of [ports.intake, ports.ehr, ports.backend]) {
    try {
      const output = execSync(`lsof -i :${port} | grep "^node" | awk '{print $2}'`).toString().trim();
      const processIds = [...new Set(output.split('\n'))];
      processIds.forEach((pid) => process.kill(parseInt(pid, 10), 'SIGTERM'));
    } catch (error) {
      console.log(`No node process found on port ${port}`);
    }
  }
};

const waitForApp = async (app: (typeof supportedApps)[number]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const process = spawn('wait-on', [`http://localhost:${ports[app]}`, '--timeout', '60000'], {
      shell: true,
      stdio: 'inherit',
    });

    process.on('error', reject);
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to start ${app}`));
      }
    });
  });
};

const startZambdas = (): void => {
  spawn('cross-env', [`ENV=${envMapping['ehr'][ENV]}`, 'npm', 'run', `zambdas:start`], {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ENV: envMapping['ehr'][ENV] },
  });
};

const startApp = async (app: (typeof supportedApps)[number]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(
      'cross-env',
      [`ENV=${envMapping[app][ENV]}`, 'VITE_NO_OPEN=true', 'npm', 'run', `${app}:start`, '--', '--verbosity=2'],
      {
        shell: true,
        stdio: 'inherit',
        env: { ...process.env, ENV: envMapping[app][ENV] },
      }
    );

    childProcess.on('error', (err) => {
      console.error(`App start error for ${app}:`, err);
      reject(err);
    });

    waitForApp(app)
      .then(() => {
        console.log(`${app} is ready`);
        resolve();
      })
      .catch(reject);
  });
};

const setupTestDeps = async (): Promise<void> => {
  for (const app of supportedApps) {
    try {
      execSync(`node --experimental-vm-modules setup-test-deps.js`, {
        stdio: 'inherit',
        env: { ...process.env },
        cwd: path.join(process.cwd(), `apps/${app}`),
      });

      // Run the e2e-test-setup.sh script with skip-prompts and current environment
      console.log(`Running e2e-test-setup.sh for ${app} with environment ${ENV}...`);
      execSync(`bash ./scripts/e2e-test-setup.sh --skip-prompts --environment ${ENV}`, {
        stdio: 'inherit',
        env: { ...process.env, ENV },
      });
    } catch (error) {
      console.error(`Failed to run setup-test-deps.js for ${app}`);
      console.error(error?.message);
      console.error(error?.stack);
      clearPorts();
      process.exit(1);
    }
  }
};

const waitForZambdas = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const process = spawn('wait-on', [`http://localhost:${ports.backend}`, '--timeout', '60000'], {
      shell: true,
      stdio: 'inherit',
    });

    process.on('error', reject);
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to start zambdas`));
      }
    });
  });
};

const startApps = async (): Promise<void> => {
  startZambdas();
  console.log('Waiting for zambdas to be ready...');
  await waitForZambdas();
  console.log('Zambdas are ready');
  for (const app of supportedApps) {
    console.log(`Starting ${app} application...`);
    await startApp(app);
  }
};

function createTestProcess(testType: 'login' | 'specs', appName: string): any {
  const commands = {
    login: ['run', 'e2e:login', `--filter=${appName}-ui`, '--verbosity=2'],
    specs: ['run', isUI ? 'e2e:specs:ui' : 'e2e:specs', `--filter=${appName}-ui`, '--verbosity=2'],
  };

  const baseArgs = commands[testType];
  const extraArgs = isUI ? [] : ['--', '--headed=false'];

  return spawn('turbo', [...baseArgs, ...extraArgs], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      ENV,
      PLAYWRIGHT_REPORT_SUFFIX: testType === 'login' ? '-login' : '',
      IS_LOGIN_TEST: testType === 'login' ? 'true' : 'false',
      ...(testType === 'specs' && { INTEGRATION_TEST }),
    },
  });
}

function runTests(): void {
  if (isLoginOnly) {
    console.log(`Running login only for ${appName}...`);
    const loginTest = createTestProcess('login', appName);
    loginTest.on('close', (code) => {
      clearPorts();
      process.exit(code ?? 1);
    });
    return;
  }

  if (isSpecsOnly) {
    console.log(`Running specs only for ${appName}...`);
    const specs = createTestProcess('specs', appName);
    specs.on('close', (code) => {
      clearPorts();
      process.exit(code ?? 1);
    });
    return;
  }

  console.log(`Running full test suite for ${appName}...`);
  const loginTest = createTestProcess('login', appName);

  loginTest.on('close', (loginCode) => {
    if (loginCode === 0) {
      const specs = createTestProcess('specs', appName);
      specs.on('close', (specsCode) => {
        clearPorts();
        process.exit(specsCode ?? 1);
      });
    } else {
      clearPorts();
      process.exit(loginCode ?? 1);
    }
  });
}

async function main(): Promise<void> {
  clearPorts();
  await setupTestDeps();

  if (isLocal || isCI) {
    await startApps();
  }

  runTests();
}

main().catch((error) => {
  console.error(`run-e2e.ts script failed:\n${JSON.stringify(error, null, 2)}`);
  clearPorts();
  process.exit(1);
});
