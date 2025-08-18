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
exports.getAuth0Token = getAuth0Token;
function getAuth0Token() {
    return __awaiter(this, void 0, void 0, function () {
        var AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, response, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    AUTH0_ENDPOINT = process.env.AUTH0_ENDPOINT;
                    if (!AUTH0_ENDPOINT || !process.env.AUTH0_CLIENT || !process.env.AUTH0_SECRET) {
                        throw new Error('❌ Missing auth0 credentials');
                    }
                    if (process.env.AUTH0_CLIENT_TESTS && process.env.AUTH0_SECRET_TESTS) {
                        AUTH0_CLIENT = process.env.AUTH0_CLIENT_TESTS;
                        AUTH0_SECRET = process.env.AUTH0_SECRET_TESTS;
                    }
                    else {
                        AUTH0_CLIENT = process.env.AUTH0_CLIENT;
                        AUTH0_SECRET = process.env.AUTH0_SECRET;
                    }
                    AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;
                    if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
                        throw new Error('❌ Missing auth0 credentials');
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    console.log("Fetching auth0 token...");
                    return [4 /*yield*/, fetch(AUTH0_ENDPOINT, {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({
                                grant_type: 'client_credentials',
                                client_id: AUTH0_CLIENT,
                                client_secret: AUTH0_SECRET,
                                audience: AUTH0_AUDIENCE,
                            }),
                        })];
                case 2:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("HTTP error! status: ".concat(response.status));
                    }
                    console.log('Got auth0 token');
                    return [4 /*yield*/, response.json()];
                case 3: return [2 /*return*/, (_a.sent()).access_token];
                case 4:
                    error_1 = _a.sent();
                    console.error('❌ Failed to get auth0 token', error_1);
                    throw new Error(error_1.message);
                case 5: return [2 /*return*/];
            }
        });
    });
}
//# sourceMappingURL=getAuth0Token.js.map