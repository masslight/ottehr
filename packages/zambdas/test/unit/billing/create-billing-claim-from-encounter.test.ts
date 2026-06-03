import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { validateRequestParameters } from '../../../src/billing/create-billing-claim-from-encounter/handler';

describe('create-billing-claim-from-encounter', () => {
  describe('validation', () => {
    it('throws validation error on empty body', async () => {
      expect(() => validateRequestParameters({ headers: null, body: null, secrets: null })).toThrow(
        expect.objectContaining(MISSING_REQUEST_BODY)
      );
    });
    it('throws validation error on empty secrets', async () => {
      expect(() => validateRequestParameters({ headers: null, body: '{}', secrets: null })).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });
    it('throws validation error on non-json body', async () => {
      expect(() => validateRequestParameters({ headers: null, body: 'some text', secrets: {} })).toThrow(
        expect.objectContaining(INVALID_INPUT_ERROR('Request body is not valid JSON'))
      );
    });
    it('throws validation error on missing encounter id', async () => {
      expect(() => validateRequestParameters({ headers: null, body: '{}', secrets: {} })).toThrow(
        expect.objectContaining(INVALID_INPUT_ERROR('encounterId: Required'))
      );
    });
    it('succeeds', async () => {
      const input = validateRequestParameters({
        headers: null,
        body: '{"encounterId":"77e32d5e-bb84-4604-beb8-d755869f9715"}',
        secrets: {},
      });
      expect(input).toStrictEqual({ encounterId: '77e32d5e-bb84-4604-beb8-d755869f9715', secrets: {} });
    });
  });
});
