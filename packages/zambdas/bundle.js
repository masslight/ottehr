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
var esbuild_plugin_1 = require("@sentry/esbuild-plugin");
var archiver_1 = require("archiver");
var esbuild = require("esbuild");
var fs_1 = require("fs");
var path_1 = require("path");
var zambdas_json_1 = require("../../config/oystehr/zambdas.json");
var loadEnvZambdas = function (env) {
    var envConfigPath = path_1.default.resolve(__dirname, "../../config/oystehr/env/".concat(env, "/zambdas.json"));
    try {
        if (fs_1.default.existsSync(envConfigPath)) {
            var envSpec = JSON.parse(fs_1.default.readFileSync(envConfigPath, 'utf-8'));
            console.log("Loading env-specific zambdas from: ".concat(envConfigPath));
            return Object.values(envSpec.zambdas);
        }
    }
    catch (error) {
        console.warn("Failed to load env-specific zambdas from ".concat(envConfigPath, ":"), error);
    }
    return [];
};
var zambdasList = function () {
    var baseZambdas = Object.entries(zambdas_json_1.default.zambdas).map(function (_a) {
        var _key = _a[0], spec = _a[1];
        return spec;
    });
    var env = process.env.ENV || '';
    if (env) {
        var envZambdas = loadEnvZambdas(env);
        return __spreadArray(__spreadArray([], baseZambdas, true), envZambdas, true);
    }
    return baseZambdas;
};
var chunkArray = function (array, chunkSize) {
    var chunks = [];
    for (var i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
};
var BUNDLE_CHUNK_SIZE = 35;
var ZIP_CHUNK_SIZE = 20;
var getSentryPlugins = function (isSentryEnabled) {
    if (!isSentryEnabled)
        return [];
    return [
        (0, esbuild_plugin_1.sentryEsbuildPlugin)({
            authToken: process.env.SENTRY_AUTH_TOKEN,
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            sourcemaps: {
                // if enabled, creates unstable js builds, so we will add debug IDs using CLI
                // see this issue for more information https://github.com/getsentry/sentry-javascript-bundler-plugins/issues/500
                disable: true,
            },
            release: {
                // if enabled, creates unstable js builds, so we will create releases using CLI
                inject: false,
            },
        }),
    ];
};
var buildZambdaWithContext = function (zambda, outdir, isSentryEnabled) { return __awaiter(void 0, void 0, void 0, function () {
    var outfile, ctx, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                outfile = "".concat(outdir, "/").concat(zambda.src.substring('src/'.length), ".js");
                return [4 /*yield*/, esbuild.context({
                        entryPoints: ["".concat(zambda.src, ".ts")],
                        bundle: true,
                        outfile: outfile,
                        sourcemap: isSentryEnabled,
                        platform: 'node',
                        external: ['@aws-sdk/*'],
                        treeShaking: true,
                        plugins: getSentryPlugins(isSentryEnabled),
                    })];
            case 1:
                ctx = _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, 4, 5, 7]);
                return [4 /*yield*/, ctx.rebuild()];
            case 3:
                _a.sent();
                return [3 /*break*/, 7];
            case 4:
                error_1 = _a.sent();
                console.log("Error bundling ".concat(zambda.name, ":"), error_1);
                process.exit(1);
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, ctx.dispose()];
            case 6:
                _a.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); };
