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
exports.index = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'send-receipt-by-email';
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, recipientFullName, email, receiptDocRefId, secrets, oystehr, documentReference, content, z3Url, presignedUrl, file, arrayBuffer, fileBuffer, attachment, templateData, emailClient, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 8, , 9]);
                console.log("Input: ".concat(JSON.stringify(input)));
                console.group('validateRequestParameters');
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), recipientFullName = _a.recipientFullName, email = _a.email, receiptDocRefId = _a.receiptDocRefId, secrets = _a.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                console.log('fetching document reference');
                return [4 /*yield*/, oystehr.fhir.get({
                        id: receiptDocRefId,
                        resourceType: 'DocumentReference',
                    })];
            case 2:
                documentReference = _b.sent();
                console.log('fetched document reference id ', documentReference.id);
                content = documentReference.content[0];
                z3Url = content.attachment.url;
                console.log("content: ".concat(JSON.stringify(content), ", url: ").concat(z3Url));
                if (!z3Url) return [3 /*break*/, 7];
                return [4 /*yield*/, (0, utils_1.getPresignedURL)(z3Url, m2mToken)];
            case 3:
                presignedUrl = _b.sent();
                return [4 /*yield*/, fetch(presignedUrl, {
                        method: 'GET',
                        headers: { 'Cache-Control': 'no-cache' },
                    })];
            case 4:
                file = _b.sent();
                if (file.status !== 200)
                    throw new Error('Failed to fetch file, status: ' + file.status);
                return [4 /*yield*/, file.arrayBuffer()];
            case 5:
                arrayBuffer = _b.sent();
                fileBuffer = Buffer.from(arrayBuffer);
                attachment = {
                    content: fileBuffer.toString('base64'),
                    filename: 'receipt.pdf',
                    type: file.headers.get('content-type') || utils_1.MIME_TYPES.PDF,
                    disposition: 'attachment',
                };
                templateData = {
                    'recipient-name': recipientFullName,
                    date: luxon_1.DateTime.now().toFormat('MM/dd/yyyy'),
                };
                emailClient = (0, shared_1.getEmailClient)(secrets);
                return [4 /*yield*/, emailClient.sendInPersonReceiptEmail(email, templateData, [attachment])];
            case 6:
                _b.sent();
                _b.label = 7;
            case 7: return [2 /*return*/, {
                    body: JSON.stringify('Email sent'),
                    statusCode: 200,
                }];
            case 8:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 9: return [2 /*return*/];
        }
    });
}); });
