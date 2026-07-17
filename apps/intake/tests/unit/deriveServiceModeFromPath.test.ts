import { describe, expect, it } from 'vitest';
import { deriveServiceModeFromPath } from '../../src/pages/selectServiceCategoryMode';

// SelectServiceCategoryPage is rendered by four route shapes. The mode it
// passes to the category filter must match the route the patient took to
// get here — otherwise the picker either shows mode-incompatible options
// (the bug this helper was added to fix: virtual-only categories appearing
// on the /prebook/virtual picker) or silently hides legitimate ones.
describe('deriveServiceModeFromPath', () => {
  describe('prebook routes — mode is explicit in the URL', () => {
    it('returns "virtual" for /prebook/virtual/select-service-category', () => {
      expect(deriveServiceModeFromPath('/prebook/virtual/select-service-category')).toBe('virtual');
    });

    it('returns "in-person" for /prebook/in-person/select-service-category', () => {
      expect(deriveServiceModeFromPath('/prebook/in-person/select-service-category')).toBe('in-person');
    });

    it('passes through whatever segment the URL declares (does not whitelist)', () => {
      // The router only mounts this page under the two real modes, but the
      // helper doesn't validate — keeps it pure and dependency-free. An
      // unexpected segment would just produce an empty filter result
      // downstream, which is preferable to throwing here.
      expect(deriveServiceModeFromPath('/prebook/some-future-mode/select-service-category')).toBe('some-future-mode');
    });

    it('matches even with trailing query string', () => {
      expect(deriveServiceModeFromPath('/prebook/virtual/select-service-category?bookingOn=foo')).toBe('virtual');
    });
  });

  describe('start-virtual route — implicitly virtual', () => {
    it('returns "virtual" for /start-virtual/select-service-category', () => {
      expect(deriveServiceModeFromPath('/start-virtual/select-service-category')).toBe('virtual');
    });

    it('also matches a query-stringed version', () => {
      expect(deriveServiceModeFromPath('/start-virtual/select-service-category?scheduleType=group')).toBe('virtual');
    });
  });

  describe('walkin routes — Location is in-person by convention', () => {
    it('returns "in-person" for /walkin/location/:name/select-service-category', () => {
      expect(deriveServiceModeFromPath('/walkin/location/Asheville/select-service-category')).toBe('in-person');
    });

    it('handles location names with underscores (URL-encoded spaces)', () => {
      expect(deriveServiceModeFromPath('/walkin/location/Asheville_North/select-service-category')).toBe('in-person');
    });

    it('returns undefined for /walkin/schedule/:id — Schedule owner type resolves downstream', () => {
      // The Schedule's actor could be a Location (in-person) or a virtual
      // resource; the patient-side picker can't tell from the URL alone.
      // We pass undefined so the helper skips the mode filter; the
      // booking flow rejects later if the patient picks a mode-incompatible
      // category. (For practical purposes walk-in flows are in-person,
      // but the data model permits otherwise and we keep that flexibility.)
      expect(deriveServiceModeFromPath('/walkin/schedule/abc-123/select-service-category')).toBeUndefined();
    });
  });

  describe('unknown / unsupported paths', () => {
    it('returns undefined for a root path', () => {
      expect(deriveServiceModeFromPath('/')).toBeUndefined();
    });

    it('returns undefined for an unrelated app route', () => {
      expect(deriveServiceModeFromPath('/visits')).toBeUndefined();
    });

    it('returns undefined for /prebook/ without a mode segment', () => {
      expect(deriveServiceModeFromPath('/prebook/select-service-category')).toBeUndefined();
    });

    it('returns undefined when the picker suffix is missing on a prebook URL', () => {
      // Defense against accidental partial matches — only the full
      // `/prebook/{mode}/select-service-category` shape should resolve.
      expect(deriveServiceModeFromPath('/prebook/virtual')).toBeUndefined();
    });

    it('returns undefined when the picker suffix has extra characters appended', () => {
      // Tightens the regex's right edge — the router never serves
      // `/prebook/virtual/select-service-category-extra`, but the helper's
      // contract reads "this exact route shape," so make it true.
      expect(deriveServiceModeFromPath('/prebook/virtual/select-service-category-extra')).toBeUndefined();
      expect(deriveServiceModeFromPath('/prebook/virtual/select-service-category-foo/bar')).toBeUndefined();
    });
  });
});
