import { describe, expect, it } from 'vitest';
import { emptyReport } from '../report/types';
import { DEFAULT_SETTINGS, migrateSettings, selectedEnvironment, useStudio } from './store';

const patientInput = { name: 'patientId', kind: 'id' as const, required: true };
const defaultCase = { name: 'Default', values: {} };

describe('a report with inputs always has a selected test case', () => {
  it('on open: a file declaring inputs but no test cases gets "Default", selected', () => {
    useStudio.getState().replaceReport({ ...emptyReport(), inputs: [patientInput], code: 'return ReportRoot;' });
    expect(useStudio.getState().report.testCases).toEqual([defaultCase]);
    expect(useStudio.getState().testCase).toBe('Default');
  });

  it('when the first input arrives (Claude\'s update_report or the user\'s Add input): "Default", selected', () => {
    useStudio.getState().replaceReport({ ...emptyReport(), code: 'return ReportRoot;' });
    expect(useStudio.getState().testCase).toBeUndefined();
    useStudio.getState().setReport({ inputs: [patientInput] });
    expect(useStudio.getState().report.testCases).toEqual([defaultCase]);
    expect(useStudio.getState().testCase).toBe('Default');
  });

  it('when the last test case is deleted: "Default" again, selected', () => {
    useStudio.getState().replaceReport({
      ...emptyReport(),
      inputs: [patientInput],
      testCases: [{ name: 'Teen', values: { patientId: 't' } }],
    });
    expect(useStudio.getState().testCase).toBe('Teen');
    useStudio.getState().setReport({ testCases: [] });
    expect(useStudio.getState().report.testCases).toEqual([defaultCase]);
    expect(useStudio.getState().testCase).toBe('Default');
  });

  it('keeps the selected case while it exists, and never adds one to a report without inputs', () => {
    useStudio.getState().replaceReport({
      ...emptyReport(),
      inputs: [patientInput],
      testCases: [
        { name: 'A', values: {} },
        { name: 'B', values: {} },
      ],
    });
    useStudio.getState().setTestCase('B');
    useStudio.getState().setReport({ title: 'x' });
    expect(useStudio.getState().testCase).toBe('B');
    useStudio.getState().replaceReport({ ...emptyReport(), code: 'return ReportRoot;' });
    expect(useStudio.getState().report.testCases).toBeUndefined();
  });
});

const synth = { name: 'synth', zambdaBaseUrl: 'http://localhost:3005/local', accessToken: 'a', production: false };
const prod = {
  name: 'nightwatch production',
  zambdaBaseUrl: 'http://localhost:3007/local',
  accessToken: '',
  production: true,
};

describe('migrateSettings', () => {
  it('drops the old top-level instance when an environment already has its address', () => {
    const settings = migrateSettings({
      zambdaBaseUrl: 'http://localhost:3005/local',
      accessToken: 'old',
      environments: [synth, prod],
    });
    expect(settings.environments.map((e) => e.name)).toEqual(['synth', 'nightwatch production']);
    expect(settings).not.toHaveProperty('zambdaBaseUrl');
    expect(settings).not.toHaveProperty('accessToken');
  });

  it('adds the old top-level instance as an environment named by its host, with its token', () => {
    const settings = migrateSettings({
      zambdaBaseUrl: 'http://localhost:3005/local',
      accessToken: 'tok',
      environments: [prod],
    });
    expect(settings.environments).toEqual([
      prod,
      { name: 'localhost:3005', zambdaBaseUrl: 'http://localhost:3005/local', accessToken: 'tok', production: false },
    ]);
  });

  it('keeps settings without the old fields as they are', () => {
    const settings = migrateSettings({
      environments: [synth],
      environmentName: 'synth',
      model: DEFAULT_SETTINGS.model,
    });
    expect(settings.environments).toEqual([synth]);
    expect(settings.environmentName).toBe('synth');
  });

  it('leaves an empty list empty when there was no old instance', () => {
    expect(migrateSettings({}).environments).toEqual([]);
  });
});

describe('selectedEnvironment', () => {
  it('is the remembered one, else the first, else none', () => {
    expect(selectedEnvironment({ ...DEFAULT_SETTINGS, environments: [synth, prod], environmentName: prod.name })).toBe(
      prod
    );
    expect(selectedEnvironment({ ...DEFAULT_SETTINGS, environments: [synth, prod] })).toBe(synth);
    expect(selectedEnvironment({ ...DEFAULT_SETTINGS, environments: [synth, prod], environmentName: 'gone' })).toBe(
      synth
    );
    expect(selectedEnvironment(DEFAULT_SETTINGS)).toBeUndefined();
  });
});
