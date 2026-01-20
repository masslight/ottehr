"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ICON_STYLE = exports.PDF_CLIENT_STYLES = exports.STANDARD_NEW_LINE = exports.STANDARD_FONT_SPACING = exports.HEADER_FONT_SIZE = exports.SUB_HEADER_FONT_SIZE = exports.STANDARD_FONT_SIZE = exports.Y_POS_GAP = void 0;
var pdf_lib_1 = require("pdf-lib");
exports.Y_POS_GAP = 30;
exports.STANDARD_FONT_SIZE = 12;
exports.SUB_HEADER_FONT_SIZE = 10;
exports.HEADER_FONT_SIZE = 17;
exports.STANDARD_FONT_SPACING = 12;
exports.STANDARD_NEW_LINE = 17;
exports.PDF_CLIENT_STYLES = {
    initialPage: {
        width: pdf_lib_1.PageSizes.A4[0],
        height: pdf_lib_1.PageSizes.A4[1],
        pageMargins: {
            left: 40,
            top: 40,
            right: 40,
            bottom: 40,
        },
    },
};
exports.ICON_STYLE = {
    width: 10,
    height: 10,
};
