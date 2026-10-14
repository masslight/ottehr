import { describe, expect, it } from 'vitest';
import { ServiceMode } from '../types/common';
import { buildWalkinModeLinks } from './scheduleUtils';

describe('buildWalkinModeLinks', () => {
  it('returns both mode-pinned links for a dual-mode Location', () => {
    const links = buildWalkinModeLinks({ scheduleId: 'sched-1', isVirtual: true, isInPerson: true });
    expect(links.map((l) => l.mode)).toEqual([ServiceMode['in-person'], ServiceMode.virtual]);
    expect(links.map((l) => l.label)).toEqual(['Walk-in (In person)', 'Walk-in (Virtual)']);
    expect(links.map((l) => l.relativeUrl)).toEqual([
      '/walkin/schedule/sched-1?serviceMode=in-person',
      '/walkin/schedule/sched-1?serviceMode=virtual',
    ]);
  });

  it('returns a single mode-pinned link for a single-mode Location', () => {
    expect(buildWalkinModeLinks({ scheduleId: 'sched-1', isVirtual: true, isInPerson: false })).toEqual([
      {
        mode: ServiceMode.virtual,
        key: 'walkin-sched-1-virtual',
        label: 'Walk-in',
        relativeUrl: '/walkin/schedule/sched-1?serviceMode=virtual',
      },
    ]);
    expect(
      buildWalkinModeLinks({ scheduleId: 'sched-1', isVirtual: false, isInPerson: true }).map((l) => l.relativeUrl)
    ).toEqual(['/walkin/schedule/sched-1?serviceMode=in-person']);
  });

  it('falls back to in-person when neither mode flag is set', () => {
    expect(buildWalkinModeLinks({ scheduleId: 'sched-1' }).map((l) => l.mode)).toEqual([ServiceMode['in-person']]);
  });

  it('returns no links without a schedule id', () => {
    expect(buildWalkinModeLinks({ isVirtual: true, isInPerson: true })).toEqual([]);
  });
});
