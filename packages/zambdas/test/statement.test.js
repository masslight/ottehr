"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var draw_1 = require("../src/subscriptions/task/sub-generate-statement/draw");
describe('Statement generation tests', function () {
    test('formatMoney tests', function () {
        expect((0, draw_1.formatMoney)(0)).toBe('$0.00');
        expect((0, draw_1.formatMoney)(1)).toBe('$0.01');
        expect((0, draw_1.formatMoney)(10)).toBe('$0.10');
        expect((0, draw_1.formatMoney)(11)).toBe('$0.11');
        expect((0, draw_1.formatMoney)(123)).toBe('$1.23');
        expect((0, draw_1.formatMoney)(1234)).toBe('$12.34');
        expect((0, draw_1.formatMoney)(9450)).toBe('$94.50');
        expect((0, draw_1.formatMoney)(10199)).toBe('$101.99');
    });
});
