import { execSync, spawn } from 'child_process';
import { DateTime } from 'luxon';
import path from 'path';

const isCI = Boolean(process.env.CI);
const ENV = process.env.ENV?.trim?.() || 'local';
const INTEGRATION_TEST = process.env.INTEGRATION_TEST || 'false';
const SMOKE_TEST = process.env.SMOKE_TEST || 'false';
const isUI = process.argv.includes('--ui');
const isLoginOnly = process.argv.includes('--login-only');
const isSpecsOnly = process.argv.includes('--specs-only');
const isEnvWithZambdaLocalServer = ENV === 'local' || ENV === 'e2e';
const isEnvWithFrontendLocalServer = ENV === 'local' || ENV === 'e2e' || isCI;
const testFileArg = process.argv.find((arg) => arg.startsWith('--test-file='));
const testFile = testFileArg ? testFileArg.split('=')[1] : undefined;
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
    e2e: 'e2e',
  },
  intake: {
    local: 'default',
    demo: 'demo',
    development: 'development',
    staging: 'staging',
    testing: 'testing',
    e2e: 'e2e',
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
    } catch {
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
  spawn('cross-env', [`ENV=${envMapping['ehr'][ENV]}`, 'npm', 'run', `zambdas:start:iac`], {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ENV: envMapping['ehr'][ENV] },
  });
};

const startApp = async (app: (typeof supportedApps)[number]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(
      'cross-env',
      [`ENV=${envMapping[app][ENV]}`, 'VITE_NO_OPEN=true', 'npm', 'run', `${app}:start:iac`, '--', '--verbosity=2'],
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
    } catch (error) {
      console.error(`Failed to run setup-test-deps.js for ${app}`);
      console.error(error?.message);
      console.error(error?.stack);
      clearPorts();
      process.exit(1);
    }
  }

  for (const app of supportedApps) {
    try {
      // Run the e2e-test-setup.sh script with skip-prompts and current environment
      console.log(`Running e2e-test-setup.sh for ${app} with environment ${ENV}...`);
      execSync(
        `bash ./scripts/e2e-test-setup.sh --skip-prompts --environment ${ENV} ${
          SMOKE_TEST === 'true' && '--mode smoke'
        }`,
        {
          stdio: 'inherit',
          env: { ...process.env, ENV },
        }
      );
    } catch (error) {
      console.error(`Failed to run e2e-test-setup.js for ${app}`);
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
  if (isEnvWithZambdaLocalServer) {
    startZambdas();
    console.log('Waiting for zambdas to be ready...');
    await waitForZambdas();
    console.log('Zambdas are ready');
  }

  for (const app of supportedApps) {
    console.log(`Starting ${app} application...`);
    await startApp(app);
  }
};

function createTestProcess(testType: 'login' | 'specs', appName: string): any {
  // If a specific test file is provided, run it directly with Playwright
  if (testFile && testType === 'specs') {
    const playwrightArgs = ['test', testFile];
    if (isUI) {
      playwrightArgs.push('--ui');
    } else {
      playwrightArgs.push('--headed=false');
    }

    console.log('SMOKE_TEST value:', SMOKE_TEST);

    if (SMOKE_TEST === 'true') {
      playwrightArgs.push('--grep', '@smoke');
    }

    return spawn('env-cmd', ['-f', `./env/tests.${ENV}.json`, 'npx', 'playwright', ...playwrightArgs], {
      shell: true,
      stdio: 'inherit',
      cwd: path.join(process.cwd(), `apps/${appName}`),
      env: {
        ...process.env,
        ENV,
        INTEGRATION_TEST,
        SMOKE_TEST,
      },
    });
  }

  const commands = {
    login: ['run', 'e2e:login', `--filter=${appName}-ui`, '--verbosity=2'],
    specs: ['run', isUI ? 'e2e:specs:ui' : 'e2e:specs', `--filter=${appName}-ui`, '--verbosity=2'],
  };

  const baseArgs = commands[testType];
  const extraArgs: string[] = [];

  // Only add --headed if we want headed mode (UI mode)
  // By default Playwright runs headless, so we don't need to pass anything for headless
  if (isUI) {
    extraArgs.push('--headed');
  }

  if (SMOKE_TEST === 'true' && testType !== 'login') {
    extraArgs.push('--grep', '@smoke');
  }

  // Build the playwright args as an environment variable for turbo to pass through
  const playwrightArgs = extraArgs.length > 0 ? extraArgs.join(' ') : '';

  return spawn('turbo', baseArgs, {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      ENV,
      PLAYWRIGHT_REPORT_SUFFIX: testType === 'login' ? '-login' : '',
      IS_LOGIN_TEST: testType === 'login' ? 'true' : 'false',
      ...(testType === 'specs' && { INTEGRATION_TEST }),
      SMOKE_TEST,
      PLAYWRIGHT_EXTRA_ARGS: playwrightArgs,
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
  // let additionalLoginProcess: any | undefined = undefined;

  loginTest.on('close', (loginCode) => {
    if (loginCode === 0) {
      // code to run intake login on EHR tests startup
      // if (appName === 'ehr') {
      //   additionalLoginProcess = createTestProcess('login', 'intake');
      // }
      // additionalLoginProcess?.on('close', (additionalLoginCode) => {
      //   if (additionalLoginCode === 0) {
      //     return;
      //   } else {
      //     clearPorts();
      //     process.exit(additionalLoginCode ?? 1);
      //   }
      // });
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

  if (isEnvWithFrontendLocalServer) {
    await startApps();
  }

  runTests();
}

main().catch((error) => {
  console.error(`run-e2e.ts script failed:\n${JSON.stringify(error, null, 2)}`);
  clearPorts();
  process.exit(1);
});
