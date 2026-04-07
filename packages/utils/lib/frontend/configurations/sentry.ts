import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from 'react-router-dom';

export function setupSentry(
  options: Partial<Sentry.BrowserOptions> & {
    dsn: Exclude<Sentry.BrowserOptions['dsn'], undefined>;
    environment: Exclude<Sentry.BrowserOptions['environment'], undefined>;
  } & { tags: { [key: string]: string } }
): void {
  Sentry.init({
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    tracesSampleRate: 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    ...options,
  });
  Sentry.setTags(options.tags);
}

export function parseCommaSeparatedTags(tags?: string): { [key: string]: string } {
  if (!tags) {
    return {};
  }
  return tags.split(',').reduce(
    (tags, tagPair) => {
      const tag = tagPair.split('=').filter(Boolean);
      if (tag.length == 2) {
        tags[tag[0].trim()] = tag[1].trim();
      }
      return tags;
    },
    {} as { [key: string]: string }
  );
}
