import { DEFAULT_TEST_TIMEOUT } from './common';
describe('exapmle test', () => {
  jest.setTimeout(DEFAULT_TEST_TIMEOUT);
  test('success test', async () => {
    expect(1).toEqual(1);
  });
});
