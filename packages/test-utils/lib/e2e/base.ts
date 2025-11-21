// https://github.com/mxschmitt/playwright-test-coverage/tree/main
import { BrowserContext, test as baseTest } from '@playwright/test';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
const istanbulCLIOutput = path.join(process.cwd(), '.nyc_output');
export function generateUUID(): string {
  return crypto.randomBytes(16).toString('hex');
}
export const test = baseTest.extend<{ context: BrowserContext }>({
  context: async ({ context }: { context: BrowserContext }, use: (context: BrowserContext) => Promise<void>) => {
    await context.addInitScript(() =>
      window.addEventListener('beforeunload', () =>
        (window as any).collectIstanbulCoverage(JSON.stringify((window as any).__coverage__))
      )
    );
    await fs.promises.mkdir(istanbulCLIOutput, { recursive: true });
    await context.exposeFunction('collectIstanbulCoverage', (coverageJSON: string) => {
      if (coverageJSON)
        fs.writeFileSync(path.join(istanbulCLIOutput, `playwright_coverage_${generateUUID()}.json`), coverageJSON);
    });
    await use(context);
    for (const page of context.pages()) {
      await page.evaluate(() => (window as any).collectIstanbulCoverage(JSON.stringify((window as any).__coverage__)));
    }
  },
});
export const expect = test.expect;