// Build zambdas in chunks sequentially to manage memory usage
var buildZambdasInChunks = function (zambdas, outdir, isSentryEnabled) { return __awaiter(void 0, void 0, void 0, function () {
    var uniqueDirs, chunks, i, chunk;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                uniqueDirs = new Set(zambdas.map(function (zambda) { return path_1.default.dirname("".concat(outdir, "/").concat(zambda.src.substring('src/'.length), ".js")); }));
                return [4 /*yield*/, Promise.all(Array.from(uniqueDirs).map(function (dir) { return fs_1.default.promises.mkdir(dir, { recursive: true }).catch(function () { }); }))];
            case 1:
                _a.sent();
                chunks = chunkArray(zambdas, BUNDLE_CHUNK_SIZE);
                console.log("Bundling ".concat(zambdas.length, " zambdas in ").concat(chunks.length, " chunks of up to ").concat(BUNDLE_CHUNK_SIZE, "..."));
                i = 0;
                _a.label = 2;
            case 2:
                if (!(i < chunks.length)) return [3 /*break*/, 5];
                chunk = chunks[i];
                console.log("Bundling chunk ".concat(i + 1, "/").concat(chunks.length, " (").concat(chunk.length, " zambdas)..."));
                return [4 /*yield*/, Promise.all(chunk.map(function (zambda) { return buildZambdaWithContext(zambda, outdir, isSentryEnabled); }))];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4:
                i++;
                return [3 /*break*/, 2];
            case 5: return [2 /*return*/];
        }
    });
}); };
var copyAssets = function (from, to) { return __awaiter(void 0, void 0, void 0, function () {
    var $, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!fs_1.default.existsSync(from)) {
                    console.warn("Assets directory ".concat(from, " does not exist, skipping copy"));
                    return [2 /*return*/];
                }
                return [4 /*yield*/, Promise.resolve().then(function () { return require('execa'); })];
            case 1:
                $ = (_a.sent()).$;
                _a.label = 2;
            case 2:
                _a.trys.push([2, 4, , 5]);
                return [4 /*yield*/, $(templateObject_1 || (templateObject_1 = __makeTemplateObject(["cp -r ", " ", ""], ["cp -r ", " ", ""])), from, to)];
            case 3:
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                error_2 = _a.sent();
                console.error("Failed to copy assets from ".concat(from, " to ").concat(to, ":"), error_2);
                throw error_2;
            case 5: return [2 /*return*/];
        }
    });
}); };
var injectSourceMaps = function () { return __awaiter(void 0, void 0, void 0, function () {
    var $, sentryEnv, shellConfig, revParse, releaseName;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT || !process.env.SENTRY_AUTH_TOKEN) {
                    console.warn('Sentry environment variables are not set');
                    return [2 /*return*/];
                }
                return [4 /*yield*/, Promise.resolve().then(function () { return require('execa'); })];
            case 1:
                $ = (_a.sent()).$;
                sentryEnv = {
                    SENTRY_ORG: process.env.SENTRY_ORG,
                    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
                    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
                };
                shellConfig = {
                    env: sentryEnv,
                    stdio: 'inherit',
                    preferLocal: true,
                };
                return [4 /*yield*/, $(templateObject_2 || (templateObject_2 = __makeTemplateObject(["git rev-parse --verify HEAD"], ["git rev-parse --verify HEAD"])))];
            case 2:
                revParse = _a.sent();
                releaseName = revParse.stdout;
                return [4 /*yield*/, $(shellConfig)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["sentry-cli releases new ", ""], ["sentry-cli releases new ", ""])), releaseName)];
            case 3:
                _a.sent();
                return [4 /*yield*/, $(shellConfig)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["sentry-cli sourcemaps inject .dist --quiet --log-level error"], ["sentry-cli sourcemaps inject .dist --quiet --log-level error"])))];
            case 4:
                _a.sent();
                return [4 /*yield*/, $(shellConfig)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["sentry-cli sourcemaps upload --strict --release ", " .dist"], ["sentry-cli sourcemaps upload --strict --release ", " .dist"])), releaseName)];
            case 5:
                _a.sent();
                return [4 /*yield*/, $(shellConfig)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["sentry-cli releases finalize ", ""], ["sentry-cli releases finalize ", ""])), releaseName)];
            case 6:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var zipZambda = function (sourceFilePath, assetsDir, assetsPath, outPath) { return __awaiter(void 0, void 0, void 0, function () {
    var archive, stream;
    return __generator(this, function (_a) {
        archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        stream = fs_1.default.createWriteStream(outPath);
        return [2 /*return*/, new Promise(function (resolve, reject) {
                var result = archive;
                result = result.file(sourceFilePath, { name: 'index.js', date: new Date('2025-01-01') });
                result = result.directory(assetsDir, assetsPath, { date: new Date('2025-01-01') });
                result.on('error', function (err) { return reject(err); }).pipe(stream);
                stream.on('close', function () { return resolve(); });
                void archive.finalize();
            })];
    });
}); };
var zipInChunks = function (zambdas, assetsDir, assetsPath) { return __awaiter(void 0, void 0, void 0, function () {
    var chunks, i, chunk;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                chunks = chunkArray(zambdas, ZIP_CHUNK_SIZE);
                console.log("Zipping ".concat(zambdas.length, " zambdas in ").concat(chunks.length, " chunks of up to ").concat(ZIP_CHUNK_SIZE, "..."));
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < chunks.length)) return [3 /*break*/, 4];
                chunk = chunks[i];
                console.log("Zipping chunk ".concat(i + 1, "/").concat(chunks.length, " (").concat(chunk.length, " zambdas)..."));
                return [4 /*yield*/, Promise.all(chunk.map(function (zambda) {
                        var sourceDir = ".dist/".concat(zambda.src.substring('src/'.length), ".js");
                        return zipZambda(sourceDir, assetsDir, assetsPath, zambda.zip);
                    }))];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3:
                i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/];
        }
    });
}); };
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var $, zambdas, zambdasWithIcd10Search, icd10AssetDir, assetsDir, isSentryEnabled, icd10Zambdas, regularZambdas;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('Starting to bundle and zip Zambdas...');
                return [4 /*yield*/, Promise.resolve().then(function () { return require('execa'); })];
            case 1:
                $ = (_a.sent()).$;
                return [4 /*yield*/, $({ stdio: 'inherit' })(templateObject_7 || (templateObject_7 = __makeTemplateObject(["rm -rf ./.dist"], ["rm -rf ./.dist"])))];
            case 2:
                _a.sent();
                return [4 /*yield*/, fs_1.default.promises.mkdir('.dist/zips', { recursive: true })];
            case 3:
                _a.sent();
                zambdas = zambdasList();
                console.log('Bundling...');
                console.time('Bundle time');
                zambdasWithIcd10Search = ['icd-10-search', 'radiology-create-order'];
                icd10AssetDir = '.dist/icd-10-cm-tabular';
                assetsDir = '.dist/assets';
                isSentryEnabled = !['local', 'e2e'].includes(process.env.ENV || '');
                icd10Zambdas = zambdas.filter(function (zambda) { return zambdasWithIcd10Search.includes(zambda.name); });
                regularZambdas = zambdas.filter(function (zambda) { return !zambdasWithIcd10Search.includes(zambda.name); });
                return [4 /*yield*/, buildZambdasInChunks(zambdas, '.dist', isSentryEnabled)];
            case 4:
                _a.sent();
                console.log('Copying assets...');
                return [4 /*yield*/, Promise.all([copyAssets('icd-10-cm-tabular', icd10AssetDir), copyAssets('assets', assetsDir)])];
            case 5:
                _a.sent();
                console.timeEnd('Bundle time');
                if (!isSentryEnabled) return [3 /*break*/, 7];
                console.log('Source maps...');
                console.time('Source maps time');
                return [4 /*yield*/, injectSourceMaps()];
            case 6:
                _a.sent();
                console.timeEnd('Source maps time');
                _a.label = 7;
            case 7:
                console.log('Zipping...');
                console.time('Zip time');
                return [4 /*yield*/, Promise.all([
                        zipInChunks(icd10Zambdas, icd10AssetDir, 'icd-10-cm-tabular'),
                        zipInChunks(regularZambdas, assetsDir, 'assets'),
                    ])];
            case 8:
                _a.sent();
                console.timeEnd('Zip time');
                console.log('Zambdas successfully bundled and zipped into .dist/zips');
                return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log('error', error);
    throw error;
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
