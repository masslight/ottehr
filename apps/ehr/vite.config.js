"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vite_plugin_1 = require("@sentry/vite-plugin");
var plugin_react_1 = require("@vitejs/plugin-react");
var browserslist_to_esbuild_1 = require("browserslist-to-esbuild");
var fs_1 = require("fs");
var path = require("path");
var vite_1 = require("vite");
var vite_plugin_svgr_1 = require("vite-plugin-svgr");
var vite_tsconfig_paths_1 = require("vite-tsconfig-paths");
exports.default = (function (_a) {
    var mode = _a.mode;
    var envDir = './env';
    var env = (0, vite_1.loadEnv)(mode, path.join(process.cwd(), envDir), '');
    var plugins = [(0, plugin_react_1.default)(), (0, vite_tsconfig_paths_1.default)(), (0, vite_plugin_svgr_1.default)()];
    var shouldUploadSentrySourceMaps = Boolean(env.SENTRY_AUTH_TOKEN) && Boolean(env.SENTRY_ORG) && Boolean(env.SENTRY_PROJECT);
    console.log(shouldUploadSentrySourceMaps ? 'Configuring SentryVitePlugin' : 'skipping SentryVitePlugin');
    if (shouldUploadSentrySourceMaps) {
        plugins.push((0, vite_plugin_1.sentryVitePlugin)({
            authToken: env.SENTRY_AUTH_TOKEN,
            org: env.SENTRY_ORG,
            project: env.SENTRY_PROJECT,
            sourcemaps: {
                assets: ['./build/**/*'],
            },
        }));
    }
    var tlsCertExists = (0, fs_1.existsSync)(path.join(process.cwd(), envDir, 'cert.pem'));
    var tlsKeyExists = (0, fs_1.existsSync)(path.join(process.cwd(), envDir, 'key.pem'));
    if (tlsCertExists && tlsKeyExists) {
        console.log("Found TLS certificate and key, serving in ".concat(mode, " over HTTPS"));
    }
    else if (tlsCertExists && !tlsKeyExists) {
        console.error("Found TLS certificate but private key is missing, serving in ".concat(mode, " over HTTP"));
    }
    else if (!tlsCertExists && tlsKeyExists) {
        console.error("Found TLS private key but certificate is missing, serving in ".concat(mode, " over HTTP"));
    }
    return (0, vite_1.defineConfig)({
        envDir: envDir,
        publicDir: 'public',
        plugins: plugins,
        server: {
            open: !process.env.VITE_NO_OPEN,
            host: '0.0.0.0',
            port: env.PORT ? parseInt(env.PORT) : undefined,
            https: tlsCertExists && tlsKeyExists
                ? {
                    cert: './env/cert.pem',
                    key: './env/key.pem',
                }
                : undefined,
        },
        build: {
            outDir: './build',
            target: (0, browserslist_to_esbuild_1.default)(),
            sourcemap: true,
        },
        resolve: {
            alias: {
                '@ehrTheme': path.resolve(__dirname, env.THEME_PATH || 'src/themes/ottehr'),
                '@ehrDefaultTheme': path.resolve(__dirname, 'src/themes/ottehr'),
            },
        },
    });
});
//# sourceMappingURL=vite.config.js.map