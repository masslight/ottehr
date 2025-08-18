"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustTopForBannerHeight = exports.BANNER_HEIGHT = void 0;
// This functionality is to ensure that sticky elements stick to the correct top when the banner is enabled
exports.BANNER_HEIGHT = 60;
var adjustTopForBannerHeight = function (top) {
    return import.meta.env.VITE_APP_ENV !== 'production' ? top + exports.BANNER_HEIGHT : top;
};
exports.adjustTopForBannerHeight = adjustTopForBannerHeight;
//# sourceMappingURL=misc.helper.js.map