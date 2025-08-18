"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamReviewComment = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var ExamReviewComment = function (props) {
    var item = props.item;
    if (!item.note) {
        return null;
    }
    return <material_1.Typography fontWeight={500}>{item.note}</material_1.Typography>;
};
exports.ExamReviewComment = ExamReviewComment;
//# sourceMappingURL=ExamReviewComment.js.map