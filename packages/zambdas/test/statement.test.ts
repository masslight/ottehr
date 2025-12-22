import { formatMoney } from '../src/subscriptions/task/sub-generate-statement/draw';

describe('Statement generation tests', () => {
  test('formatMoney tests', () => {
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(1)).toBe('$0.01');
    expect(formatMoney(10)).toBe('$0.10');
    expect(formatMoney(11)).toBe('$0.11');
    expect(formatMoney(123)).toBe('$1.23');
    expect(formatMoney(1234)).toBe('$12.34');
    expect(formatMoney(9450)).toBe('$94.50');
    expect(formatMoney(10199)).toBe('$101.99');
  });
});
