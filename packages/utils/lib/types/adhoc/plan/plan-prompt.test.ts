import { describe, expect, it } from 'vitest';
import { REPORT_FACTORY_NAME, REPORT_ROOT_NAME } from '../generation/runtime-scope.catalog';
import { ADHOC_DATA_MAP_RESOURCE_TYPES, renderDataMapPrompt } from './data-map';
import { renderFetchPlanFormatPrompt, renderPlanReportCodeContractPrompt } from './plan-prompt';

// What a browser test of the planner showed the prompt must say (OTR-3736): the model copied the whole
// `function buildReport(…) { … }` it was shown instead of writing its body, read "keepType" as the type it wanted
// fetched (an Encounter step over Appointments fed no ids), and guessed how eligibility checks are stored.

describe('the plan report code contract', () => {
  it('tells the model the code is the BODY of the function, never the declaration', () => {
    const contract = renderPlanReportCodeContractPrompt();
    expect(contract).toContain(`do NOT write \`function ${REPORT_FACTORY_NAME}(`);
    expect(contract).toContain(`return ${REPORT_ROOT_NAME};`);
  });
});

describe('the fetch plan format', () => {
  it('says keepType names a type the SOURCE step holds, not the type the step fetches', () => {
    const format = renderFetchPlanFormatPrompt();
    expect(format).toMatch(/keepType[^.]*SOURCE step/);
    expect(format).toContain('never the type this step fetches');
  });
});

describe('the data map', () => {
  it('describes insurance eligibility checks and what a failed one is', () => {
    expect(ADHOC_DATA_MAP_RESOURCE_TYPES).toContain('CoverageEligibilityResponse');
    const prompt = renderDataMapPrompt();
    expect(prompt).toContain('## CoverageEligibilityResponse');
    expect(prompt).toMatch(/error\[\][^\n]*FAILED/);
    expect(prompt).toContain('Active Coverage');
  });

  it('shows the encounters-by-appointment scoped step with the source type as keepType', () => {
    expect(renderDataMapPrompt()).toContain(
      '{ step: "visits", path: "id", param: "appointment", keepType: "Appointment" }'
    );
  });
});
