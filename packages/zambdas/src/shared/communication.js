"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
exports.makeAddressUrl = exports.makeVisitLandingUrl = exports.makeModifyVisitUrl = exports.makeBookAgainUrl = exports.makeJoinVisitUrl = exports.makePaperworkUrl = exports.makeCancelVisitUrl = exports.getEmailClient = void 0;
exports.getMessageRecipientForAppointment = getMessageRecipientForAppointment;
exports.sendSms = sendSms;
exports.sendSmsForPatient = sendSmsForPatient;
var mail_1 = require("@sendgrid/mail");
var utils_1 = require("utils");
var errors_1 = require("./errors");
var patients_1 = require("./patients");
function getMessageRecipientForAppointment(appointment, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var patientId, relatedPerson;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    patientId = (_c = (_b = (_a = appointment === null || appointment === void 0 ? void 0 : appointment.participant.find(function (participantTemp) { var _a, _b; return (_b = (_a = participantTemp.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/'); })) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('Patient/', '');
                    return [4 /*yield*/, (0, patients_1.getRelatedPersonForPatient)(patientId || '', oystehr)];
                case 1:
                    relatedPerson = _d.sent();
                    if (relatedPerson) {
                        return [2 /*return*/, {
                                resource: "RelatedPerson/".concat(relatedPerson.id),
                            }];
                    }
                    else {
                        console.log("No RelatedPerson found for patient ".concat(patientId, " not sending text message"));
                        return [2 /*return*/];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
var defaultLowersFromEmail = 'ottehr-support@masslight.com'; // todo: change to support@ottehr.com when doing so does not land things in spam folder
var EmailClient = /** @class */ (function () {
    function EmailClient(config, secrets) {
        this.config = config;
        this.secrets = secrets;
        var SENDGRID_SEND_EMAIL_API_KEY = '';
        try {
            SENDGRID_SEND_EMAIL_API_KEY = (0, utils_1.getSecret)(utils_1.SecretsKeys.SENDGRID_SEND_EMAIL_API_KEY, secrets);
        }
        catch (_a) {
            if (!this.config.featureFlag) {
                console.log("".concat(SENDGRID_SEND_EMAIL_API_KEY, " not found but email sending is disabled, continuing"));
            }
            else {
                throw new Error('SendGrid Send Email API key is not set in secrets');
            }
        }
        mail_1.default.setApiKey(SENDGRID_SEND_EMAIL_API_KEY);
    }
    EmailClient.prototype.sendEmail = function (to, template, templateData, attachments) {
        return __awaiter(this, void 0, void 0, function () {
            var templateIdSecretName, SENDGRID_EMAIL_BCC, ENVIRONMENT, environmentSubjectPrepend, templateId, baseEmail, projectName, projectDomain, sender, configReplyTo, emailRest, supportPhoneNumber, fromEmail, replyTo, email, emailConfiguration, featureFlag, sendResult, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        templateIdSecretName = template.templateIdSecretName;
                        SENDGRID_EMAIL_BCC = [];
                        ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, this.secrets);
                        environmentSubjectPrepend = ENVIRONMENT === 'production' ? '' : "[".concat(ENVIRONMENT, "] ");
                        templateId = '';
                        try {
                            templateId = (0, utils_1.getSecret)(templateIdSecretName, this.secrets);
                        }
                        catch (error) {
                            if (!this.config.featureFlag || template.disabled) {
                                console.log("".concat(templateIdSecretName, " not found but email sending is disabled, continuing"));
                            }
                            else {
                                throw error;
                            }
                        }
                        if (ENVIRONMENT === 'local') {
                            SENDGRID_EMAIL_BCC = [];
                        }
                        baseEmail = utils_1.BRANDING_CONFIG.email, projectName = utils_1.BRANDING_CONFIG.projectName;
                        projectDomain = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, this.secrets);
                        sender = baseEmail.sender, configReplyTo = baseEmail.replyTo, emailRest = __rest(baseEmail, ["sender", "replyTo"]);
                        supportPhoneNumber = (0, utils_1.getSupportPhoneFor)(templateData.location);
                        fromEmail = ENVIRONMENT !== 'local' ? sender : defaultLowersFromEmail;
                        replyTo = ENVIRONMENT !== 'local' ? configReplyTo : defaultLowersFromEmail;
                        email = __assign(__assign({}, emailRest), { supportPhoneNumber: supportPhoneNumber });
                        emailConfiguration = __assign({ to: to, from: {
                                email: fromEmail,
                                name: projectName,
                            }, bcc: SENDGRID_EMAIL_BCC.filter(function (item) { return !to.includes(item); }), replyTo: replyTo, templateId: templateId, dynamic_template_data: __assign(__assign({}, templateData), { env: environmentSubjectPrepend, branding: {
                                    email: email,
                                    projectName: projectName,
                                    projectDomain: projectDomain,
                                } }) }, (attachments &&
                            attachments.length > 0 && {
                            attachments: attachments.map(function (attachment) { return (__assign({ content: attachment.content, filename: attachment.filename, type: attachment.type, disposition: attachment.disposition || 'attachment' }, (attachment.contentId && { content_id: attachment.contentId }))); }),
                        }));
                        featureFlag = this.config.featureFlag;
                        if (!featureFlag || template.disabled) {
                            console.log('Email sending is disabled');
                            console.log("featureFlag: ".concat(featureFlag, ", template.disabled: ").concat(template.disabled));
                            console.log('Email input being swallowed: ', JSON.stringify(emailConfiguration, null, 2));
                            return [2 /*return*/];
                        }
                        else {
                            JSON.stringify(emailConfiguration, null, 2);
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, mail_1.default.send(emailConfiguration)];
                    case 2:
                        sendResult = _a.sent();
                        console.log("Details of successful sendgrid send: statusCode, ".concat(sendResult[0].statusCode, ". body, ").concat(JSON.stringify(sendResult[0].body)));
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        errorMessage = "Error sending email ".concat(templateIdSecretName, " to ").concat(to, " (").concat(projectName, "})");
                        console.error("".concat(errorMessage, ": ").concat(error_1));
                        void (0, errors_1.sendErrors)(errorMessage, ENVIRONMENT);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    EmailClient.prototype.getFeatureFlag = function () {
        return this.config.featureFlag;
    };
    EmailClient.prototype.sendErrorEmail = function (to, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            var recipients, ottehrSupportEmail;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        recipients = typeof to === 'string' ? [to] : __spreadArray([], to, true);
                        ottehrSupportEmail = utils_1.BRANDING_CONFIG.email.sender;
                        if (!recipients.includes(ottehrSupportEmail)) {
                            recipients.push(ottehrSupportEmail);
                        }
                        return [4 /*yield*/, this.sendEmail(recipients, this.config.templates.errorReport, templateData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EmailClient.prototype.sendVirtualConfirmationEmail = function (to, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendEmail(to, this.config.templates.telemedConfirmation, templateData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EmailClient.prototype.sendVirtualCancelationEmail = function (to, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendEmail(to, this.config.templates.telemedCancelation, templateData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EmailClient.prototype.sendVirtualCompletionEmail = function (to, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendEmail(to, this.config.templates.telemedCompletion, templateData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EmailClient.prototype.sendVideoChatInvitationEmail = function (to, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendEmail(to, this.config.templates.telemedInvitation, templateData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EmailClient.prototype.sendInPersonConfirmationEmail = function (to, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendEmail(to, this.config.templates.inPersonConfirmation, templateData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EmailClient.prototype.sendInPersonCancelationEmail = function (to, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendEmail(to, this.config.templates.inPersonCancelation, templateData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EmailClient.prototype.sendInPersonCompletionEmail = function (to, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendEmail(to, this.config.templates.inPersonCompletion, templateData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EmailClient.prototype.sendInPersonReminderEmail = function (email, templateData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendEmail(email, this.config.templates.inPersonReminder, templateData)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EmailClient.prototype.sendInPersonReceiptEmail = function (email, templateData, attachments) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.sendEmail(email, this.config.templates.inPersonReceipt, templateData, attachments)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return EmailClient;
}());
var getEmailClient = function (secrets) {
    return new EmailClient(utils_1.SENDGRID_CONFIG, secrets);
};
exports.getEmailClient = getEmailClient;
function sendSms(message, resourceReference, oystehr, ENVIRONMENT) {
    return __awaiter(this, void 0, void 0, function () {
        var commId, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, oystehr.transactionalSMS.send({
                            message: message,
                            resource: resourceReference,
                        })];
                case 1:
                    commId = _a.sent();
                    console.log('message send res: ', commId);
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _a.sent();
                    console.log('message send error: ', JSON.stringify(e_1));
                    void (0, errors_1.sendErrors)(e_1, ENVIRONMENT);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function sendSmsForPatient(message, oystehr, patient, ENVIRONMENT) {
    return __awaiter(this, void 0, void 0, function () {
        var relatedPerson, recipient;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!patient) {
                        console.error("Message didn't send because no patient was found for encounter");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, (0, patients_1.getRelatedPersonForPatient)(patient.id, oystehr)];
                case 1:
                    relatedPerson = _a.sent();
                    if (!relatedPerson) {
                        console.error("Message didn't send because no related person was found for this patient, patientId: " + patient.id);
                        return [2 /*return*/];
                    }
                    recipient = "RelatedPerson/".concat(relatedPerson.id);
                    return [4 /*yield*/, sendSms(message, recipient, oystehr, ENVIRONMENT)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
var makeCancelVisitUrl = function (appointmentId, secrets) {
    var baseUrl = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
    return "".concat(baseUrl, "/visit/").concat(appointmentId, "/cancel");
};
exports.makeCancelVisitUrl = makeCancelVisitUrl;
var makePaperworkUrl = function (appointmentId, secrets) {
    var baseUrl = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
    return "".concat(baseUrl, "/paperwork/").concat(appointmentId);
};
exports.makePaperworkUrl = makePaperworkUrl;
var makeJoinVisitUrl = function (appointmentId, secrets) {
    var baseUrl = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
    return "".concat(baseUrl, "/waiting-room?appointment_id=").concat(appointmentId);
};
exports.makeJoinVisitUrl = makeJoinVisitUrl;
var makeBookAgainUrl = function (appointmentId, secrets) {
    var baseUrl = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
    return "".concat(baseUrl, "/visit/").concat(appointmentId, "/book-again");
};
exports.makeBookAgainUrl = makeBookAgainUrl;
var makeModifyVisitUrl = function (appointmentId, secrets) {
    var baseUrl = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
    return "".concat(baseUrl, "/visit/").concat(appointmentId, "/reschedule");
};
exports.makeModifyVisitUrl = makeModifyVisitUrl;
var makeVisitLandingUrl = function (appointmentId, secrets) {
    var baseUrl = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
    return "".concat(baseUrl, "/visit/").concat(appointmentId);
};
exports.makeVisitLandingUrl = makeVisitLandingUrl;
var makeAddressUrl = function (address) {
    return "https://www.google.com/maps/search/?api=1&query=".concat(encodeURI(address));
};
exports.makeAddressUrl = makeAddressUrl;
