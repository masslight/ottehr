import { spawn, execSync } from 'child_process';
import path from 'path';

const ENV = process.env.ENV?.trim?.() || 'local';
const isUI = process.argv.includes('--ui');
const isLocal = ENV === 'local';
const isCI = Boolean(process.env.CI);
const supportedApps = ['ehr', 'intake'] as const;

const ports = {
  ehr: {
    frontend: 4002,
    backend: 4001,
  },
  intake: {
    frontend: 3002,
    backend: 3001,
  },
} as const;

const envMapping = {
  ehr: {
    local: 'local',
    demo: 'demo',
  },
  intake: {
    local: 'default',
    demo: 'demo',
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
  for (const port of [ports.ehr.frontend, ports.ehr.backend, ports.intake.frontend, ports.intake.backend]) {
    try {
      const pid = execSync(`lsof -ti :${port}`).toString().trim();
      if (pid) {
        process.kill(parseInt(pid, 10), 'SIGTERM');
      }
    } catch (error) {
      console.log(`No process found on port ${port}`);
    }
  }
};

const waitForApp = async (app: (typeof supportedApps)[number]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const process = spawn('wait-on', [`http://localhost:${ports[app].frontend}`, '--timeout', '60000'], {
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
    } catch (error) {
      console.error(`Failed to run setup-test-deps.js for ${app}:`, error);
      clearPorts();
      process.exit(1);
    }
  }
};

const startApps = async (): Promise<void> => {
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
        process.exit(specsCode);
      });
    } else {
      clearPorts();
      process.exit(loginCode);
    }
  });
}

async function main(): Promise<void> {
  clearPorts();
  await setupTestDeps();

  if (isLocal || isCI) {
    await startApps();
    runTests();
  } else {
    runTests();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  clearPorts();
  process.exit(1);
});
