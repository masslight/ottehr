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
exports.Schema20250925 = exports.REF_REGEX = exports.VAR_REGEX = void 0;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var escape_terraform_1 = require("./escape-terraform");
exports.VAR_REGEX = /#\{var\/([^}]+)\}/g;
exports.REF_REGEX = /#\{ref\/([^}/]+)\/([^}/]+)\/([^}]+)\}/g;
var Schema20250925 = /** @class */ (function () {
    function Schema20250925(specFiles, vars, outputPath, zambdasDirPath) {
        this.specFiles = specFiles;
        this.vars = vars;
        this.outputPath = outputPath;
        this.zambdasDirPath = zambdasDirPath;
        this.resources = {
            project: {},
            apps: {},
            buckets: {},
            faxNumbers: {},
            fhirResources: {},
            labRoutes: {},
            m2ms: {},
            outputs: {},
            roles: {},
            secrets: {},
            zambdas: {},
        };
        for (var _i = 0, _a = this.specFiles.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], _ = _b[0], specFile = _b[1];
            var spec = this.validate(specFile);
            this.resources.project = __assign(__assign({}, this.resources.project), spec.project);
            this.resources.apps = __assign(__assign({}, this.resources.apps), spec.apps);
            this.resources.buckets = __assign(__assign({}, this.resources.buckets), spec.buckets);
            this.resources.faxNumbers = __assign(__assign({}, this.resources.faxNumbers), spec.faxNumbers);
            this.resources.fhirResources = __assign(__assign({}, this.resources.fhirResources), spec.fhirResources);
            this.resources.labRoutes = __assign(__assign({}, this.resources.labRoutes), spec.labRoutes);
            this.resources.m2ms = __assign(__assign({}, this.resources.m2ms), spec.m2ms);
            this.resources.outputs = __assign(__assign({}, this.resources.outputs), spec.outputs);
            this.resources.roles = __assign(__assign({}, this.resources.roles), spec.roles);
            this.resources.secrets = __assign(__assign({}, this.resources.secrets), spec.secrets);
            this.resources.zambdas = __assign(__assign({}, this.resources.zambdas), spec.zambdas);
        }
    }
    Schema20250925.prototype.getSchemaVersion = function () {
        return '2025-09-25';
    };
    Schema20250925.prototype.validate = function (specFile) {
        var spec = specFile.spec;
        // Check for unknown top-level keys
        for (var _i = 0, _a = Object.keys(spec); _i < _a.length; _i++) {
            var key = _a[_i];
            if (![
                'schema-version',
                'project',
                'apps',
                'buckets',
                'faxNumbers',
                'fhirResources',
                'labRoutes',
                'm2ms',
                'outputs',
                'roles',
                'secrets',
                'zambdas',
            ].includes(key)) {
                throw new Error("".concat(specFile.path, " has unknown top-level key: ").concat(key));
            }
        }
        // Ensure at least one resource type is present
        if (![
            'project',
            'apps',
            'buckets',
            'faxNumbers',
            'fhirResources',
            'labRoutes',
            'm2ms',
            'outputs',
            'roles',
            'secrets',
            'zambdas',
        ].some(function (key) { return Object.prototype.hasOwnProperty.call(spec, key); })) {
            throw new Error("".concat(specFile.path, " must have at least one of the following top-level keys: project, apps, buckets, faxNumbers, fhirResources, labRoutes, m2ms, outputs, roles, secrets, zambdas."));
        }
        // Check for duplicate keys within each resource type
        for (var _b = 0, _c = [
            'project',
            'apps',
            'buckets',
            'faxNumbers',
            'fhirResources',
            'labRoutes',
            'm2ms',
            'outputs',
            'roles',
            'secrets',
            'zambdas',
        ]; _b < _c.length; _b++) {
            var resourceType = _c[_b];
            if (Object.prototype.hasOwnProperty.call(spec, resourceType)) {
                var resourceKeys = Object.keys(spec[resourceType]);
                // Check for duplicate names within the spec file
                var uniqueResourceNames = new Set(resourceKeys);
                if (uniqueResourceNames.size !== resourceKeys.length) {
                    throw new Error("".concat(specFile.path, " has duplicate names in resource type: ").concat(resourceType));
                }
                // Check for duplicate names across spec files
                for (var _d = 0, resourceKeys_1 = resourceKeys; _d < resourceKeys_1.length; _d++) {
                    var key = resourceKeys_1[_d];
                    if (Object.hasOwnProperty.call(this.resources[resourceType], key)) {
                        throw new Error("".concat(specFile.path, " has duplicate resource name \"").concat(key, "\" in resource type: ").concat(resourceType));
                    }
                }
            }
        }
        return spec;
    };
    Schema20250925.prototype.generate = function () {
        return __awaiter(this, void 0, void 0, function () {
            var projectOutFile, projectResources, projects, appOutFile, appResources, _i, _a, _b, appName, app, bucketOutFile, bucketResources, _c, _d, _e, bucketName, bucket, faxOutFile, faxResources, _f, _g, faxName, fhirOutFile, fhirResources, _h, _j, _k, resourceKey, resource, resourceData, managedFields, labRoutesOutFile, labRoutesResources, _l, _m, _o, routeName, route, m2msOutFile, m2mResources, _p, _q, _r, m2mName, m2m, rolesOutFile, roleResources, _s, _t, _u, roleName, role, secretsOutFile, secretResources, _v, _w, _x, secretName, secret, zambdasOutFile, zambdaResources, _y, _z, _0, zambdaName, zambda, outputsOutFile, outputDirectives, _1, _2, _3, outputName, output, refMatches, _4, refMatches_1, _5, fullMatch, resourceType, resourceName, fieldName, tfRef, tfOutputName, _6, _7, resourceType, _8, _9, resourceName, tfRef, tfOutputName;
            var _10, _11, _12, _13, _14, _15, _16;
            return __generator(this, function (_17) {
                switch (_17.label) {
                    case 0:
                        projectOutFile = node_path_1.default.join(this.outputPath, 'project.tf.json');
                        projectResources = {
                            resource: { oystehr_project_configuration: {} },
                        };
                        projects = Object.entries(this.resources.project);
                        if (projects.length) {
                            projectResources.resource.oystehr_project_configuration[projects[0][0]] = {
                                name: this.getValue(projects[0][1].name, this.resources),
                                description: this.getValue(projects[0][1].description, this.resources),
                                signup_enabled: this.getValue(projects[0][1].signupEnabled, this.resources),
                                default_patient_role_id: this.getValue(projects[0][1].defaultPatientRoleId, this.resources),
                            };
                        }
                        if (!Object.keys(projectResources.resource.oystehr_project_configuration).length) return [3 /*break*/, 2];
                        return [4 /*yield*/, promises_1.default.writeFile(projectOutFile, JSON.stringify(projectResources, null, 2))];
                    case 1:
                        _17.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, promises_1.default.rm(projectOutFile, { force: true })];
                    case 3:
                        _17.sent();
                        _17.label = 4;
                    case 4:
                        appOutFile = node_path_1.default.join(this.outputPath, 'apps.tf.json');
                        appResources = {
                            resource: { oystehr_application: {} },
                        };
                        for (_i = 0, _a = Object.entries(this.resources.apps); _i < _a.length; _i++) {
                            _b = _a[_i], appName = _b[0], app = _b[1];
                            appResources.resource.oystehr_application[appName] = {
                                name: this.getValue(app.name, this.resources),
                                description: this.getValue(app.description, this.resources),
                                login_redirect_uri: this.getValue(app.loginRedirectUri, this.resources),
                                login_with_email_enabled: this.getValue(app.loginWithEmailEnabled, this.resources),
                                allowed_callback_urls: JSON.parse(this.getValue(JSON.stringify((_10 = app.allowedCallbackUrls) !== null && _10 !== void 0 ? _10 : []), this.resources)),
                                allowed_logout_urls: JSON.parse(this.getValue(JSON.stringify((_11 = app.allowedLogoutUrls) !== null && _11 !== void 0 ? _11 : []), this.resources)),
                                allowed_web_origins_urls: JSON.parse(this.getValue(JSON.stringify((_12 = app.allowedWebOriginsUrls) !== null && _12 !== void 0 ? _12 : []), this.resources)),
                                allowed_cors_origins_urls: JSON.parse(this.getValue(JSON.stringify((_13 = app.allowedCORSOriginsUrls) !== null && _13 !== void 0 ? _13 : []), this.resources)),
                                passwordless_sms: this.getValue(app.passwordlessSMS, this.resources),
                                mfa_enabled: this.getValue(app.mfaEnabled, this.resources),
                                should_send_invite_email: this.getValue(app.shouldSendInviteEmail, this.resources),
                                logo_uri: this.getValue(app.logoUri, this.resources),
                                refresh_token_enabled: this.getValue(app.refreshTokenEnabled, this.resources),
                            };
                            // If there is project configuration, we need to wait on it being set up in case they are changing relevant values
                            if (Object.keys(projects).length) {
                                appResources.resource.oystehr_application[appName].depends_on = [
                                    "oystehr_project_configuration.".concat(projects[0][0]),
                                ];
                            }
                        }
                        if (!Object.keys(appResources.resource.oystehr_application).length) return [3 /*break*/, 6];
                        return [4 /*yield*/, promises_1.default.writeFile(appOutFile, JSON.stringify(appResources, null, 2))];
                    case 5:
                        _17.sent();
                        return [3 /*break*/, 8];
                    case 6: return [4 /*yield*/, promises_1.default.rm(appOutFile, { force: true })];
                    case 7:
                        _17.sent();
                        _17.label = 8;
                    case 8:
                        bucketOutFile = node_path_1.default.join(this.outputPath, 'buckets.tf.json');
                        bucketResources = {
                            resource: { oystehr_z3_bucket: {} },
                        };
                        for (_c = 0, _d = Object.entries(this.resources.buckets); _c < _d.length; _c++) {
                            _e = _d[_c], bucketName = _e[0], bucket = _e[1];
                            bucketResources.resource.oystehr_z3_bucket[bucketName] = {
                                name: this.getValue(bucket.name, this.resources),
                                removal_policy: this.getValue(bucket.removalPolicy, this.resources),
                            };
                        }
                        if (!Object.keys(bucketResources.resource.oystehr_z3_bucket).length) return [3 /*break*/, 10];
                        return [4 /*yield*/, promises_1.default.writeFile(bucketOutFile, JSON.stringify(bucketResources, null, 2))];
                    case 9:
                        _17.sent();
                        return [3 /*break*/, 12];
                    case 10: return [4 /*yield*/, promises_1.default.rm(bucketOutFile, { force: true })];
                    case 11:
                        _17.sent();
                        _17.label = 12;
                    case 12:
                        faxOutFile = node_path_1.default.join(this.outputPath, 'fax.tf.json');
                        faxResources = {
                            resource: { oystehr_fax_number: {} },
                        };
                        for (_f = 0, _g = Object.entries(this.resources.faxNumbers); _f < _g.length; _f++) {
                            faxName = _g[_f][0];
                            faxResources.resource.oystehr_fax_number[faxName] = {};
                        }
                        if (!Object.keys(faxResources.resource.oystehr_fax_number).length) return [3 /*break*/, 14];
                        return [4 /*yield*/, promises_1.default.writeFile(faxOutFile, JSON.stringify(faxResources, null, 2))];
                    case 13:
                        _17.sent();
                        return [3 /*break*/, 16];
                    case 14: return [4 /*yield*/, promises_1.default.rm(faxOutFile, { force: true })];
                    case 15:
                        _17.sent();
                        _17.label = 16;
                    case 16:
                        fhirOutFile = node_path_1.default.join(this.outputPath, 'fhir-resources.tf.json');
                        fhirResources = {
                            resource: { oystehr_fhir_resource: {} },
                        };
                        for (_h = 0, _j = Object.entries(this.resources.fhirResources); _h < _j.length; _h++) {
                            _k = _j[_h], resourceKey = _k[0], resource = _k[1];
                            resourceData = structuredClone(resource.resource);
                            managedFields = (_14 = resource.managedFields) !== null && _14 !== void 0 ? _14 : undefined;
                            fhirResources.resource.oystehr_fhir_resource[resourceKey] = {
                                type: this.getValue(resourceData.resourceType, this.resources),
                                data: JSON.parse(this.getValue(JSON.stringify(resourceData), this.resources)),
                                managed_fields: managedFields,
                            };
                        }
                        if (!Object.keys(fhirResources.resource.oystehr_fhir_resource).length) return [3 /*break*/, 18];
                        return [4 /*yield*/, promises_1.default.writeFile(fhirOutFile, JSON.stringify(fhirResources, null, 2))];
                    case 17:
                        _17.sent();
                        return [3 /*break*/, 20];
                    case 18: return [4 /*yield*/, promises_1.default.rm(fhirOutFile, { force: true })];
                    case 19:
                        _17.sent();
                        _17.label = 20;
                    case 20:
                        labRoutesOutFile = node_path_1.default.join(this.outputPath, 'lab-routes.tf.json');
                        labRoutesResources = {
                            resource: { oystehr_lab_route: {} },
                        };
                        for (_l = 0, _m = Object.entries(this.resources.labRoutes); _l < _m.length; _l++) {
                            _o = _m[_l], routeName = _o[0], route = _o[1];
                            labRoutesResources.resource.oystehr_lab_route[routeName] = {
                                account_number: this.getValue(route.accountNumber, this.resources),
                                lab_id: this.getValue(route.labId, this.resources),
                            };
                        }
                        if (!Object.keys(labRoutesResources.resource.oystehr_lab_route).length) return [3 /*break*/, 22];
                        return [4 /*yield*/, promises_1.default.writeFile(labRoutesOutFile, JSON.stringify(labRoutesResources, null, 2))];
                    case 21:
                        _17.sent();
                        return [3 /*break*/, 24];
                    case 22: return [4 /*yield*/, promises_1.default.rm(labRoutesOutFile, { force: true })];
                    case 23:
                        _17.sent();
                        _17.label = 24;
                    case 24:
                        m2msOutFile = node_path_1.default.join(this.outputPath, 'm2ms.tf.json');
                        m2mResources = {
                            resource: { oystehr_m2m: {} },
                        };
                        for (_p = 0, _q = Object.entries(this.resources.m2ms); _p < _q.length; _p++) {
                            _r = _q[_p], m2mName = _r[0], m2m = _r[1];
                            m2mResources.resource.oystehr_m2m[m2mName] = {
                                name: this.getValue(m2m.name, this.resources),
                                description: this.getValue(m2m.description, this.resources),
                                access_policy: {
                                    rule: JSON.parse(this.getValue(JSON.stringify((_15 = m2m.accessPolicy) !== null && _15 !== void 0 ? _15 : []), this.resources)),
                                },
                                roles: JSON.parse(this.getValue(JSON.stringify((_16 = m2m.roles) !== null && _16 !== void 0 ? _16 : []), this.resources)),
                                jwks_url: this.getValue(m2m.jwksUrl, this.resources),
                                client_secret_version: this.getValue(m2m.clientSecretVersion, this.resources),
                            };
                        }
                        if (!Object.keys(m2mResources.resource.oystehr_m2m).length) return [3 /*break*/, 26];
                        return [4 /*yield*/, promises_1.default.writeFile(m2msOutFile, JSON.stringify(m2mResources, null, 2))];
                    case 25:
                        _17.sent();
                        return [3 /*break*/, 28];
                    case 26: return [4 /*yield*/, promises_1.default.rm(m2msOutFile, { force: true })];
                    case 27:
                        _17.sent();
                        _17.label = 28;
                    case 28:
                        rolesOutFile = node_path_1.default.join(this.outputPath, 'roles.tf.json');
                        roleResources = {
                            resource: { oystehr_role: {} },
                        };
                        for (_s = 0, _t = Object.entries(this.resources.roles); _s < _t.length; _s++) {
                            _u = _t[_s], roleName = _u[0], role = _u[1];
                            roleResources.resource.oystehr_role[roleName] = {
                                name: this.getValue(role.name, this.resources),
                                description: this.getValue(role.description, this.resources),
                                access_policy: {
                                    rule: JSON.parse(this.getValue(JSON.stringify(role.accessPolicy), this.resources)),
                                },
                            };
                        }
                        if (!Object.keys(roleResources.resource.oystehr_role).length) return [3 /*break*/, 30];
                        return [4 /*yield*/, promises_1.default.writeFile(rolesOutFile, JSON.stringify(roleResources, null, 2))];
                    case 29:
                        _17.sent();
                        return [3 /*break*/, 32];
                    case 30: return [4 /*yield*/, promises_1.default.rm(rolesOutFile, { force: true })];
                    case 31:
                        _17.sent();
                        _17.label = 32;
                    case 32:
                        secretsOutFile = node_path_1.default.join(this.outputPath, 'secrets.tf.json');
                        secretResources = {
                            resource: { oystehr_secret: {} },
                        };
                        for (_v = 0, _w = Object.entries(this.resources.secrets); _v < _w.length; _v++) {
                            _x = _w[_v], secretName = _x[0], secret = _x[1];
                            secretResources.resource.oystehr_secret[secretName] = {
                                name: this.getValue(secret.name, this.resources),
                                value: this.getValue(secret.value, this.resources),
                            };
                        }
                        if (!Object.keys(secretResources.resource.oystehr_secret).length) return [3 /*break*/, 34];
                        return [4 /*yield*/, promises_1.default.writeFile(secretsOutFile, JSON.stringify(secretResources, null, 2))];
                    case 33:
                        _17.sent();
                        return [3 /*break*/, 36];
                    case 34: return [4 /*yield*/, promises_1.default.rm(secretsOutFile, { force: true })];
                    case 35:
                        _17.sent();
                        _17.label = 36;
                    case 36:
                        zambdasOutFile = node_path_1.default.join(this.outputPath, 'zambdas.tf.json');
                        zambdaResources = {
                            resource: { oystehr_zambda: {} },
                        };
                        for (_y = 0, _z = Object.entries(this.resources.zambdas); _y < _z.length; _y++) {
                            _0 = _z[_y], zambdaName = _0[0], zambda = _0[1];
                            zambdaResources.resource.oystehr_zambda[zambdaName] = {
                                name: this.getValue(zambda.name, this.resources),
                                runtime: this.getValue(zambda.runtime, this.resources),
                                memory_size: this.getValue(zambda.memorySize, this.resources),
                                timeout: this.getValue(zambda.timeout, this.resources),
                                trigger_method: this.getValue(zambda.type, this.resources),
                                schedule: this.getValue(zambda.schedule, this.resources),
                                source: node_path_1.default.join(this.zambdasDirPath, this.getValue(zambda.zip, this.resources)),
                            };
                        }
                        if (!Object.keys(zambdaResources.resource.oystehr_zambda).length) return [3 /*break*/, 38];
                        return [4 /*yield*/, promises_1.default.writeFile(zambdasOutFile, JSON.stringify(zambdaResources, null, 2))];
                    case 37:
                        _17.sent();
                        return [3 /*break*/, 40];
                    case 38: return [4 /*yield*/, promises_1.default.rm(zambdasOutFile, { force: true })];
                    case 39:
                        _17.sent();
                        _17.label = 40;
                    case 40:
                        outputsOutFile = node_path_1.default.join(this.outputPath, 'outputs.tf.json');
                        outputDirectives = { output: {} };
                        // Explicit outputs from spec files:
                        for (_1 = 0, _2 = Object.entries(this.resources.outputs); _1 < _2.length; _1++) {
                            _3 = _2[_1], outputName = _3[0], output = _3[1];
                            outputDirectives.output[outputName] = { value: this.getValue(output.value, this.resources) };
                        }
                        refMatches = __spreadArray([], JSON.stringify(this.resources).matchAll(exports.REF_REGEX), true);
                        console.log("Found ".concat(refMatches.length, " references in specs."));
                        for (_4 = 0, refMatches_1 = refMatches; _4 < refMatches_1.length; _4++) {
                            _5 = refMatches_1[_4], fullMatch = _5[0], resourceType = _5[1], resourceName = _5[2], fieldName = _5[3];
                            tfRef = this.getTerraformResourceReference(this.resources, resourceType, resourceName, fieldName);
                            if (tfRef) {
                                console.log("Reference ".concat(fullMatch, " resolved to ").concat(tfRef));
                                tfOutputName = this.getTerraformResourceOutputName(fullMatch);
                                outputDirectives.output[tfOutputName] = { value: "${".concat(tfRef, "}") };
                            }
                            else {
                                console.log('Warning: could not resolve reference', fullMatch);
                            }
                        }
                        // Implicit outputs of all resource IDs:
                        for (_6 = 0, _7 = Object.keys(this.resources); _6 < _7.length; _6++) {
                            resourceType = _7[_6];
                            if (this.isResourceType(resourceType)) {
                                for (_8 = 0, _9 = Object.keys(this.resources[resourceType]); _8 < _9.length; _8++) {
                                    resourceName = _9[_8];
                                    tfRef = this.getTerraformResourceReference(this.resources, resourceType, resourceName, this.getIdentifierForResourceType(resourceType));
                                    if (tfRef) {
                                        tfOutputName = this.getTerraformResourceOutputName(tfRef);
                                        outputDirectives.output[tfOutputName] = { value: "${".concat(tfRef, "}") };
                                    }
                                }
                            }
                        }
                        if (!Object.keys(outputDirectives.output).length) return [3 /*break*/, 42];
                        return [4 /*yield*/, promises_1.default.writeFile(outputsOutFile, JSON.stringify(outputDirectives, null, 2))];
                    case 41:
                        _17.sent();
                        return [3 /*break*/, 44];
                    case 42: return [4 /*yield*/, promises_1.default.rm(outputsOutFile, { force: true })];
                    case 43:
                        _17.sent();
                        _17.label = 44;
                    case 44: return [2 /*return*/];
                }
            });
        });
    };
    Schema20250925.prototype.getValue = function (value, spec) {
        var _this = this;
        if (typeof value !== 'string') {
            return value;
        }
        var varReplacedValue = this.replaceVariableWithValue(value);
        var refReplacedValue = varReplacedValue.replace(exports.REF_REGEX, function (match, resourceType, resourceName, fieldName) {
            var tfRef = _this.getTerraformResourceReference(spec, resourceType, resourceName, fieldName);
            if (tfRef) {
                return "${".concat(tfRef, "}");
            }
            return match;
        });
        // Escape Terraform template syntax in literal values
        return (0, escape_terraform_1.escapeTerraformTemplateSyntax)(refReplacedValue);
    };
    Schema20250925.prototype.replaceVariableWithValue = function (value) {
        var _this = this;
        return value.replace(exports.VAR_REGEX, function (match, varName) {
            if (Object.prototype.hasOwnProperty.call(_this.vars, varName)) {
                return _this.vars[varName];
            }
            return match;
        });
    };
    Schema20250925.prototype.getTerraformResourceReference = function (spec, resourceType, resourceName, fieldName) {
        if (this.isResourceType(resourceType) && Object.prototype.hasOwnProperty.call(spec[resourceType], resourceName)) {
            var oystehrResource = this.oystehrResourceFromResourceType(resourceType);
            var field = fieldName;
            if (resourceType === 'fhirResources') {
                // Oystehr Terraform provider nests this under "data", schema nests it under "resource"
                field = fieldName.replace(/resource\./, 'data.');
            }
            return "".concat(oystehrResource, ".").concat(resourceName, ".").concat(field);
        }
        return null;
    };
    Schema20250925.prototype.getTerraformResourceOutputName = function (fullMatch, module) {
        var transformedMatch = fullMatch.replace(/\//g, '_').replace(/\./g, '_');
        if (transformedMatch.startsWith('#{ref_')) {
            // Strip off the #{ref/ and the closing }
            transformedMatch = transformedMatch.slice(2, -1);
        }
        return "".concat(module ? "module.".concat(module, ".") : '').concat(transformedMatch);
    };
    Schema20250925.prototype.oystehrResourceFromResourceType = function (resourceType) {
        switch (resourceType) {
            case 'apps':
                return 'oystehr_application';
            case 'buckets':
                return 'oystehr_z3_bucket';
            case 'faxNumbers':
                return 'oystehr_fax_number';
            case 'fhirResources':
                return 'oystehr_fhir_resource';
            case 'labRoutes':
                return 'oystehr_lab_route';
            case 'm2ms':
                return 'oystehr_m2m';
            case 'project':
                return 'oystehr_project_configuration';
            case 'roles':
                return 'oystehr_role';
            case 'secrets':
                return 'oystehr_secret';
            case 'zambdas':
                return 'oystehr_zambda';
            default:
                throw new Error("Unknown resource type: ".concat(resourceType));
        }
    };
    Schema20250925.prototype.isResourceType = function (resourceType) {
        return [
            'apps',
            'buckets',
            'faxNumbers',
            'fhirResources',
            'labRoutes',
            'm2ms',
            'project',
            'roles',
            'secrets',
            'zambdas',
        ].includes(resourceType);
    };
    Schema20250925.prototype.getIdentifierForResourceType = function (resourceType) {
        switch (resourceType) {
            case 'apps':
            case 'fhirResources':
            case 'labRoutes':
            case 'm2ms':
            case 'project':
            case 'roles':
            case 'zambdas':
                return 'id';
            case 'faxNumbers':
                return 'number';
            case 'buckets':
            case 'secrets':
                return 'name';
            default:
                throw new Error("Unknown resource type: ".concat(resourceType));
        }
    };
    Schema20250925.prototype.isObject = function (spec) {
        return spec && typeof spec === 'object' && !Array.isArray(spec);
    };
    return Schema20250925;
}());
exports.Schema20250925 = Schema20250925;
