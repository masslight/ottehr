"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expressLambda = void 0;
exports.replaceSecretValue = replaceSecretValue;
var fs_1 = require("fs");
var lodash_1 = require("lodash");
var path_1 = require("path");
var secrets_json_1 = require("../../../../config/oystehr/secrets.json");
var schema_20250925_1 = require("../../../spec/src/schema-20250925");
var expressLambda = function (handler, req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var lambdaInput, handlerResponse, body;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, buildLambdaInput(req)];
            case 1:
                lambdaInput = _a.sent();
                return [4 /*yield*/, handler(lambdaInput, {}, // Zambdas don't use it
                    undefined // Zambdas don't use it
                    )];
            case 2:
                handlerResponse = _a.sent();
                if (handlerResponse != null) {
                    lodash_1.default.forOwn(handlerResponse.headers, function (value, key) {
                        res.setHeader(key, value);
                    });
                    res.status(handlerResponse.statusCode);
                    body = void 0;
                    try {
                        body = JSON.parse(handlerResponse.body);
                    }
                    catch (_b) {
                        body = handlerResponse.body;
                    }
                    res.send({
                        status: handlerResponse.statusCode,
                        output: body,
                    });
                }
                else {
                    throw 'Unexpectedly have no response from handler';
                }
                return [2 /*return*/];
        }
    });
}); };
exports.expressLambda = expressLambda;
function replaceSecretValue(secret, schema, useIac) {
    return __awaiter(this, void 0, void 0, function () {
        var $, result, refMatches, legacyValue, _i, refMatches_1, match, fullMatch, resourceType, resourceName, fieldName, tfRef, tfOutputName, opts, tfConsoleRead, tfValue;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('execa'); })];
                case 1:
                    $ = (_a.sent()).$;
                    result = schema.replaceVariableWithValue(secret.value);
                    refMatches = __spreadArray([], result.matchAll(schema_20250925_1.REF_REGEX), true);
                    if (!refMatches.length) return [3 /*break*/, 6];
                    console.log("Found ".concat(refMatches.length, " terraform references in secret ").concat(secret.name));
                    if (!('legacyValue' in secret && secret.legacyValue != null)) return [3 /*break*/, 2];
                    legacyValue = secret.legacyValue;
                    console.log("Using legacy value for secret ".concat(secret.name, ": ").concat(legacyValue));
                    result = schema.replaceVariableWithValue(legacyValue);
                    return [3 /*break*/, 6];
                case 2:
                    console.log("Warning: no legacy value found for secret ".concat(secret.name));
                    if (useIac !== 'true') {
                        console.log("Skipping terraform resolution for secret ".concat(secret.name, " because iac flag not set"));
                        return [2 /*return*/, result];
                    }
                    _i = 0, refMatches_1 = refMatches;
                    _a.label = 3;
                case 3:
                    if (!(_i < refMatches_1.length)) return [3 /*break*/, 6];
                    match = refMatches_1[_i];
                    fullMatch = match[0], resourceType = match[1], resourceName = match[2], fieldName = match[3];
                    tfRef = schema.getTerraformResourceReference(secrets_json_1.default, resourceType, resourceName, fieldName);
                    if (!tfRef) return [3 /*break*/, 5];
                    console.log("Resolving terraform reference for ".concat(fullMatch, ": ").concat(tfRef));
                    tfOutputName = schema.getTerraformResourceOutputName(fullMatch, 'oystehr');
                    opts = {
                        cwd: (0, path_1.resolve)(__dirname, '../../../../deploy'),
                        input: "nonsensitive(".concat(tfOutputName, ")"),
                    };
                    return [4 /*yield*/, $(opts)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["terraform console"], ["terraform console"])))];
                case 4:
                    tfConsoleRead = _a.sent();
                    console.log("Terraform console read for ".concat(fullMatch, ": ").concat(tfConsoleRead.stdout));
                    tfValue = tfConsoleRead.stdout;
                    // console value will either be the actual value or 'tostring(null)'
                    if (tfValue && typeof tfValue === 'string' && tfValue !== 'tostring(null)') {
                        result = result.replace(fullMatch, tfValue.slice(1, -1));
                    }
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: return [2 /*return*/, result];
            }
        });
    });
}
var secrets = {};
function populateSecrets(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var configString, envFileContents, schema, takenFromSpec, sgSecretKeys;
        var _this = this;
        var pathToEnvFile = _b.pathToEnvFile, useIac = _b.useIac;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('Populating secrets');
                    console.log('pathToEnvFile', pathToEnvFile);
                    console.log('useIac', useIac);
                    configString = (0, fs_1.readFileSync)((0, path_1.resolve)(__dirname, "../../".concat(pathToEnvFile)), {
                        encoding: 'utf8',
                    });
                    envFileContents = configString.length > 2 ? JSON.parse(configString) : null;
                    schema = new schema_20250925_1.Schema20250925([{ path: '../../../../config/oystehr/secrets.json', spec: secrets_json_1.default }], envFileContents, '', '');
                    takenFromSpec = new Set();
                    return [4 /*yield*/, Promise.all(Object.entries(secrets_json_1.default.secrets).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var _c, _d;
                            var _key = _b[0], secret = _b[1];
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        _c = secrets;
                                        _d = secret.name;
                                        return [4 /*yield*/, replaceSecretValue(secret, schema, useIac)];
                                    case 1:
                                        _c[_d] = _e.sent();
                                        takenFromSpec.add(secret.name);
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 1:
                    _c.sent();
                    sgSecretKeys = new Set([
                        'SENDGRID_ERROR_REPORT_TEMPLATE_ID',
                        'SENDGRID_IN_PERSON_CANCELATION_TEMPLATE_ID',
                        'SENDGRID_IN_PERSON_CONFIRMATION_TEMPLATE_ID',
                        'SENDGRID_IN_PERSON_COMPLETION_TEMPLATE_ID',
                        'SENDGRID_IN_PERSON_REMINDER_TEMPLATE_ID',
                        'SENDGRID_IN_PERSON_RECEIPT_TEMPLATE_ID',
                        'SENDGRID_TELEMED_CANCELATION_TEMPLATE_ID',
                        'SENDGRID_TELEMED_CONFIRMATION_TEMPLATE_ID',
                        'SENDGRID_TELEMED_COMPLETION_TEMPLATE_ID',
                        'SENDGRID_TELEMED_INVITATION_TEMPLATE_ID',
                        'SENDGRID_SEND_EMAIL_API_KEY',
                    ]);
                    Object.entries(envFileContents).forEach(function (_a) {
                        var key = _a[0], value = _a[1];
                        if (!takenFromSpec.has(key) && sgSecretKeys.has(key) && typeof value === 'string') {
                            secrets[key] = value;
                        }
                    });
                    console.log('Populated secrets' /*, JSON.stringify(secrets)*/);
                    return [2 /*return*/];
            }
        });
    });
}
var singleValueHeaders = function (input) {
    var headers = lodash_1.default.flow([
        Object.entries,
        function (arr) { return arr.filter(function (_a) {
            var value = _a[1];
            return !Array.isArray(value);
        }); },
        Object.fromEntries,
    ])(input);
    return headers;
};
function parseArgs(args) {
    return args.reduce(function (acc, arg) {
        var _a = arg.split('='), key = _a[0], value = _a[1];
        acc[key] = value;
        return acc;
    }, {});
}
var cliParams = parseArgs(process.argv.slice(2));
var pathToEnvFile = cliParams['env'];
var useIac = cliParams['iac'];
if (!pathToEnvFile && process.env.ENV) {
    pathToEnvFile = ".env/".concat(process.env.ENV, ".json");
}
var populateSecretsPromise;
if (pathToEnvFile) {
    console.log('Found env file at', pathToEnvFile);
    populateSecretsPromise = populateSecrets({ pathToEnvFile: pathToEnvFile, useIac: useIac });
}
function buildLambdaInput(req) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('build lambda body,', JSON.stringify(req.body));
                    return [4 /*yield*/, populateSecretsPromise];
                case 1:
                    _a.sent();
                    return [2 /*return*/, {
                            body: !lodash_1.default.isEmpty(req.body) ? req.body : null,
                            headers: singleValueHeaders(req.headers),
                            secrets: secrets,
                        }];
            }
        });
    });
}
var templateObject_1;
