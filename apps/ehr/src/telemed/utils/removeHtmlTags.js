"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeHtmlTags = removeHtmlTags;
function removeHtmlTags(input) {
    // Replace any HTML tags with an empty string
    return input.replace(/<\/?[^>]+(>|$)/g, '');
}
//# sourceMappingURL=removeHtmlTags.js.map