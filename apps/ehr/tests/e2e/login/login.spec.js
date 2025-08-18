"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var test_1 = require("@playwright/test");
var check_env_1 = require("../../e2e-utils/check-env");
(0, test_1.test)('Should log in', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var authorizeHeader, _c, zapehrButton, _d;
    var page = _b.page, context = _b.context, browser = _b.browser;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                (0, check_env_1.checkIfEnvAllowed)();
                return [4 /*yield*/, browser.newContext({
                        storageState: undefined,
                    })];
            case 1:
                context = _e.sent();
                return [4 /*yield*/, context.newPage()];
            case 2:
                page = _e.sent();
                return [4 /*yield*/, context.clearCookies()];
            case 3:
                _e.sent();
                return [4 /*yield*/, context.clearPermissions()];
            case 4:
                _e.sent();
                return [4 /*yield*/, page.goto('/')];
            case 5:
                _e.sent();
                return [4 /*yield*/, page.fill('#username', process.env.TEXT_USERNAME)];
            case 6:
                _e.sent();
                return [4 /*yield*/, page.click('button[type="submit"]')];
            case 7:
                _e.sent();
                return [4 /*yield*/, page.waitForTimeout(100)];
            case 8:
                _e.sent();
                return [4 /*yield*/, page.fill('#password', process.env.TEXT_PASSWORD)];
            case 9:
                _e.sent();
                return [4 /*yield*/, page.click('button[type="submit"]')];
            case 10:
                _e.sent();
                _e.label = 11;
            case 11:
                _e.trys.push([11, 15, , 16]);
                return [4 /*yield*/, page.waitForSelector('text=Authorize App', { timeout: 3000 })];
            case 12:
                authorizeHeader = _e.sent();
                if (!authorizeHeader) return [3 /*break*/, 14];
                return [4 /*yield*/, page.click('button:has-text("Accept")')];
            case 13:
                _e.sent();
                _e.label = 14;
            case 14: return [3 /*break*/, 16];
            case 15:
                _c = _e.sent();
                console.log('No authorization page detected, continuing with test');
                return [3 /*break*/, 16];
            case 16: return [4 /*yield*/, page.waitForURL('/visits')];
            case 17:
                _e.sent();
                // save login context
                return [4 /*yield*/, context.storageState({ path: './playwright/user.json' })];
            case 18:
                // save login context
                _e.sent();
                _e.label = 19;
            case 19:
                _e.trys.push([19, 22, , 23]);
                zapehrButton = page.getByText(/continue with zapehr/i);
                return [4 /*yield*/, zapehrButton.waitFor({ timeout: 5000 })];
            case 20:
                _e.sent();
                return [4 /*yield*/, zapehrButton.click()];
            case 21:
                _e.sent();
                console.log('Auth modal detected, logged in through ZapEHR');
                return [3 /*break*/, 23];
            case 22:
                _d = _e.sent();
                console.log('Auth modal not detected, continuing');
                return [3 /*break*/, 23];
            case 23: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId('PersonIcon')).toBeVisible({ timeout: 30000 })];
            case 24:
                _e.sent();
                return [2 /*return*/];
        }
    });
}); });
//# sourceMappingURL=login.spec.js.map