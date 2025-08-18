"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiChatHistory = void 0;
var icons_1 = require("@ehrTheme/icons");
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var react_1 = require("react");
var MESSAGES_CONTAINER_ID = 'messages-container';
var AiChatHistory = function (_a) {
    var questionnaireResponse = _a.questionnaireResponse, unprocessedUserAnswer = _a.unprocessedUserAnswer, aiLoading = _a.aiLoading, scrollToBottomOnUpdate = _a.scrollToBottomOnUpdate;
    var messages = createMessages(questionnaireResponse);
    if (aiLoading) {
        if (unprocessedUserAnswer != null) {
            messages.push({
                linkId: '1000000',
                author: 'user',
                text: unprocessedUserAnswer,
            });
        }
        messages.push({
            linkId: '1000001',
            author: 'ai',
            text: '...',
        });
    }
    var bottomRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        var _a;
        if (scrollToBottomOnUpdate === true) {
            (_a = bottomRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: 'smooth' });
        }
    });
    return (<system_1.Box id={MESSAGES_CONTAINER_ID}>
      {messages.map(function (message) { return (<system_1.Box key={message.author + ':' + message.linkId} style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: message.author === 'ai' ? 'flex-start' : 'flex-end',
                marginBottom: message.author === 'ai' ? '10px' : '18px',
            }}>
          {message.author === 'ai' && <img src={icons_1.ottehrDarkBlue} style={{ width: '24px', marginRight: '10px' }}/>}
          <material_1.Typography variant="body1" key={message.linkId + '-' + message.author} style={{
                background: message.author === 'user' ? 'rgba(244, 246, 248, 1)' : 'none',
                borderRadius: '4px',
                padding: '8px',
                paddingTop: message.author === 'ai' ? '0' : '8px',
                paddingLeft: message.author === 'ai' ? '0' : '8px',
                width: 'fit-content',
            }}>
            {message.text}
          </material_1.Typography>
          {message.author === 'user' && <material_1.Avatar style={{ width: '24px', height: '24px', marginLeft: '10px' }}/>}
        </system_1.Box>); })}
      <div ref={bottomRef}/>
    </system_1.Box>);
};
exports.AiChatHistory = AiChatHistory;
function createMessages(questionnaireResponse) {
    var _a, _b, _c, _d;
    if (questionnaireResponse == null) {
        return [];
    }
    var questionnaire = (_a = questionnaireResponse.contained) === null || _a === void 0 ? void 0 : _a[0];
    return ((_d = (_c = (_b = questionnaire.item) === null || _b === void 0 ? void 0 : _b.sort(function (itemA, itemB) { return parseInt(itemA.linkId) - parseInt(itemB.linkId); })) === null || _c === void 0 ? void 0 : _c.flatMap(function (questionItem) {
        var _a, _b, _c, _d, _e, _f, _g;
        var answerItem = (_a = questionnaireResponse.item) === null || _a === void 0 ? void 0 : _a.find(function (answerItem) { return answerItem.linkId === questionItem.linkId; });
        if (questionItem.linkId == '0') {
            return [];
        }
        var result = [{ linkId: questionItem.linkId, author: 'ai', text: (_b = questionItem.text) !== null && _b !== void 0 ? _b : '' }];
        var answerText = (_d = (_c = answerItem === null || answerItem === void 0 ? void 0 : answerItem.answer) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.valueString;
        if (answerText != null) {
            result.push({
                linkId: questionItem.linkId,
                author: 'user',
                text: (_g = (_f = (_e = answerItem === null || answerItem === void 0 ? void 0 : answerItem.answer) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.valueString) !== null && _g !== void 0 ? _g : '',
            });
        }
        return result;
    })) !== null && _d !== void 0 ? _d : []);
}
//# sourceMappingURL=AiChatHistory.js.map