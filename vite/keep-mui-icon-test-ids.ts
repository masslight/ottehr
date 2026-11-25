import type { Plugin } from 'vite';

// The expression MUI v7's `createSvgIcon` uses to drop an icon's `data-testid` from production builds.
const PRODUCTION_ONLY_TEST_ID = "process.env.NODE_ENV !== 'production' ? `${displayName}Icon` : undefined";
const CREATE_SVG_ICON_MODULE = /@mui[\\/]material[\\/](esm[\\/])?utils[\\/]createSvgIcon\.js$/;

/**
 * Keeps the `data-testid` that every `@mui/icons-material` icon carries (`CloseIcon`,
 * `EditOutlinedIcon`, ...) in production builds.
 *
 * MUI set it in every build through v6 and only in development builds from v7 on. The e2e suites
 * run against deployed production builds and find many controls by these ids, so they are kept
 * until those tests use test ids of their own.
 */
export function keepMuiIconTestIds(): Plugin {
  return {
    name: 'keep-mui-icon-test-ids',
    enforce: 'pre',
    transform(code, id) {
      if (!CREATE_SVG_ICON_MODULE.test(id.split('?')[0])) return null;
      if (!code.includes(PRODUCTION_ONLY_TEST_ID)) {
        this.error(`${id} no longer sets the icon data-testid the way keep-mui-icon-test-ids expects.`);
      }
      return { code: code.replace(PRODUCTION_ONLY_TEST_ID, '`${displayName}Icon`'), map: null };
    },
  };
}
