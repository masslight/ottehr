import { spawn, execSync } from 'child_process';
import path from 'path';

const ENV = process.env.ENV?.trim?.() || 'local';
const isUI = process.argv.includes('--ui');
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

const clearPorts = (): void => {
  if (isCI) {
    return;
  }
  for (const port of [ports.intake, ports.ehr, ports.backend]) {
    try {
      const output = execSync(`lsof -i :${port} | grep "^node" | awk '{print $2}'`).toString().trim();
      const pids = [...new Set(output.split('\n'))];
      pids.forEach((pid) => process.kill(parseInt(pid, 10), 'SIGTERM'));
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
      [
        'VITE_APP_CI_PHOTON_DISABLED=true',
        `ENV=${envMapping[app][ENV]}`,
        'VITE_NO_OPEN=true',
        'npm',
        'run',
        `${app}:start`,
        '--',
        '--verbosity=2',
      ],
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
        env: { ...process.env, ENV: ENV },
        cwd: path.join(process.cwd(), `apps/${app}`),
      });

      // Run the e2e-test-setup.sh script with skip-prompts and current environment
      console.log(`Running e2e-test-setup.sh for ${app} with environment ${ENV}...`);
      execSync(`bash ./scripts/e2e-test-setup.sh --skip-prompts --environment ${ENV}`, {
        stdio: 'inherit',
        env: { ...process.env, ENV: ENV },
      });
    } catch (error) {
      console.error(`Failed to run setup-test-deps.js for ${app}:`, error);
      clearPorts();
      process.exit(1);
    }
  }
};

const startApps = async (): Promise<void> => {
  startZambdas();
  for (const app of supportedApps) {
    console.log(`Starting ${app} application...`);
    await startApp(app);
  }
};

function runTests(): void {
  const loginTest = spawn(
    'turbo',
    [
      'run',
      'e2e:login',
      `--filter=${appName}-ui`,
      '--verbosity=2',
      ...(isUI ? [] : ['--', '--headed=false', '--reporter=null']),
    ],
    {
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, ENV },
    }
  );

  loginTest.on('close', (loginCode) => {
    if (loginCode === 0) {
      const specs = spawn(
        'turbo',
        [
          'run',
          isUI ? 'e2e:specs:ui' : 'e2e:specs',
          `--filter=${appName}-ui`,
          '--verbosity=2',
          ...(isUI ? [] : ['--', '--headed=false']),
        ],
        {
          shell: true,
          stdio: 'inherit',
          env: { ...process.env, ENV: ENV },
        }
      );

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
  console.error('Script failed:', error);
  clearPorts();
  process.exit(1);
});
