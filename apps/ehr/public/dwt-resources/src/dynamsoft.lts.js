/*! 20250428 - 20250310161029
* Dynamsoft JavaScript Library
* Product: Dynamic Web TWAIN
* Web Site: https://www.dynamsoft.com
* 
* Copyright 2025, Dynamsoft Corporation
* Author: Dynamsoft Support Team
* Version: 19.2
*/
(function(D){
!function(a){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=a();else if("function"==typeof define&&define.amd&&0)define([],a);else{var b;b="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,b.localforage=a()}}(function(){return function a(b,c,d){function e(g,h){if(!c[g]){if(!b[g]){var i="function"==typeof require&&require;if(!h&&i)return i(g,!0);if(f)return f(g,!0);var j=new Error("Cannot find module '"+g+"'");throw j.code="MODULE_NOT_FOUND",j}var k=c[g]={exports:{}};b[g][0].call(k.exports,function(a){var c=b[g][1][a];return e(c||a)},k,k.exports,a,b,c,d)}return c[g].exports}for(var f="function"==typeof require&&require,g=0;g<d.length;g++)e(d[g]);return e}({1:[function(a,b,c){(function(a){"use strict";function c(){k=!0;for(var a,b,c=l.length;c;){for(b=l,l=[],a=-1;++a<c;)b[a]();c=l.length}k=!1}function d(a){1!==l.push(a)||k||e()}var e,f=a.MutationObserver||a.WebKitMutationObserver;if(f){var g=0,h=new f(c),i=a.document.createTextNode("");h.observe(i,{characterData:!0}),e=function(){i.data=g=++g%2}}else if(a.setImmediate||void 0===a.MessageChannel)e="document"in a&&"onreadystatechange"in a.document.createElement("script")?function(){var b=a.document.createElement("script");b.onreadystatechange=function(){c(),b.onreadystatechange=null,b.parentNode.removeChild(b),b=null},a.document.documentElement.appendChild(b)}:function(){setTimeout(c,0)};else{var j=new a.MessageChannel;j.port1.onmessage=c,e=function(){j.port2.postMessage(0)}}var k,l=[];b.exports=d}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}],2:[function(a,b,c){"use strict";function d(){}function e(a){if("function"!=typeof a)throw new TypeError("resolver must be a function");this.state=s,this.queue=[],this.outcome=void 0,a!==d&&i(this,a)}function f(a,b,c){this.promise=a,"function"==typeof b&&(this.onFulfilled=b,this.callFulfilled=this.otherCallFulfilled),"function"==typeof c&&(this.onRejected=c,this.callRejected=this.otherCallRejected)}function g(a,b,c){o(function(){var d;try{d=b(c)}catch(b){return p.reject(a,b)}d===a?p.reject(a,new TypeError("Cannot resolve promise with itself")):p.resolve(a,d)})}function h(a){var b=a&&a.then;if(a&&("object"==typeof a||"function"==typeof a)&&"function"==typeof b)return function(){b.apply(a,arguments)}}function i(a,b){function c(b){f||(f=!0,p.reject(a,b))}function d(b){f||(f=!0,p.resolve(a,b))}function e(){b(d,c)}var f=!1,g=j(e);"error"===g.status&&c(g.value)}function j(a,b){var c={};try{c.value=a(b),c.status="success"}catch(a){c.status="error",c.value=a}return c}function k(a){return a instanceof this?a:p.resolve(new this(d),a)}function l(a){var b=new this(d);return p.reject(b,a)}function m(a){function b(a,b){function d(a){g[b]=a,++h!==e||f||(f=!0,p.resolve(j,g))}c.resolve(a).then(d,function(a){f||(f=!0,p.reject(j,a))})}var c=this;if("[object Array]"!==Object.prototype.toString.call(a))return this.reject(new TypeError("must be an array"));var e=a.length,f=!1;if(!e)return this.resolve([]);for(var g=new Array(e),h=0,i=-1,j=new this(d);++i<e;)b(a[i],i);return j}function n(a){function b(a){c.resolve(a).then(function(a){f||(f=!0,p.resolve(h,a))},function(a){f||(f=!0,p.reject(h,a))})}var c=this;if("[object Array]"!==Object.prototype.toString.call(a))return this.reject(new TypeError("must be an array"));var e=a.length,f=!1;if(!e)return this.resolve([]);for(var g=-1,h=new this(d);++g<e;)b(a[g]);return h}var o=a(1),p={},q=["REJECTED"],r=["FULFILLED"],s=["PENDING"];b.exports=e,e.prototype['catch']=function(a){return this.then(null,a)},e.prototype.then=function(a,b){if("function"!=typeof a&&this.state===r||"function"!=typeof b&&this.state===q)return this;var c=new this.constructor(d);if(this.state!==s){g(c,this.state===r?a:b,this.outcome)}else this.queue.push(new f(c,a,b));return c},f.prototype.callFulfilled=function(a){p.resolve(this.promise,a)},f.prototype.otherCallFulfilled=function(a){g(this.promise,this.onFulfilled,a)},f.prototype.callRejected=function(a){p.reject(this.promise,a)},f.prototype.otherCallRejected=function(a){g(this.promise,this.onRejected,a)},p.resolve=function(a,b){var c=j(h,b);if("error"===c.status)return p.reject(a,c.value);var d=c.value;if(d)i(a,d);else{a.state=r,a.outcome=b;for(var e=-1,f=a.queue.length;++e<f;)a.queue[e].callFulfilled(b)}return a},p.reject=function(a,b){a.state=q,a.outcome=b;for(var c=-1,d=a.queue.length;++c<d;)a.queue[c].callRejected(b);return a},e.resolve=k,e.reject=l,e.all=m,e.race=n},{1:1}],3:[function(a,b,c){(function(b){"use strict";"function"!=typeof b.Promise&&(b.Promise=a(2))}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{2:2}],4:[function(a,b,c){"use strict";function d(a,b){if(!(a instanceof b))throw new TypeError("Cannot call a class as a function")}function e(){try{if("undefined"!=typeof indexedDB)return indexedDB;if("undefined"!=typeof webkitIndexedDB)return webkitIndexedDB;if("undefined"!=typeof mozIndexedDB)return mozIndexedDB;if("undefined"!=typeof OIndexedDB)return OIndexedDB;if("undefined"!=typeof msIndexedDB)return msIndexedDB}catch(a){return}}function f(){try{if(!ua)return!1;var a=1,b="function"==typeof fetch&&-1!==fetch.toString().indexOf("[native code");if(!b)a="undefined"!=typeof openDatabase&&/(Safari|iPhone|iPad|iPod)/.test(navigator.userAgent)&&!/Chrome/.test(navigator.userAgent)&&!/BlackBerry/.test(navigator.platform);return(b||!a)&&"undefined"!=typeof indexedDB&&"undefined"!=typeof IDBKeyRange}catch(a){return!1}}function g(a,b){a=a||[],b=b||{};try{return new Blob(a,b)}catch(f){if("TypeError"!==f.name)throw f;for(var c="undefined"!=typeof BlobBuilder?BlobBuilder:"undefined"!=typeof MSBlobBuilder?MSBlobBuilder:"undefined"!=typeof MozBlobBuilder?MozBlobBuilder:WebKitBlobBuilder,d=new c,e=0;e<a.length;e+=1)d.append(a[e]);return d.getBlob(b.type)}}function h(a,b){b&&a.then(function(a){b(null,a)},function(a){b(a)})}function i(a,b,c){"function"==typeof b&&a.then(b),"function"==typeof c&&a['catch'](c)}function j(a){return"string"!=typeof a&&(console.warn(a+" used as a key, but it is not a string."),a=String(a)),a}function k(){if(arguments.length&&"function"==typeof arguments[arguments.length-1])return arguments[arguments.length-1]}function l(a){for(var b=a.length,c=new ArrayBuffer(b),d=new Uint8Array(c),e=0;e<b;e++)d[e]=a.charCodeAt(e);return c}function m(a){return new va(function(b){var c=a.transaction(wa,Ba),d=g([""]);c.objectStore(wa).put(d,"key"),c.onabort=function(a){a.preventDefault(),a.stopPropagation(),b(!1)},c.oncomplete=function(){var _h=navigator.userAgentData,a=!0,c=!1;if(_h){c=!0;}else{a=navigator.userAgent.match(/Chrome\/(\d+)/),c=navigator.userAgent.match(/Edge\//);}b(c||!a||parseInt(a[1],10)>=43)}})['catch'](function(){return!1})}function n(a){return"boolean"==typeof xa?va.resolve(xa):m(a).then(function(a){return xa=a})}function o(a){var b=ya[a.name],c={};c.promise=new va(function(a,b){c.resolve=a,c.reject=b}),b.deferredOperations.push(c),b.dbReady?b.dbReady=b.dbReady.then(function(){return c.promise}):b.dbReady=c.promise}function p(a){var b=ya[a.name],c=b.deferredOperations.pop();if(c)return c.resolve(),c.promise}function q(a,b){var c=ya[a.name],d=c.deferredOperations.pop();if(d)return d.reject(b),d.promise}function r(a,b){return new va(function(c,d){if(ya[a.name]=ya[a.name]||B(),a.db){if(!b)return c(a.db);o(a),a.db.close()}var e=[a.name];b&&e.push(a.version);var f=ua.open.apply(ua,e);b&&(f.onupgradeneeded=function(b){var c=f.result;try{c.createObjectStore(a.storeName),b.oldVersion<=1&&c.createObjectStore(wa)}catch(c){if("ConstraintError"!==c.name)throw c;console.warn('The database "'+a.name+'" has been upgraded from version '+b.oldVersion+" to version "+b.newVersion+', but the storage "'+a.storeName+'" already exists.')}}),f.onerror=function(a){a.preventDefault(),d(f.error)},f.onsuccess=function(){c(f.result),p(a)}})}function s(a){return r(a,!1)}function t(a){return r(a,!0)}function u(a,b){if(!a.db)return!0;var c=!a.db.objectStoreNames.contains(a.storeName),d=a.version<a.db.version,e=a.version>a.db.version;if(d&&(a.version!==b&&console.warn('The database "'+a.name+"\" can't be downgraded from version "+a.db.version+" to version "+a.version+"."),a.version=a.db.version),e||c){if(c){var f=a.db.version+1;f>a.version&&(a.version=f)}return!0}return!1}function v(a){return new va(function(b,c){var d=new FileReader;d.onerror=c,d.onloadend=function(c){var d=btoa(c.target.result||"");b({__local_forage_encoded_blob:!0,data:d,type:a.type})},d.readAsBinaryString(a)})}function w(a){return g([l(atob(a.data))],{type:a.type})}function x(a){return a&&a.__local_forage_encoded_blob}function y(a){var b=this,c=b._initReady().then(function(){var a=ya[b._dbInfo.name];if(a&&a.dbReady)return a.dbReady});return i(c,a,a),c}function z(a){o(a);for(var b=ya[a.name],c=b.forages,d=0;d<c.length;d++){var e=c[d];e._dbInfo.db&&(e._dbInfo.db.close(),e._dbInfo.db=null)}return a.db=null,s(a).then(function(b){return a.db=b,u(a)?t(a):b}).then(function(d){a.db=b.db=d;for(var e=0;e<c.length;e++)c[e]._dbInfo.db=d})['catch'](function(b){throw q(a,b),b})}function A(a,b,c,d){void 0===d&&(d=1);try{var e=a.db.transaction(a.storeName,b);c(null,e)}catch(e){if(d>0&&(!a.db||"InvalidStateError"===e.name||"NotFoundError"===e.name))return va.resolve().then(function(){if(!a.db||"NotFoundError"===e.name&&!a.db.objectStoreNames.contains(a.storeName)&&a.version<=a.db.version)return a.db&&(a.version=a.db.version+1),t(a)}).then(function(){return z(a).then(function(){A(a,b,c,d-1)})})['catch'](c);c(e)}}function B(){return{forages:[],db:null,dbReady:null,deferredOperations:[]}}function C(a){function b(){return va.resolve()}var c=this,d={db:null};if(a)for(var e in a)d[e]=a[e];var f=ya[d.name];f||(f=B(),ya[d.name]=f),f.forages.push(c),c._initReady||(c._initReady=c.ready,c.ready=y);for(var g=[],h=0;h<f.forages.length;h++){var i=f.forages[h];i!==c&&g.push(i._initReady()['catch'](b))}var j=f.forages.slice(0);return va.all(g).then(function(){return d.db=f.db,s(d)}).then(function(a){return d.db=a,u(d,c._defaultConfig.version)?t(d):a}).then(function(a){d.db=f.db=a,c._dbInfo=d;for(var b=0;b<j.length;b++){var e=j[b];e!==c&&(e._dbInfo.db=d.db,e._dbInfo.version=d.version)}})}function D(a,b){var c=this;a=j(a);var d=new va(function(b,d){c.ready().then(function(){A(c._dbInfo,Aa,function(e,f){if(e)return d(e);try{var g=f.objectStore(c._dbInfo.storeName),h=g.get(a);h.onsuccess=function(){var a=h.result;void 0===a&&(a=null),x(a)&&(a=w(a)),b(a)},h.onerror=function(){d(h.error)}}catch(a){d(a)}})})['catch'](d)});return h(d,b),d}function E(a,b){var c=this,d=new va(function(b,d){c.ready().then(function(){A(c._dbInfo,Aa,function(e,f){if(e)return d(e);try{var g=f.objectStore(c._dbInfo.storeName),h=g.openCursor(),i=1;h.onsuccess=function(){var c=h.result;if(c){var d=c.value;x(d)&&(d=w(d));var e=a(d,c.key,i++);void 0!==e?b(e):c['continue']()}else b()},h.onerror=function(){d(h.error)}}catch(a){d(a)}})})['catch'](d)});return h(d,b),d}function F(a,b,c){var d=this;a=j(a);var e=new va(function(c,e){var f;d.ready().then(function(){return f=d._dbInfo,"[object Blob]"===za.call(b)?n(f.db).then(function(a){return a?b:v(b)}):b}).then(function(b){A(d._dbInfo,Ba,function(f,g){if(f)return e(f);try{var h=g.objectStore(d._dbInfo.storeName);null===b&&(b=void 0);var i=h.put(b,a);g.oncomplete=function(){void 0===b&&(b=null),c(b)},g.onabort=g.onerror=function(){var a=i.error?i.error:i.transaction.error;e(a)}}catch(a){e(a)}})})['catch'](e)});return h(e,c),e}function G(a,b){var c=this;a=j(a);var d=new va(function(b,d){c.ready().then(function(){A(c._dbInfo,Ba,function(e,f){if(e)return d(e);try{var g=f.objectStore(c._dbInfo.storeName),h=g['delete'](a);f.oncomplete=function(){b()},f.onerror=function(){d(h.error)},f.onabort=function(){var a=h.error?h.error:h.transaction.error;d(a)}}catch(a){d(a)}})})['catch'](d)});return h(d,b),d}function H(a){var b=this,c=new va(function(a,c){b.ready().then(function(){A(b._dbInfo,Ba,function(d,e){if(d)return c(d);try{var f=e.objectStore(b._dbInfo.storeName),g=f.clear();e.oncomplete=function(){a()},e.onabort=e.onerror=function(){var a=g.error?g.error:g.transaction.error;c(a)}}catch(a){c(a)}})})['catch'](c)});return h(c,a),c}function I(a){var b=this,c=new va(function(a,c){b.ready().then(function(){A(b._dbInfo,Aa,function(d,e){if(d)return c(d);try{var f=e.objectStore(b._dbInfo.storeName),g=f.count();g.onsuccess=function(){a(g.result)},g.onerror=function(){c(g.error)}}catch(a){c(a)}})})['catch'](c)});return h(c,a),c}function J(a,b){var c=this,d=new va(function(b,d){if(a<0)return void b(null);c.ready().then(function(){A(c._dbInfo,Aa,function(e,f){if(e)return d(e);try{var g=f.objectStore(c._dbInfo.storeName),h=!1,i=g.openCursor();i.onsuccess=function(){var c=i.result;if(!c)return void b(null);0===a?b(c.key):h?b(c.key):(h=!0,c.advance(a))},i.onerror=function(){d(i.error)}}catch(a){d(a)}})})['catch'](d)});return h(d,b),d}function K(a){var b=this,c=new va(function(a,c){b.ready().then(function(){A(b._dbInfo,Aa,function(d,e){if(d)return c(d);try{var f=e.objectStore(b._dbInfo.storeName),g=f.openCursor(),h=[];g.onsuccess=function(){var b=g.result;if(!b)return void a(h);h.push(b.key),b['continue']()},g.onerror=function(){c(g.error)}}catch(a){c(a)}})})['catch'](c)});return h(c,a),c}function L(a,b){b=k.apply(this,arguments);var c=this.config();a="function"!=typeof a&&a||{},a.name||(a.name=a.name||c.name,a.storeName=a.storeName||c.storeName);var d,e=this;if(a.name){var f=a.name===c.name&&e._dbInfo.db,g=f?va.resolve(e._dbInfo.db):s(a).then(function(b){var c=ya[a.name],d=c.forages;c.db=b;for(var e=0;e<d.length;e++)d[e]._dbInfo.db=b;return b});d=a.storeName?g.then(function(b){if(b.objectStoreNames.contains(a.storeName)){var c=b.version+1;o(a);var d=ya[a.name],e=d.forages;b.close();for(var f=0;f<e.length;f++){var g=e[f];g._dbInfo.db=null,g._dbInfo.version=c}return new va(function(b,d){var e=ua.open(a.name,c);e.onerror=function(a){e.result.close(),d(a)},e.onupgradeneeded=function(){e.result.deleteObjectStore(a.storeName)},e.onsuccess=function(){var a=e.result;a.close(),b(a)}}).then(function(a){d.db=a;for(var b=0;b<e.length;b++){var c=e[b];c._dbInfo.db=a,p(c._dbInfo)}})['catch'](function(b){throw(q(a,b)||va.resolve())['catch'](function(){}),b})}}):g.then(function(b){o(a);var c=ya[a.name],d=c.forages;b.close();for(var e=0;e<d.length;e++){d[e]._dbInfo.db=null}return new va(function(b,c){var d=ua.deleteDatabase(a.name);d.onerror=d.onblocked=function(a){var b=d.result;b&&b.close(),c(a)},d.onsuccess=function(){var a=d.result;a&&a.close(),b(a)}}).then(function(a){c.db=a;for(var b=0;b<d.length;b++)p(d[b]._dbInfo)})['catch'](function(b){throw(q(a,b)||va.resolve())['catch'](function(){}),b})})}else d=va.reject("Invalid arguments");return h(d,b),d}function M(){return"function"==typeof openDatabase}function N(a){var b,c,d,e,f,g=.75*a.length,h=a.length,i=0;"="===a[a.length-1]&&(g--,"="===a[a.length-2]&&g--);var j=new ArrayBuffer(g),k=new Uint8Array(j);for(b=0;b<h;b+=4)c=Da.indexOf(a[b]),d=Da.indexOf(a[b+1]),e=Da.indexOf(a[b+2]),f=Da.indexOf(a[b+3]),k[i++]=c<<2|d>>4,k[i++]=(15&d)<<4|e>>2,k[i++]=(3&e)<<6|63&f;return j}function O(a){var b,c=new Uint8Array(a),d="";for(b=0;b<c.length;b+=3)d+=Da[c[b]>>2],d+=Da[(3&c[b])<<4|c[b+1]>>4],d+=Da[(15&c[b+1])<<2|c[b+2]>>6],d+=Da[63&c[b+2]];return c.length%3==2?d=d.substring(0,d.length-1)+"=":c.length%3==1&&(d=d.substring(0,d.length-2)+"=="),d}function P(a,b){var c="";if(a&&(c=Ua.call(a)),a&&("[object ArrayBuffer]"===c||a.buffer&&"[object ArrayBuffer]"===Ua.call(a.buffer))){var d,e=Ga;a instanceof ArrayBuffer?(d=a,e+=Ia):(d=a.buffer,"[object Int8Array]"===c?e+=Ka:"[object Uint8Array]"===c?e+=La:"[object Uint8ClampedArray]"===c?e+=Ma:"[object Int16Array]"===c?e+=Na:"[object Uint16Array]"===c?e+=Pa:"[object Int32Array]"===c?e+=Oa:"[object Uint32Array]"===c?e+=Qa:"[object Float32Array]"===c?e+=Ra:"[object Float64Array]"===c?e+=Sa:b(new Error("Failed to get type for BinaryArray"))),b(e+O(d))}else if("[object Blob]"===c){var f=new FileReader;f.onload=function(){var c=Ea+a.type+"~"+O(this.result);b(Ga+Ja+c)},f.readAsArrayBuffer(a)}else try{b(JSON.stringify(a))}catch(c){console.error("Couldn't convert value into a JSON string: ",a),b(null,c)}}function Q(a){if(a.substring(0,Ha)!==Ga)return JSON.parse(a);var b,c=a.substring(Ta),d=a.substring(Ha,Ta);if(d===Ja&&Fa.test(c)){var e=c.match(Fa);b=e[1],c=c.substring(e[0].length)}var f=N(c);switch(d){case Ia:return f;case Ja:return g([f],{type:b});case Ka:return new Int8Array(f);case La:return new Uint8Array(f);case Ma:return new Uint8ClampedArray(f);case Na:return new Int16Array(f);case Pa:return new Uint16Array(f);case Oa:return new Int32Array(f);case Qa:return new Uint32Array(f);case Ra:return new Float32Array(f);case Sa:return new Float64Array(f);default:throw new Error("Unkown type: "+d)}}function R(a,b,c,d){a.executeSql("CREATE TABLE IF NOT EXISTS "+b.storeName+" (id INTEGER PRIMARY KEY, key unique, value)",[],c,d)}function S(a){var b=this,c={db:null};if(a)for(var d in a)c[d]="string"!=typeof a[d]?a[d].toString():a[d];var e=new va(function(a,d){try{c.db=openDatabase(c.name,String(c.version),c.description,c.size)}catch(a){return d(a)}c.db.transaction(function(e){R(e,c,function(){b._dbInfo=c,a()},function(a,b){d(b)})},d)});return c.serializer=Va,e}function T(a,b,c,d,e,f){a.executeSql(c,d,e,function(a,g){g.code===g.SYNTAX_ERR?a.executeSql("SELECT name FROM sqlite_master WHERE type='table' AND name = ?",[b.storeName],function(a,h){h.rows.length?f(a,g):R(a,b,function(){a.executeSql(c,d,e,f)},f)},f):f(a,g)},f)}function U(a,b){var c=this;a=j(a);var d=new va(function(b,d){c.ready().then(function(){var e=c._dbInfo;e.db.transaction(function(c){T(c,e,"SELECT * FROM "+e.storeName+" WHERE key = ? LIMIT 1",[a],function(a,c){var d=c.rows.length?c.rows.item(0).value:null;d&&(d=e.serializer.deserialize(d)),b(d)},function(a,b){d(b)})})})['catch'](d)});return h(d,b),d}function V(a,b){var c=this,d=new va(function(b,d){c.ready().then(function(){var e=c._dbInfo;e.db.transaction(function(c){T(c,e,"SELECT * FROM "+e.storeName,[],function(c,d){for(var f=d.rows,g=f.length,h=0;h<g;h++){var i=f.item(h),j=i.value;if(j&&(j=e.serializer.deserialize(j)),void 0!==(j=a(j,i.key,h+1)))return void b(j)}b()},function(a,b){d(b)})})})['catch'](d)});return h(d,b),d}function W(a,b,c,d){var e=this;a=j(a);var f=new va(function(f,g){e.ready().then(function(){void 0===b&&(b=null);var h=b,i=e._dbInfo;i.serializer.serialize(b,function(b,j){j?g(j):i.db.transaction(function(c){T(c,i,"INSERT OR REPLACE INTO "+i.storeName+" (key, value) VALUES (?, ?)",[a,b],function(){f(h)},function(a,b){g(b)})},function(b){if(b.code===b.QUOTA_ERR){if(d>0)return void f(W.apply(e,[a,h,c,d-1]));g(b)}})})})['catch'](g)});return h(f,c),f}function X(a,b,c){return W.apply(this,[a,b,c,1])}function Y(a,b){var c=this;a=j(a);var d=new va(function(b,d){c.ready().then(function(){var e=c._dbInfo;e.db.transaction(function(c){T(c,e,"DELETE FROM "+e.storeName+" WHERE key = ?",[a],function(){b()},function(a,b){d(b)})})})['catch'](d)});return h(d,b),d}function Z(a){var b=this,c=new va(function(a,c){b.ready().then(function(){var d=b._dbInfo;d.db.transaction(function(b){T(b,d,"DELETE FROM "+d.storeName,[],function(){a()},function(a,b){c(b)})})})['catch'](c)});return h(c,a),c}function $(a){var b=this,c=new va(function(a,c){b.ready().then(function(){var d=b._dbInfo;d.db.transaction(function(b){T(b,d,"SELECT COUNT(key) as c FROM "+d.storeName,[],function(b,c){var d=c.rows.item(0).c;a(d)},function(a,b){c(b)})})})['catch'](c)});return h(c,a),c}function _(a,b){var c=this,d=new va(function(b,d){c.ready().then(function(){var e=c._dbInfo;e.db.transaction(function(c){T(c,e,"SELECT key FROM "+e.storeName+" WHERE id = ? LIMIT 1",[a+1],function(a,c){var d=c.rows.length?c.rows.item(0).key:null;b(d)},function(a,b){d(b)})})})['catch'](d)});return h(d,b),d}function aa(a){var b=this,c=new va(function(a,c){b.ready().then(function(){var d=b._dbInfo;d.db.transaction(function(b){T(b,d,"SELECT key FROM "+d.storeName,[],function(b,c){for(var d=[],e=0;e<c.rows.length;e++)d.push(c.rows.item(e).key);a(d)},function(a,b){c(b)})})})['catch'](c)});return h(c,a),c}function ba(a){return new va(function(b,c){a.transaction(function(d){d.executeSql("SELECT name FROM sqlite_master WHERE type='table' AND name <> '__WebKitDatabaseInfoTable__'",[],function(c,d){for(var e=[],f=0;f<d.rows.length;f++)e.push(d.rows.item(f).name);b({db:a,storeNames:e})},function(a,b){c(b)})},function(a){c(a)})})}function ca(a,b){b=k.apply(this,arguments);var c=this.config();a="function"!=typeof a&&a||{},a.name||(a.name=a.name||c.name,a.storeName=a.storeName||c.storeName);var d,e=this;return d=a.name?new va(function(b){var d;d=a.name===c.name?e._dbInfo.db:openDatabase(a.name,"","",0),b(a.storeName?{db:d,storeNames:[a.storeName]}:ba(d))}).then(function(a){return new va(function(b,c){a.db.transaction(function(d){function e(a){return new va(function(b,c){d.executeSql("DROP TABLE IF EXISTS "+a,[],function(){b()},function(a,b){c(b)})})}for(var f=[],g=0,h=a.storeNames.length;g<h;g++)f.push(e(a.storeNames[g]));va.all(f).then(function(){b()})['catch'](function(a){c(a)})},function(a){c(a)})})}):va.reject("Invalid arguments"),h(d,b),d}function da(){try{return"undefined"!=typeof localStorage&&"setItem"in localStorage&&!!localStorage.setItem}catch(a){return!1}}function ea(a,b){var c=a.name+"/";return a.storeName!==b.storeName&&(c+=a.storeName+"/"),c}function fa(){var a="_localforage_support_test";try{return localStorage.setItem(a,!0),localStorage.removeItem(a),!1}catch(a){return!0}}function ga(){return!fa()||localStorage.length>0}function ha(a){var b=this,c={};if(a)for(var d in a)c[d]=a[d];return c.keyPrefix=ea(a,b._defaultConfig),ga()?(b._dbInfo=c,c.serializer=Va,va.resolve()):va.reject()}function ia(a){var b=this,c=b.ready().then(function(){for(var a=b._dbInfo.keyPrefix,c=localStorage.length-1;c>=0;c--){var d=localStorage.key(c);0===d.indexOf(a)&&localStorage.removeItem(d)}});return h(c,a),c}function ja(a,b){var c=this;a=j(a);var d=c.ready().then(function(){var b=c._dbInfo,d=localStorage.getItem(b.keyPrefix+a);return d&&(d=b.serializer.deserialize(d)),d});return h(d,b),d}function ka(a,b){var c=this,d=c.ready().then(function(){for(var b=c._dbInfo,d=b.keyPrefix,e=d.length,f=localStorage.length,g=1,h=0;h<f;h++){var i=localStorage.key(h);if(0===i.indexOf(d)){var j=localStorage.getItem(i);if(j&&(j=b.serializer.deserialize(j)),void 0!==(j=a(j,i.substring(e),g++)))return j}}});return h(d,b),d}function la(a,b){var c=this,d=c.ready().then(function(){var b,d=c._dbInfo;try{b=localStorage.key(a)}catch(a){b=null}return b&&(b=b.substring(d.keyPrefix.length)),b});return h(d,b),d}function ma(a){var b=this,c=b.ready().then(function(){for(var a=b._dbInfo,c=localStorage.length,d=[],e=0;e<c;e++){var f=localStorage.key(e);0===f.indexOf(a.keyPrefix)&&d.push(f.substring(a.keyPrefix.length))}return d});return h(c,a),c}function na(a){var b=this,c=b.keys().then(function(a){return a.length});return h(c,a),c}function oa(a,b){var c=this;a=j(a);var d=c.ready().then(function(){var b=c._dbInfo;localStorage.removeItem(b.keyPrefix+a)});return h(d,b),d}function pa(a,b,c){var d=this;a=j(a);var e=d.ready().then(function(){void 0===b&&(b=null);var c=b;return new va(function(e,f){var g=d._dbInfo;g.serializer.serialize(b,function(b,d){if(d)f(d);else try{localStorage.setItem(g.keyPrefix+a,b),e(c)}catch(a){"QuotaExceededError"!==a.name&&"NS_ERROR_DOM_QUOTA_REACHED"!==a.name||f(a),f(a)}})})});return h(e,c),e}function qa(a,b){if(b=k.apply(this,arguments),a="function"!=typeof a&&a||{},!a.name){var c=this.config();a.name=a.name||c.name,a.storeName=a.storeName||c.storeName}var d,e=this;return d=a.name?new va(function(b){b(a.storeName?ea(a,e._defaultConfig):a.name+"/")}).then(function(a){for(var b=localStorage.length-1;b>=0;b--){var c=localStorage.key(b);0===c.indexOf(a)&&localStorage.removeItem(c)}}):va.reject("Invalid arguments"),h(d,b),d}function ra(a,b){a[b]=function(){var c=arguments;return a.ready().then(function(){return a[b].apply(a,c)})}}function sa(){for(var a=1;a<arguments.length;a++){var b=arguments[a];if(b)for(var c in b)b.hasOwnProperty(c)&&($a(b[c])?arguments[0][c]=b[c].slice():arguments[0][c]=b[c])}return arguments[0]}var ta="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(a){return typeof a}:function(a){return a&&"function"==typeof Symbol&&a.constructor===Symbol&&a!==Symbol.prototype?"symbol":typeof a},ua=e();"undefined"==typeof Promise&&a(3);var va=Dynamsoft.Lib.Promise,wa="local-forage-detect-blob-support",xa=void 0,ya={},za=Object.prototype.toString,Aa="readonly",Ba="readwrite",Ca={_driver:"asyncStorage",_initStorage:C,_support:f(),iterate:E,getItem:D,setItem:F,removeItem:G,clear:H,length:I,key:J,keys:K,dropInstance:L},Da="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",Ea="~~local_forage_type~",Fa=/^~~local_forage_type~([^~]+)~/,Ga="__lfsc__:",Ha=Ga.length,Ia="arbf",Ja="blob",Ka="si08",La="ui08",Ma="uic8",Na="si16",Oa="si32",Pa="ur16",Qa="ui32",Ra="fl32",Sa="fl64",Ta=Ha+Ia.length,Ua=Object.prototype.toString,Va={serialize:P,deserialize:Q,stringToBuffer:N,bufferToString:O},Wa={_driver:"webSQLStorage",_initStorage:S,_support:M(),iterate:V,getItem:U,setItem:X,removeItem:Y,clear:Z,length:$,key:_,keys:aa,dropInstance:ca},Xa={_driver:"localStorageWrapper",_initStorage:ha,_support:da(),iterate:ka,getItem:ja,setItem:pa,removeItem:oa,clear:ia,length:na,key:la,keys:ma,dropInstance:qa},Ya=function(a,b){return a===b||"number"==typeof a&&"number"==typeof b&&isNaN(a)&&isNaN(b)},Za=function(a,b){for(var c=a.length,d=0;d<c;){if(Ya(a[d],b))return!0;d++}return!1},$a=Array.isArray||function(a){return"[object Array]"===Object.prototype.toString.call(a)},_a={},ab={},bb={INDEXEDDB:Ca,WEBSQL:Wa,LOCALSTORAGE:Xa},cb=[bb.INDEXEDDB._driver,bb.WEBSQL._driver,bb.LOCALSTORAGE._driver],db=["dropInstance"],eb=["clear","getItem","iterate","key","keys","length","removeItem","setItem"].concat(db),fb={description:"",driver:cb.slice(),name:"localforage",size:4980736,storeName:"keyvaluepairs",version:1},gb=function(){function a(b){d(this,a);for(var c in bb)if(bb.hasOwnProperty(c)){var e=bb[c],f=e._driver;this[c]=f,_a[f]||this.defineDriver(e)}this._defaultConfig=sa({},fb),this._config=sa({},this._defaultConfig,b),this._driverSet=null,this._initDriver=null,this._ready=!1,this._dbInfo=null,this._wrapLibraryMethodsWithReady(),this.setDriver(this._config.driver)['catch'](function(){})}return a.prototype.config=function(a){if("object"===(void 0===a?"undefined":ta(a))){if(this._ready)return new Error("Can't call config() after localforage has been used.");for(var b in a){if("storeName"===b&&(a[b]=a[b].replace(/\W/g,"_")),"version"===b&&"number"!=typeof a[b])return new Error("Database version must be a number.");this._config[b]=a[b]}return!("driver"in a&&a.driver)||this.setDriver(this._config.driver)}return"string"==typeof a?this._config[a]:this._config},a.prototype.defineDriver=function(q,b,c){var d=new va(function(b,c){try{var d=q._driver,e=new Error("Custom driver not compliant");if(!q._driver)return void c(e);for(var f=eb.concat("_initStorage"),g=0,i=f.length;g<i;g++){var j=f[g];if((!Za(db,j)||q[j])&&"function"!=typeof q[j])return void c(e)}(function(){for(var b=function(z){return function(){var b=new Error("Method "+z+" is not implemented by the current driver"),c=va.reject(b);return h(c,arguments[arguments.length-1]),c}},c=0,d=db.length;c<d;c++){var e=db[c];q[e]||(q[e]=b(e))}})();var k=function(c){_a[d]&&console.info("Redefining LocalForage driver: "+d),_a[d]=q,ab[d]=c,b()};"_support"in q?q._support&&"function"==typeof q._support?q._support().then(k,c):k(!!q._support):k(!0)}catch(z){c(z)}});return i(d,b,c),d},a.prototype.driver=function(){return this._driver||null},a.prototype.getDriver=function(a,b,c){var d=_a[a]?va.resolve(_a[a]):va.reject(new Error("Driver not found."));return i(d,b,c),d},a.prototype.getSerializer=function(a){var b=va.resolve(Va);return i(b,a),b},a.prototype.ready=function(a){var b=this,c=b._driverSet.then(function(){return null===b._ready&&(b._ready=b._initDriver()),b._ready});return i(c,a,a),c},a.prototype.setDriver=function(a,b,c){function d(){g._config.driver=g.driver()}function e(a){return g._extend(a),d(),g._ready=g._initStorage(g._config),g._ready}function f(a){return function(){function b(){for(;c<a.length;){var f=a[c];return c++,g._dbInfo=null,g._ready=null,g.getDriver(f).then(e)['catch'](b)}d();var h=new Error("No available storage method found.");return g._driverSet=va.reject(h),g._driverSet}var c=0;return b()}}var g=this;$a(a)||(a=[a]);var h=this._getSupportedDrivers(a),j=null!==this._driverSet?this._driverSet['catch'](function(){return va.resolve()}):va.resolve();return this._driverSet=j.then(function(){var a=h[0];return g._dbInfo=null,g._ready=null,g.getDriver(a).then(function(a){g._driver=a._driver,d(),g._wrapLibraryMethodsWithReady(),g._initDriver=f(h)})})['catch'](function(){d();var a=new Error("No available storage method found.");return g._driverSet=va.reject(a),g._driverSet}),i(this._driverSet,b,c),this._driverSet},a.prototype.supports=function(a){return!!ab[a]},a.prototype._extend=function(a){sa(this,a)},a.prototype._getSupportedDrivers=function(a){for(var b=[],c=0,d=a.length;c<d;c++){var e=a[c];this.supports(e)&&b.push(e)}return b},a.prototype._wrapLibraryMethodsWithReady=function(){for(var a=0,b=eb.length;a<b;a++)ra(this,eb[a])},a.prototype.createInstance=function(b){return new a(b)},a}(),hb=new gb;b.exports=hb},{3:3}]},{},[4])(4)});
D.Lib.localforage = localforage;})(Dynamsoft);"use strict";function _arrayLikeToArray(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=Array(t);r<t;r++)n[r]=e[r];return n}function _arrayWithHoles(e){if(Array.isArray(e))return e}function _arrayWithoutHoles(e){if(Array.isArray(e))return _arrayLikeToArray(e)}function asyncGeneratorStep(e,t,r,n,o,i,a){try{var s=e[i](a),c=s.value}catch(e){return void r(e)}s.done?t(c):Dynamsoft.Lib.Promise.resolve(c).then(n,o)}function _asyncToGenerator(e){return function(){var t=this,r=arguments;return new Dynamsoft.Lib.Promise((function(n,o){var i=e.apply(t,r);function a(e){asyncGeneratorStep(i,n,o,a,s,"next",e)}function s(e){asyncGeneratorStep(i,n,o,a,s,"throw",e)}a(void 0)}))}}function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function _defineProperties(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,_toPropertyKey(n.key),n)}}function _createClass(e,t,r){return t&&_defineProperties(e.prototype,t),r&&_defineProperties(e,r),Object.defineProperty(e,"prototype",{writable:!1}),e}function _createForOfIteratorHelper(e,t){var r="undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(!r){if(Array.isArray(e)||(r=_unsupportedIterableToArray(e))||t&&e&&"number"==typeof e.length){r&&(e=r);var n=0,o=function(){};return{s:o,n:function(){return n>=e.length?{done:!0}:{done:!1,value:e[n++]}},e:function(e){throw e},f:o}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}var i,a=!0,s=!1;return{s:function(){r=r.call(e)},n:function(){var e=r.next();return a=e.done,e},e:function(e){s=!0,i=e},f:function(){try{a||null==r["return"]||r["return"]()}finally{if(s)throw i}}}}function _iterableToArray(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}function _iterableToArrayLimit(e,t){var r=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null!=r){var n,o,i,a,s=[],c=!0,u=!1;try{if(i=(r=r.call(e)).next,0===t){if(Object(r)!==r)return;c=!1}else for(;!(c=(n=i.call(r)).done)&&(s.push(n.value),s.length!==t);c=!0);}catch(e){u=!0,o=e}finally{try{if(!c&&null!=r["return"]&&(a=r["return"](),Object(a)!==a))return}finally{if(u)throw o}}return s}}function _nonIterableRest(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function _nonIterableSpread(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function _regeneratorRuntime(){_regeneratorRuntime=function(){return t};var e,t={},r=Object.prototype,n=r.hasOwnProperty,o=Object.defineProperty||function(e,t,r){e[t]=r.value},i="function"==typeof Symbol?Symbol:{},a=i.iterator||"@@iterator",s=i.asyncIterator||"@@asyncIterator",c=i.toStringTag||"@@toStringTag";function u(e,t,r){return Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}),e[t]}try{u({},"")}catch(e){u=function(e,t,r){return e[t]=r}}function f(e,t,r,n){var i=t&&t.prototype instanceof y?t:y,a=Object.create(i.prototype),s=new A(n||[]);return o(a,"_invoke",{value:T(e,r,s)}),a}function l(e,t,r){try{return{type:"normal",arg:e.call(t,r)}}catch(e){return{type:"throw",arg:e}}}t.wrap=f;var h="suspendedStart",d="suspendedYield",p="executing",v="completed",m={};function y(){}function g(){}function b(){}var x={};u(x,a,(function(){return this}));var w=Object.getPrototypeOf,_=w&&w(w(L([])));_&&_!==r&&n.call(_,a)&&(x=_);var S=b.prototype=y.prototype=Object.create(x);function k(e){["next","throw","return"].forEach((function(t){u(e,t,(function(e){return this._invoke(t,e)}))}))}function C(e,t){function r(o,i,a,s){var c=l(e[o],e,i);if("throw"!==c.type){var u=c.arg,f=u.value;return f&&"object"==typeof f&&n.call(f,"__await")?t.resolve(f.__await).then((function(e){r("next",e,a,s)}),(function(e){r("throw",e,a,s)})):t.resolve(f).then((function(e){u.value=e,a(u)}),(function(e){return r("throw",e,a,s)}))}s(c.arg)}var i;o(this,"_invoke",{value:function(e,n){function o(){return new t((function(t,o){r(e,n,t,o)}))}return i=i?i.then(o,o):o()}})}function T(t,r,n){var o=h;return function(i,a){if(o===p)throw Error("Generator is already running");if(o===v){if("throw"===i)throw a;return{value:e,done:!0}}for(n.method=i,n.arg=a;;){var s=n.delegate;if(s){var c=E(s,n);if(c){if(c===m)continue;return c}}if("next"===n.method)n.sent=n._sent=n.arg;else if("throw"===n.method){if(o===h)throw o=v,n.arg;n.dispatchException(n.arg)}else"return"===n.method&&n.abrupt("return",n.arg);o=p;var u=l(t,r,n);if("normal"===u.type){if(o=n.done?v:d,u.arg===m)continue;return{value:u.arg,done:n.done}}"throw"===u.type&&(o=v,n.method="throw",n.arg=u.arg)}}}function E(t,r){var n=r.method,o=t.iterator[n];if(o===e)return r.delegate=null,"throw"===n&&t.iterator["return"]&&(r.method="return",r.arg=e,E(t,r),"throw"===r.method)||"return"!==n&&(r.method="throw",r.arg=new TypeError("The iterator does not provide a '"+n+"' method")),m;var i=l(o,t.iterator,r.arg);if("throw"===i.type)return r.method="throw",r.arg=i.arg,r.delegate=null,m;var a=i.arg;return a?a.done?(r[t.resultName]=a.value,r.next=t.nextLoc,"return"!==r.method&&(r.method="next",r.arg=e),r.delegate=null,m):a:(r.method="throw",r.arg=new TypeError("iterator result is not an object"),r.delegate=null,m)}function O(e){var t={tryLoc:e[0]};1 in e&&(t.catchLoc=e[1]),2 in e&&(t.finallyLoc=e[2],t.afterLoc=e[3]),this.tryEntries.push(t)}function I(e){var t=e.completion||{};t.type="normal",delete t.arg,e.completion=t}function A(e){this.tryEntries=[{tryLoc:"root"}],e.forEach(O,this),this.reset(!0)}function L(t){if(t||""===t){var r=t[a];if(r)return r.call(t);if("function"==typeof t.next)return t;if(!isNaN(t.length)){var o=-1,i=function r(){for(;++o<t.length;)if(n.call(t,o))return r.value=t[o],r.done=!1,r;return r.value=e,r.done=!0,r};return i.next=i}}throw new TypeError(typeof t+" is not iterable")}return g.prototype=b,o(S,"constructor",{value:b,configurable:!0}),o(b,"constructor",{value:g,configurable:!0}),g.displayName=u(b,c,"GeneratorFunction"),t.isGeneratorFunction=function(e){var t="function"==typeof e&&e.constructor;return!!t&&(t===g||"GeneratorFunction"===(t.displayName||t.name))},t.mark=function(e){return Object.setPrototypeOf?Object.setPrototypeOf(e,b):(e.__proto__=b,u(e,c,"GeneratorFunction")),e.prototype=Object.create(S),e},t.awrap=function(e){return{__await:e}},k(C.prototype),u(C.prototype,s,(function(){return this})),t.AsyncIterator=C,t.async=function(e,r,n,o,i){void 0===i&&(i=Promise);var a=new C(f(e,r,n,o),i);return t.isGeneratorFunction(r)?a:a.next().then((function(e){return e.done?e.value:a.next()}))},k(S),u(S,c,"Generator"),u(S,a,(function(){return this})),u(S,"toString",(function(){return"[object Generator]"})),t.keys=function(e){var t=Object(e),r=[];for(var n in t)r.push(n);return r.reverse(),function o(){for(;r.length;){var e=r.pop();if(e in t)return o.value=e,o.done=!1,o}return o.done=!0,o}},t.values=L,A.prototype={constructor:A,reset:function(t){if(this.prev=0,this.next=0,this.sent=this._sent=e,this.done=!1,this.delegate=null,this.method="next",this.arg=e,this.tryEntries.forEach(I),!t)for(var r in this)"t"===r.charAt(0)&&n.call(this,r)&&!isNaN(+r.slice(1))&&(this[r]=e)},stop:function(){this.done=!0;var e=this.tryEntries[0].completion;if("throw"===e.type)throw e.arg;return this.rval},dispatchException:function(t){if(this.done)throw t;var r=this;function o(n,o){return s.type="throw",s.arg=t,r.next=n,o&&(r.method="next",r.arg=e),!!o}for(var i=this.tryEntries.length-1;i>=0;--i){var a=this.tryEntries[i],s=a.completion;if("root"===a.tryLoc)return o("end");if(a.tryLoc<=this.prev){var c=n.call(a,"catchLoc"),u=n.call(a,"finallyLoc");if(c&&u){if(this.prev<a.catchLoc)return o(a.catchLoc,!0);if(this.prev<a.finallyLoc)return o(a.finallyLoc)}else if(c){if(this.prev<a.catchLoc)return o(a.catchLoc,!0)}else{if(!u)throw Error("try statement without catch or finally");if(this.prev<a.finallyLoc)return o(a.finallyLoc)}}}},abrupt:function(e,t){for(var r=this.tryEntries.length-1;r>=0;--r){var o=this.tryEntries[r];if(o.tryLoc<=this.prev&&n.call(o,"finallyLoc")&&this.prev<o.finallyLoc){var i=o;break}}i&&("break"===e||"continue"===e)&&i.tryLoc<=t&&t<=i.finallyLoc&&(i=null);var a=i?i.completion:{};return a.type=e,a.arg=t,i?(this.method="next",this.next=i.finallyLoc,m):this.complete(a)},complete:function(e,t){if("throw"===e.type)throw e.arg;return"break"===e.type||"continue"===e.type?this.next=e.arg:"return"===e.type?(this.rval=this.arg=e.arg,this.method="return",this.next="end"):"normal"===e.type&&t&&(this.next=t),m},finish:function(e){for(var t=this.tryEntries.length-1;t>=0;--t){var r=this.tryEntries[t];if(r.finallyLoc===e)return this.complete(r.completion,r.afterLoc),I(r),m}},"catch":function(e){for(var t=this.tryEntries.length-1;t>=0;--t){var r=this.tryEntries[t];if(r.tryLoc===e){var n=r.completion;if("throw"===n.type){var o=n.arg;I(r)}return o}}throw Error("illegal catch attempt")},delegateYield:function(t,r,n){return this.delegate={iterator:L(t),resultName:r,nextLoc:n},"next"===this.method&&(this.arg=e),m}},t}function _slicedToArray(e,t){return _arrayWithHoles(e)||_iterableToArrayLimit(e,t)||_unsupportedIterableToArray(e,t)||_nonIterableRest()}function _toConsumableArray(e){return _arrayWithoutHoles(e)||_iterableToArray(e)||_unsupportedIterableToArray(e)||_nonIterableSpread()}function _toPrimitive(e,t){if("object"!=typeof e||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,t||"default");if("object"!=typeof n)return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(e)}function _toPropertyKey(e){var t=_toPrimitive(e,"string");return"symbol"==typeof t?t:t+""}function _typeof(e){return _typeof="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},_typeof(e)}function _unsupportedIterableToArray(e,t){if(e){if("string"==typeof e)return _arrayLikeToArray(e,t);var r={}.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?_arrayLikeToArray(e,t):void 0}}!function(){var e,t,r,n,o,i="undefined"==typeof self,a=i?{}:self;"undefined"!=typeof navigator&&(e=navigator,t=e.userAgent,r=e.platform,n=e.mediaDevices),function(){if(!i){var n={Edge:{search:"Edg",verSearch:"Edg"},OPR:null,Chrome:null,Safari:{str:e.vendor,search:"Apple",verSearch:["Version","iPhone OS","CPU OS"]},Firefox:null,Explorer:{search:"MSIE",verSearch:"MSIE"}},a={HarmonyOS:null,Android:null,iPhone:null,iPad:null,Windows:{str:r,search:"Win"},Mac:{str:r},Linux:{str:r}},s="unknownBrowser",c=0,u="unknownOS";for(var f in n){var l=n[f]||{},h=l.str||t,d=l.search||f,p=l.verStr||t,v=l.verSearch||f;if(v instanceof Array||(v=[v]),-1!=h.indexOf(d)){s=f;var m,y=_createForOfIteratorHelper(v);try{for(y.s();!(m=y.n()).done;){var g=m.value,b=p.indexOf(g);if(-1!=b){c=parseFloat(p.substring(b+g.length+1));break}}}catch(k){y.e(k)}finally{y.f()}break}}for(var x in a){var w=a[x]||{},_=w.str||t,S=w.search||x;if(-1!=_.indexOf(S)){u=x;break}}"Linux"==u&&-1!=t.indexOf("Windows NT")&&(u="HarmonyOS"),o={browser:s,version:c,OS:u}}i&&(o={browser:"ssr",version:0,OS:"ssr"})}(),n&&n.getUserMedia;var s="Chrome"===o.browser&&o.version>66||"Safari"===o.browser&&o.version>13||"OPR"===o.browser&&o.version>43||"Edge"===o.browser&&o.version>15;var c=function(){try{if("undefined"!=typeof indexedDB)return indexedDB;if("undefined"!=typeof webkitIndexedDB)return webkitIndexedDB;if("undefined"!=typeof mozIndexedDB)return mozIndexedDB;if("undefined"!=typeof OIndexedDB)return OIndexedDB;if("undefined"!=typeof msIndexedDB)return msIndexedDB}catch(e){return}}();function u(e,t){e=e||[],t=t||{};try{return new Blob(e,t)}catch(o){if("TypeError"!==o.name)throw o;for(var r=new("undefined"!=typeof BlobBuilder?BlobBuilder:"undefined"!=typeof MSBlobBuilder?MSBlobBuilder:"undefined"!=typeof MozBlobBuilder?MozBlobBuilder:WebKitBlobBuilder),n=0;n<e.length;n+=1)r.append(e[n]);return r.getBlob(t.type)}}function f(e,t){t&&e.then((function(e){t(null,e)}),(function(e){t(e)}))}function l(e,t,r){"function"==typeof t&&e.then(t),"function"==typeof r&&e["catch"](r)}function h(e){return"string"!=typeof e&&(e=String(e)),e}function d(){if(arguments.length&&"function"==typeof arguments[arguments.length-1])return arguments[arguments.length-1]}var p,v="local-forage-detect-blob-support",m={},y=Object.prototype.toString,g="readonly",b="readwrite";function x(e){return"boolean"==typeof p?Dynamsoft.Lib.Promise.resolve(p):function(e){return new Dynamsoft.Lib.Promise((function(t){var r=e.transaction(v,b),n=u([""]);r.objectStore(v).put(n,"key"),r.onabort=function(e){e.preventDefault(),e.stopPropagation(),t(!1)},r.oncomplete=function(){var e=navigator.userAgent.match(/Chrome\/(\d+)/),r=navigator.userAgent.match(/Edge\//);t(r||!e||parseInt(e[1],10)>=43)}}))["catch"]((function(){return!1}))}(e).then((function(e){return p=e}))}function w(e){var t=m[e.name],r={};r.promise=new Dynamsoft.Lib.Promise((function(e,t){r.resolve=e,r.reject=t})),t.deferredOperations.push(r),t.dbReady?t.dbReady=t.dbReady.then((function(){return r.promise})):t.dbReady=r.promise}function _(e){var t=m[e.name].deferredOperations.pop();if(t)return t.resolve(),t.promise}function S(e,t){var r=m[e.name].deferredOperations.pop();if(r)return r.reject(t),r.promise}function k(e,t){return new Dynamsoft.Lib.Promise((function(r,n){if(m[e.name]=m[e.name]||{forages:[],db:null,dbReady:null,deferredOperations:[]},e.db){if(!t)return r(e.db);w(e),e.db.close()}var o=[e.name];t&&o.push(e.version);var i=c.open.apply(c,o);t&&(i.onupgradeneeded=function(t){var r=i.result;try{r.createObjectStore(e.storeName),t.oldVersion<=1&&r.createObjectStore(v)}catch(n){if("ConstraintError"!==n.name)throw n}}),i.onerror=function(e){e.preventDefault(),n(i.error)},i.onsuccess=function(){var t=i.result;t.onversionchange=function(e){e.target.close()},r(t),_(e)}}))}function C(e){return k(e,!1)}function T(e){return k(e,!0)}function E(e,t){if(!e.db)return!0;var r=!e.db.objectStoreNames.contains(e.storeName),n=e.version<e.db.version,o=e.version>e.db.version;if(n&&(e.version,e.version=e.db.version),o||r){if(r){var i=e.db.version+1;i>e.version&&(e.version=i)}return!0}return!1}function O(e){var t=function(e){for(var t=e.length,r=new ArrayBuffer(t),n=new Uint8Array(r),o=0;o<t;o++)n[o]=e.charCodeAt(o);return r}(atob(e.data));return u([t],{type:e.type})}function I(e){var t=this,r=t._initReady().then((function(){var e=m[t._dbInfo.name];if(e&&e.dbReady)return e.dbReady}));return l(r,e,e),r}function A(e,t,r,n){n===undefined&&(n=1);try{var o=e.db.transaction(e.storeName,t);r(null,o)}catch(i){if(n>0&&(!e.db||"InvalidStateError"===i.name||"NotFoundError"===i.name))return Dynamsoft.Lib.Promise.resolve().then((function(){if(!e.db||"NotFoundError"===i.name&&!e.db.objectStoreNames.contains(e.storeName)&&e.version<=e.db.version)return e.db&&(e.version=e.db.version+1),T(e)})).then((function(){return function(e){w(e);for(var t=m[e.name],r=t.forages,n=0;n<r.length;n++){var o=r[n];o._dbInfo.db&&(o._dbInfo.db.close(),o._dbInfo.db=null)}return e.db=null,C(e).then((function(t){return e.db=t,E(e)?T(e):t})).then((function(n){e.db=t.db=n;for(var o=0;o<r.length;o++)r[o]._dbInfo.db=n}))["catch"]((function(t){throw S(e,t),t}))}(e).then((function(){A(e,t,r,n-1)}))}))["catch"](r);r(i)}}var L={_driver:"asyncStorage",_initStorage:function(e){var t=this,r={db:null};if(e)for(var n in e)r[n]=e[n];var o=m[r.name];o||(o={forages:[],db:null,dbReady:null,deferredOperations:[]},m[r.name]=o),o.forages.push(t),t._initReady||(t._initReady=t.ready,t.ready=I);var i=[];function a(){return Dynamsoft.Lib.Promise.resolve()}for(var s=0;s<o.forages.length;s++){var c=o.forages[s];c!==t&&i.push(c._initReady()["catch"](a))}var u=o.forages.slice(0);return Promise.all(i).then((function(){return r.db=o.db,C(r)})).then((function(e){return r.db=e,E(r,t._defaultConfig.version)?T(r):e})).then((function(e){r.db=o.db=e,t._dbInfo=r;for(var n=0;n<u.length;n++){var i=u[n];i!==t&&(i._dbInfo.db=r.db,i._dbInfo.version=r.version)}}))},_support:function(){try{if(!c||!c.open)return!1;var e="undefined"!=typeof openDatabase&&/(Safari|iPhone|iPad|iPod)/.test(navigator.userAgent)&&!/Chrome/.test(navigator.userAgent)&&!/BlackBerry/.test(navigator.platform),t="function"==typeof fetch&&-1!==fetch.toString().indexOf("[native code");return(!e||t)&&"undefined"!=typeof indexedDB&&"undefined"!=typeof IDBKeyRange}catch(r){return!1}}(),getItem:function(e,t){var r=this;e=h(e);var n=new Dynamsoft.Lib.Promise((function(t,n){r.ready().then((function(){A(r._dbInfo,g,(function(o,i){if(o)return n(o);try{var a=i.objectStore(r._dbInfo.storeName).get(e);a.onsuccess=function(){var e=a.result;e===undefined&&(e=null),function(e){return e&&e.__local_forage_encoded_blob}(e)&&(e=O(e)),t(e)},a.onerror=function(){n(a.error)}}catch(s){n(s)}}))}))["catch"](n)}));return f(n,t),n},setItem:function(e,t,r){var n=this;e=h(e);var o=new Dynamsoft.Lib.Promise((function(r,o){var i;n.ready().then((function(){return i=n._dbInfo,"[object Blob]"===y.call(t)?x(i.db).then((function(e){return e?t:(r=t,new Dynamsoft.Lib.Promise((function(e,t){var n=new FileReader;n.onerror=t,n.onloadend=function(t){var n=btoa(t.target.result||"");e({__local_forage_encoded_blob:!0,data:n,type:r.type})},n.readAsBinaryString(r)})));var r})):t})).then((function(t){A(n._dbInfo,b,(function(i,a){if(i)return o(i);try{var s=a.objectStore(n._dbInfo.storeName);null===t&&(t=undefined);var c=s.put(t,e);a.oncomplete=function(){t===undefined&&(t=null),r(t)},a.onabort=a.onerror=function(){var e=c.error?c.error:c.transaction.error;o(e)}}catch(u){o(u)}}))}))["catch"](o)}));return f(o,r),o},removeItem:function(e,t){var r=this;e=h(e);var n=new Dynamsoft.Lib.Promise((function(t,n){r.ready().then((function(){A(r._dbInfo,b,(function(o,i){if(o)return n(o);try{var a=i.objectStore(r._dbInfo.storeName)["delete"](e);i.oncomplete=function(){t()},i.onerror=function(){n(a.error)},i.onabort=function(){var e=a.error?a.error:a.transaction.error;n(e)}}catch(s){n(s)}}))}))["catch"](n)}));return f(n,t),n},clear:function(e){var t=this,r=new Dynamsoft.Lib.Promise((function(e,r){t.ready().then((function(){A(t._dbInfo,b,(function(n,o){if(n)return r(n);try{var i=o.objectStore(t._dbInfo.storeName).clear();o.oncomplete=function(){e()},o.onabort=o.onerror=function(){var e=i.error?i.error:i.transaction.error;r(e)}}catch(a){r(a)}}))}))["catch"](r)}));return f(r,e),r},length:function(e){var t=this,r=new Dynamsoft.Lib.Promise((function(e,r){t.ready().then((function(){A(t._dbInfo,g,(function(n,o){if(n)return r(n);try{var i=o.objectStore(t._dbInfo.storeName).count();i.onsuccess=function(){e(i.result)},i.onerror=function(){r(i.error)}}catch(a){r(a)}}))}))["catch"](r)}));return f(r,e),r},keys:function(e){var t=this,r=new Dynamsoft.Lib.Promise((function(e,r){t.ready().then((function(){A(t._dbInfo,g,(function(n,o){if(n)return r(n);try{var i=o.objectStore(t._dbInfo.storeName).openKeyCursor(),a=[];i.onsuccess=function(){var t=i.result;t?(a.push(t.key),t["continue"]()):e(a)},i.onerror=function(){r(i.error)}}catch(s){r(s)}}))}))["catch"](r)}));return f(r,e),r},dropInstance:function(e,t){t=d.apply(this,arguments);var r,n=this.config();if((e="function"!=typeof e&&e||{}).name||(e.name=e.name||n.name,e.storeName=e.storeName||n.storeName),e.name){var o=e.name===n.name&&this._dbInfo.db?Dynamsoft.Lib.Promise.resolve(this._dbInfo.db):C(e).then((function(t){var r=m[e.name],n=r.forages;r.db=t;for(var o=0;o<n.length;o++)n[o]._dbInfo.db=t;return t}));r=e.storeName?o.then((function(t){if(t.objectStoreNames.contains(e.storeName)){var r=t.version+1;w(e);var n=m[e.name],o=n.forages;t.close();for(var i=0;i<o.length;i++){var a=o[i];a._dbInfo.db=null,a._dbInfo.version=r}var s=new Dynamsoft.Lib.Promise((function(t,n){var o=c.open(e.name,r);o.onerror=function(e){o.result.close(),n(e)},o.onupgradeneeded=function(){o.result.deleteObjectStore(e.storeName)},o.onsuccess=function(){var e=o.result;e.close(),t(e)}}));return s.then((function(e){n.db=e;for(var t=0;t<o.length;t++){var r=o[t];r._dbInfo.db=e,_(r._dbInfo)}}))["catch"]((function(t){throw(S(e,t)||Dynamsoft.Lib.Promise.resolve())["catch"]((function(){})),t}))}})):o.then((function(t){w(e);var r=m[e.name],n=r.forages;t.close();for(var o=0;o<n.length;o++){n[o]._dbInfo.db=null}var i=new Dynamsoft.Lib.Promise((function(t,r){var n=c.deleteDatabase(e.name);n.onerror=function(){var e=n.result;e&&e.close(),r(n.error)},n.onblocked=function(){},n.onsuccess=function(){var e=n.result;e&&e.close(),t(e)}}));return i.then((function(e){r.db=e;for(var t=0;t<n.length;t++){_(n[t]._dbInfo)}}))["catch"]((function(t){throw(S(e,t)||Dynamsoft.Lib.Promise.resolve())["catch"]((function(){})),t}))}))}else r=Promise.reject("Invalid arguments");return f(r,t),r}},j=new Map;function P(e,t){var r=e.name+"/";return e.storeName!==t.storeName&&(r+=e.storeName+"/"),r}function N(){return(N=_asyncToGenerator(_regeneratorRuntime().mark((function e(t){var r,n,o;return _regeneratorRuntime().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:if(r={},t)for(n in t)r[n]=t[n];o=r.keyPrefix=P(t,this._defaultConfig),this._dbInfo=r,j.has(o)||j.set(o,new Map);case 5:case"end":return e.stop()}}),e,this)})))).apply(this,arguments)}var D={_driver:"tempStorageWrapper",_initStorage:function(e){return N.apply(this,arguments)},getItem:function(e,t){var r=this;e=h(e);var n=this.ready().then((function(){return j.get(r._dbInfo.keyPrefix).get(e)}));return f(n,t),n},setItem:function(e,t,r){var n=this;e=h(e);var o=this.ready().then((function(){return t===undefined&&(t=null),j.get(n._dbInfo.keyPrefix).set(e,t),t}));return f(o,r),o},removeItem:function(e,t){var r=this;e=h(e);var n=this.ready().then((function(){j.get(r._dbInfo.keyPrefix)["delete"](e)}));return f(n,t),n},clear:function(e){var t=this,r=this.ready().then((function(){var e=t._dbInfo.keyPrefix;j.has(e)&&j["delete"](e)}));return f(r,e),r},length:function(e){var t=this,r=this.ready().then((function(){return j.get(t._dbInfo.keyPrefix).size}));return f(r,e),r},keys:function(e){var t=this,r=this.ready().then((function(){return _toConsumableArray(j.get(t._dbInfo.keyPrefix).keys())}));return f(r,e),r},dropInstance:function(e,t){var r,n=this;if(t=d.apply(this,arguments),!(e="function"!=typeof e&&e||{}).name){var o=this.config();e.name=e.name||o.name,e.storeName=e.storeName||o.storeName}return f(r=e.name?new Dynamsoft.Lib.Promise((function(t){e.storeName?t(P(e,n._defaultConfig)):t("".concat(e.name,"/"))})).then((function(e){j["delete"](e)})):Promise.reject("Invalid arguments"),t),r}},R=function(e,t){for(var r,n,o=e.length,i=0;i<o;){if((r=e[i])===(n=t)||"number"==typeof r&&"number"==typeof n&&isNaN(r)&&isNaN(n))return!0;i++}return!1},M=Array.isArray||function(e){return"[object Array]"===Object.prototype.toString.call(e)},U={},F={},B={INDEXEDDB:L,TEMPSTORAGE:D},H=[B.INDEXEDDB._driver,B.TEMPSTORAGE._driver],G=["dropInstance"],W=["clear","getItem","keys","length","removeItem","setItem"].concat(G),J={description:"",driver:H.slice(),name:"localforage",size:4980736,storeName:"keyvaluepairs",version:1};function $(e,t){e[t]=function(){var r=arguments;return e.ready().then((function(){return e[t].apply(e,r)}))}}function q(){for(var e=1;e<arguments.length;e++){var t=arguments[e];if(t)for(var r in t)t.hasOwnProperty(r)&&(M(t[r])?arguments[0][r]=t[r].slice():arguments[0][r]=t[r])}return arguments[0]}var V=function(){function e(t){for(var r in _classCallCheck(this,e),B)if(B.hasOwnProperty(r)){var n=B[r],o=n._driver;this[r]=o,U[o]||this.defineDriver(n)}this._defaultConfig=q({},J),this._config=q({},this._defaultConfig,t),this._driverSet=null,this._initDriver=null,this._ready=!1,this._dbInfo=null,this._wrapLibraryMethodsWithReady(),this.setDriver(this._config.driver)["catch"]((function(){}))}return _createClass(e,[{key:"config",value:function(e){if("object"===_typeof(e)){if(this._ready)return new Error("Can't call config() after localforage has been used.");for(var t in e){if("storeName"===t&&(e[t]=e[t].replace(/\W/g,"_")),"version"===t&&"number"!=typeof e[t])return new Error("Database version must be a number.");this._config[t]=e[t]}return!("driver"in e)||!e.driver||this.setDriver(this._config.driver)}return"string"==typeof e?this._config[e]:this._config}},{key:"defineDriver",value:function(e,t,r){var n=new Dynamsoft.Lib.Promise((function(t,r){try{var n=e._driver,o=new Error("Custom driver not compliant; see https://mozilla.github.io/localForage/#definedriver");if(!e._driver)return void r(o);for(var i=W.concat("_initStorage"),a=0,s=i.length;a<s;a++){var c=i[a];if((!R(G,c)||e[c])&&"function"!=typeof e[c])return void r(o)}!function(){for(var t=function(e){return function(){var t=new Error("Method ".concat(e," is not implemented by the current driver")),r=Promise.reject(t);return f(r,arguments[arguments.length-1]),r}},r=0,n=G.length;r<n;r++){var o=G[r];e[o]||(e[o]=t(o))}}();var u=function(r){U[n],U[n]=e,F[n]=r,t()};"_support"in e?e._support&&"function"==typeof e._support?e._support().then(u,r):u(!!e._support):u(!0)}catch(l){r(l)}}));return l(n,t,r),n}},{key:"driver",value:function(){return this._driver||null}},{key:"getDriver",value:function(e,t,r){var n=U[e]?Dynamsoft.Lib.Promise.resolve(U[e]):Promise.reject(new Error("Driver not found."));return l(n,t,r),n}},{key:"ready",value:function(e){var t=this,r=t._driverSet.then((function(){return null===t._ready&&(t._ready=t._initDriver()),t._ready}));return l(r,e,e),r}},{key:"setDriver",value:function(e,t,r){var n=this;M(e)||(e=[e]);var o=this._getSupportedDrivers(e);function i(){n._config.driver=n.driver()}function a(e){return n._extend(e),i(),n._ready=n._initStorage(n._config),n._ready}var s=null!==this._driverSet?this._driverSet["catch"]((function(){return Dynamsoft.Lib.Promise.resolve()})):Dynamsoft.Lib.Promise.resolve();return this._driverSet=s.then((function(){var e=o[0];return n._dbInfo=null,n._ready=null,n.getDriver(e).then((function(e){n._driver=e._driver,i(),n._wrapLibraryMethodsWithReady(),n._initDriver=function(e){return function(){var t=0;return function r(){for(;t<e.length;){var o=e[t];return t++,n._dbInfo=null,n._ready=null,n.getDriver(o).then(a)["catch"](r)}i();var s=new Error("No available storage method found.");return n._driverSet=Promise.reject(s),n._driverSet}()}}(o)}))}))["catch"]((function(){i();var e=new Error("No available storage method found.");return n._driverSet=Promise.reject(e),n._driverSet})),l(this._driverSet,t,r),this._driverSet}},{key:"supports",value:function(e){return!!F[e]}},{key:"_extend",value:function(e){q(this,e)}},{key:"_getSupportedDrivers",value:function(e){for(var t=[],r=0,n=e.length;r<n;r++){var o=e[r];this.supports(o)&&t.push(o)}return t}},{key:"_wrapLibraryMethodsWithReady",value:function(){for(var e=0,t=W.length;e<t;e++)$(this,W[e])}},{key:"createInstance",value:function(t){return new e(t)}}])}(),z=new V;Date.prototype.kUtilFormat=function(e){var t={"M+":this.getUTCMonth()+1,"d+":this.getUTCDate(),"H+":this.getUTCHours(),"h+":this.getUTCHours()%12||12,"m+":this.getUTCMinutes(),"s+":this.getUTCSeconds(),"q+":Math.floor((this.getUTCMonth()+3)/3),"S+":this.getUTCMilliseconds()};for(var r in/(y+)/.test(e)&&(e=e.replace(RegExp.$1,(this.getUTCFullYear()+"").substr(4-RegExp.$1.length))),t)new RegExp("("+r+")").test(e)&&(e=e.replace(RegExp.$1,1==RegExp.$1.length?t[r]:("000"+t[r]).substr(("000"+t[r]).length-RegExp.$1.length)));return e},String.prototype.startsWith||(String.prototype.startsWith=function(e){return 0==this.indexOf(e)});function Y(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function Z(e){return Z="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},Z(e)}function K(e){var t=function(e,t){if("object"!=Z(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,t||"default");if("object"!=Z(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(e)}(e,"string");return"symbol"==Z(t)?t:t+""}function X(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,K(n.key),n)}}function Q(e,t,r){return t&&X(e.prototype,t),r&&X(e,r),Object.defineProperty(e,"prototype",{writable:!1}),e}function ee(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e["default"]:e}var te={exports:{}},re={exports:{}};!function(e){function t(r){return e.exports=t="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},e.exports.__esModule=!0,e.exports["default"]=e.exports,t(r)}e.exports=t,e.exports.__esModule=!0,e.exports["default"]=e.exports}(re);var ne=re.exports;!function(e){var t=ne["default"];function r(){e.exports=r=function(){return o},e.exports.__esModule=!0,e.exports["default"]=e.exports;var n,o={},i=Object.prototype,a=i.hasOwnProperty,s=Object.defineProperty||function(e,t,r){e[t]=r.value},c="function"==typeof Symbol?Symbol:{},u=c.iterator||"@@iterator",f=c.asyncIterator||"@@asyncIterator",l=c.toStringTag||"@@toStringTag";function h(e,t,r){return Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}),e[t]}try{h({},"")}catch(n){h=function(e,t,r){return e[t]=r}}function d(e,t,r,n){var o=t&&t.prototype instanceof x?t:x,i=Object.create(o.prototype),a=new P(n||[]);return s(i,"_invoke",{value:I(e,r,a)}),i}function p(e,t,r){try{return{type:"normal",arg:e.call(t,r)}}catch(e){return{type:"throw",arg:e}}}o.wrap=d;var v="suspendedStart",m="suspendedYield",y="executing",g="completed",b={};function x(){}function w(){}function _(){}var S={};h(S,u,(function(){return this}));var k=Object.getPrototypeOf,C=k&&k(k(N([])));C&&C!==i&&a.call(C,u)&&(S=C);var T=_.prototype=x.prototype=Object.create(S);function E(e){["next","throw","return"].forEach((function(t){h(e,t,(function(e){return this._invoke(t,e)}))}))}function O(e,r){function n(o,i,s,c){var u=p(e[o],e,i);if("throw"!==u.type){var f=u.arg,l=f.value;return l&&"object"==t(l)&&a.call(l,"__await")?r.resolve(l.__await).then((function(e){n("next",e,s,c)}),(function(e){n("throw",e,s,c)})):r.resolve(l).then((function(e){f.value=e,s(f)}),(function(e){return n("throw",e,s,c)}))}c(u.arg)}var o;s(this,"_invoke",{value:function(e,t){function i(){return new r((function(r,o){n(e,t,r,o)}))}return o=o?o.then(i,i):i()}})}function I(e,t,r){var o=v;return function(i,a){if(o===y)throw Error("Generator is already running");if(o===g){if("throw"===i)throw a;return{value:n,done:!0}}for(r.method=i,r.arg=a;;){var s=r.delegate;if(s){var c=A(s,r);if(c){if(c===b)continue;return c}}if("next"===r.method)r.sent=r._sent=r.arg;else if("throw"===r.method){if(o===v)throw o=g,r.arg;r.dispatchException(r.arg)}else"return"===r.method&&r.abrupt("return",r.arg);o=y;var u=p(e,t,r);if("normal"===u.type){if(o=r.done?g:m,u.arg===b)continue;return{value:u.arg,done:r.done}}"throw"===u.type&&(o=g,r.method="throw",r.arg=u.arg)}}}function A(e,t){var r=t.method,o=e.iterator[r];if(o===n)return t.delegate=null,"throw"===r&&e.iterator["return"]&&(t.method="return",t.arg=n,A(e,t),"throw"===t.method)||"return"!==r&&(t.method="throw",t.arg=new TypeError("The iterator does not provide a '"+r+"' method")),b;var i=p(o,e.iterator,t.arg);if("throw"===i.type)return t.method="throw",t.arg=i.arg,t.delegate=null,b;var a=i.arg;return a?a.done?(t[e.resultName]=a.value,t.next=e.nextLoc,"return"!==t.method&&(t.method="next",t.arg=n),t.delegate=null,b):a:(t.method="throw",t.arg=new TypeError("iterator result is not an object"),t.delegate=null,b)}function L(e){var t={tryLoc:e[0]};1 in e&&(t.catchLoc=e[1]),2 in e&&(t.finallyLoc=e[2],t.afterLoc=e[3]),this.tryEntries.push(t)}function j(e){var t=e.completion||{};t.type="normal",delete t.arg,e.completion=t}function P(e){this.tryEntries=[{tryLoc:"root"}],e.forEach(L,this),this.reset(!0)}function N(e){if(e||""===e){var r=e[u];if(r)return r.call(e);if("function"==typeof e.next)return e;if(!isNaN(e.length)){var o=-1,i=function t(){for(;++o<e.length;)if(a.call(e,o))return t.value=e[o],t.done=!1,t;return t.value=n,t.done=!0,t};return i.next=i}}throw new TypeError(t(e)+" is not iterable")}return w.prototype=_,s(T,"constructor",{value:_,configurable:!0}),s(_,"constructor",{value:w,configurable:!0}),w.displayName=h(_,l,"GeneratorFunction"),o.isGeneratorFunction=function(e){var t="function"==typeof e&&e.constructor;return!!t&&(t===w||"GeneratorFunction"===(t.displayName||t.name))},o.mark=function(e){return Object.setPrototypeOf?Object.setPrototypeOf(e,_):(e.__proto__=_,h(e,l,"GeneratorFunction")),e.prototype=Object.create(T),e},o.awrap=function(e){return{__await:e}},E(O.prototype),h(O.prototype,f,(function(){return this})),o.AsyncIterator=O,o.async=function(e,t,r,n,i){void 0===i&&(i=Promise);var a=new O(d(e,t,r,n),i);return o.isGeneratorFunction(t)?a:a.next().then((function(e){return e.done?e.value:a.next()}))},E(T),h(T,l,"Generator"),h(T,u,(function(){return this})),h(T,"toString",(function(){return"[object Generator]"})),o.keys=function(e){var t=Object(e),r=[];for(var n in t)r.push(n);return r.reverse(),function o(){for(;r.length;){var e=r.pop();if(e in t)return o.value=e,o.done=!1,o}return o.done=!0,o}},o.values=N,P.prototype={constructor:P,reset:function(e){if(this.prev=0,this.next=0,this.sent=this._sent=n,this.done=!1,this.delegate=null,this.method="next",this.arg=n,this.tryEntries.forEach(j),!e)for(var t in this)"t"===t.charAt(0)&&a.call(this,t)&&!isNaN(+t.slice(1))&&(this[t]=n)},stop:function(){this.done=!0;var e=this.tryEntries[0].completion;if("throw"===e.type)throw e.arg;return this.rval},dispatchException:function(e){if(this.done)throw e;var t=this;function r(r,o){return s.type="throw",s.arg=e,t.next=r,o&&(t.method="next",t.arg=n),!!o}for(var o=this.tryEntries.length-1;o>=0;--o){var i=this.tryEntries[o],s=i.completion;if("root"===i.tryLoc)return r("end");if(i.tryLoc<=this.prev){var c=a.call(i,"catchLoc"),u=a.call(i,"finallyLoc");if(c&&u){if(this.prev<i.catchLoc)return r(i.catchLoc,!0);if(this.prev<i.finallyLoc)return r(i.finallyLoc)}else if(c){if(this.prev<i.catchLoc)return r(i.catchLoc,!0)}else{if(!u)throw Error("try statement without catch or finally");if(this.prev<i.finallyLoc)return r(i.finallyLoc)}}}},abrupt:function(e,t){for(var r=this.tryEntries.length-1;r>=0;--r){var n=this.tryEntries[r];if(n.tryLoc<=this.prev&&a.call(n,"finallyLoc")&&this.prev<n.finallyLoc){var o=n;break}}o&&("break"===e||"continue"===e)&&o.tryLoc<=t&&t<=o.finallyLoc&&(o=null);var i=o?o.completion:{};return i.type=e,i.arg=t,o?(this.method="next",this.next=o.finallyLoc,b):this.complete(i)},complete:function(e,t){if("throw"===e.type)throw e.arg;return"break"===e.type||"continue"===e.type?this.next=e.arg:"return"===e.type?(this.rval=this.arg=e.arg,this.method="return",this.next="end"):"normal"===e.type&&t&&(this.next=t),b},finish:function(e){for(var t=this.tryEntries.length-1;t>=0;--t){var r=this.tryEntries[t];if(r.finallyLoc===e)return this.complete(r.completion,r.afterLoc),j(r),b}},"catch":function(e){for(var t=this.tryEntries.length-1;t>=0;--t){var r=this.tryEntries[t];if(r.tryLoc===e){var n=r.completion;if("throw"===n.type){var o=n.arg;j(r)}return o}}throw Error("illegal catch attempt")},delegateYield:function(e,t,r){return this.delegate={iterator:N(e),resultName:t,nextLoc:r},"next"===this.method&&(this.arg=n),b}},o}e.exports=r,e.exports.__esModule=!0,e.exports["default"]=e.exports}(te);var oe=(0,te.exports)(),ie=oe;try{regeneratorRuntime=oe}catch(Nr){"object"===("undefined"==typeof globalThis?"undefined":_typeof(globalThis))?globalThis.regeneratorRuntime=oe:Function("r","regeneratorRuntime = r")(oe)}var ae,se,ce=ee(ie);function ue(e){var t=e?new Date(e):new Date,r="yyyy-MM-dd HH:mm:ss.SSSZ",n={"M+":t.getUTCMonth()+1,"d+":t.getUTCDate(),"H+":t.getUTCHours(),"h+":t.getUTCHours()%12||12,"m+":t.getUTCMinutes(),"s+":t.getUTCSeconds(),"q+":Math.floor((t.getUTCMonth()+3)/3),"S+":t.getUTCMilliseconds()};for(var o in/(y+)/.test(r)&&(r=r.replace(RegExp.$1,(t.getUTCFullYear()+"").substr(4-RegExp.$1.length))),n)new RegExp("("+o+")").test(r)&&(r=r.replace(RegExp.$1,1==RegExp.$1.length?n[o]:("000"+n[o]).substr(("000"+n[o]).length-RegExp.$1.length)));return r}function fe(e){return e===se}function le(e){return e!==se}function he(e){return null===e}ae="object"===("undefined"==typeof window?"undefined":Z(window))?window:{};var de={"[object Function]":"function","[object AsyncFunction]":"function","[object String]":"string","[object Object]":"object","[object Boolean]":"boolean","[object Number]":"number","[object Array]":"array"};function pe(e){return he(e)||fe(e)?String(e):de[{}.toString.call(e)]||"object"}function ve(e){return"function"===pe(e)}function me(e){return"string"===pe(e)}function ye(e){return"object"===pe(e)}function ge(e){return"boolean"===pe(e)}function be(e){return"number"===pe(e)}function xe(e){return Array.isArray?Array.isArray(e):"array"===pe(e)}function we(e){if(null==e)return[];if(xe(e))return e;var t=Z(e.length),r=Z(e);if("number"!==t||e.alert||"string"===r||"function"===r&&(!("item"in e)||"number"!==t))return[e];for(var n=[],o=0,i=e.length;o<i;o++)n[o]=e[o];return n}var _e,Se,ke={debug:!1,showConsoleError:!1};function Ce(){return _e}function Te(e){_e=e}function Ee(e,t,r,n){if(ke.debug&&Se&&ve(Se.log)){var o=ue((new Date).getTime()),i=we(arguments);Se.log(["[",o,"] ",i].join(""))}}function Oe(e,t,r,n){if((ke.debug||ke.showConsoleError)&&Se&&ve(Se.error)){var o=ue((new Date).getTime()),i=we(arguments);Se.error(["[",o,"] ",i].join(""))}}function Ie(e,t,r,n){if(ke.debug&&Se&&ve(Se.warn)){var o=ue((new Date).getTime()),i=we(arguments);Se.warn(["[",o,"] ",i].join(""))}}function Ae(e,t,r,n){if(ke.debug&&Se&&ve(Se.info)){var o=ue((new Date).getTime()),i=we(arguments);Se.info(["[",o,"] ",i].join(""))}}ae&&le(ae.console)&&(ve((Se=ae.console).log)&&ve(Se.error)?_e={log:Ee,error:Oe,info:Ae,warn:Ie,debug:function(e,t,r,n){if(ke.debug&&Se&&ve(Se.debug)){var o=ue((new Date).getTime()),i=we(arguments);Se.debug(["[",o,"] ",i].join(""))}}}:(Se=!1,_e=!1));var Le={queue:[],doNextStarted:!1,timer:null,pushToDo:function(e,t,r){Le.queue.push({obj:e,method:t,args:r})},doNext:function(){if(Le.doNextStarted)if(0!=Le.queue.length){var e=Le.queue[0],t=e.obj,r=e.method,n=e.args;if(Le.queue.splice(0,1),t&&ve(t[r])){var o=!1;if(n.length>2){var i=n[n.length-2],a=n[n.length-1];ve(i)&&ve(a)&&(n[n.length-2]=function(){try{i.apply(t,arguments)}catch(e){}Le.timer=setTimeout(Le.doNext,0)},n[n.length-1]=function(){try{a.apply(t,arguments)}catch(e){}Le.timer=setTimeout(Le.doNext,0)},o=!0)}try{t[r].apply(t,n)}catch(s){}o||(Le.timer=setTimeout(Le.doNext,0))}else if(null===t&&ve(r)){try{r.apply(null,n)}catch(c){}Le.timer=setTimeout(Le.doNext,0)}else Ee("not invoke a function: "+r),Le.timer=setTimeout(Le.doNext,0)}else Le.stop();else Le.stop()},start:function(){Le.doNextStarted||(Le.doNextStarted=!0,Le.timer=setTimeout(Le.doNext,0))},stop:function(){clearTimeout(Le.timer),Le.timer=null,Le.doNextStarted=!1,Le.queue=[]}},je=!0,Pe=!1;function Ne(e,t,r){if(e){var n,o,i,a=0,s=e.length;if(r=r||null,fe(s)||ve(e))for(i=Object.keys(e);a<i.length&&(n=i[a],t.call(r,e[n],n,e)!==Pe);a++);else for(o=e[0];a<s&&t.call(r,o,a,e)!==Pe;o=e[++a]);}return e}var De,Re={fire:function(e){var t,r=this;r.exec=r.exec||{},e=e.toLowerCase(),t=Array.prototype.slice.call(arguments,1),Ne(r.exec[e]||[],(function(e){var n=e.f,o=e.c||r;try{n.apply(o,t)}catch(i){Ee(i)}}))},on:function(e,t,r){var n=this;n.exec=n.exec||{},e=e.toLowerCase(),n.exec[e]=n.exec[e]||[],n.exec[e].push({f:t,c:r})},off:function(e,t,r){var n=this.exec;if(n)if(e)if(e=e.toLowerCase(),t)for(var o=n[e]||[],i=o.length-1;i>=0;i--)o[i]===t&&o.splice(i,1);else n[e]=null;else this.exec=null}},Me="";var Ue,Fe,Be,He,Ge=navigator,We=!0;if("userAgentData"in Ge){var Je=Ge.userAgentData,$e=[];Je.platform&&""!=Je.platform&&("brands"in Je&&Array.isArray(Je.brands)&&Je.brands.length>0?$e=Je.brands:"uaList"in Je&&Array.isArray(Je.uaList)&&Je.uaList.length>0&&($e=Je.uaList),$e.length>0&&(We=!1,Fe=Je.platform.toLowerCase(),Ue=function(e,t,r){var n,o,i,a,s,c,u,f,l,h=!1,d=!1,p=!1,v=e.mobile,m=!1,y=Me,g=navigator.maxTouchPoints||0;for(o=t.length,n=0;n<o;n++){var b=t[n].brand.toLowerCase();if(b.indexOf("chrome")>=0){p=!0,y=t[n].version;break}if(b.indexOf("edge")>=0){h=!0,y=t[n].version;break}if(b.indexOf("opera")>=0){d=!0,y=t[n].version;break}}return p||h||d||(p=!0,y="100"),i=/windows/g.test(r),a=/mac/g.test(r),s=/linux/g.test(r),c=/android/g.test(r),u=/harmony/g.test(r),f=/(chromeos|chrome\sos)/g.test(r),l=/iphone/g.test(r),i||c||s||l||(m=/macintel/g.test(r)&&g>1),(c||u||l||m)&&(v=!0),{bUseUserAgent:!1,bWin:i,bMac:a,bLinux:s,bAndroid:c,bHarmonyOS:u,bChromeOS:f,bIE:!1,bEdge:h,bUC:!1,bPlaybook:!1,bBlackBerry:!1,bHuaWeiBrowser:!1,bOpera:d,bFirefox:!1,bChrome:p,bJSDom:!1,biPhone:l,biPad:m,bPad:c&&!e.mobile,bSafari:!1,bMobile:v,strBrowserVersion:y,bHTML5Edition:!0,IEVersion:0,IEMode:0}}(Je,$e,Fe)))}We&&(Be||(Be=Ge.userAgent.toLowerCase()),He||(He=Ge.platform.toLowerCase()),Ue=function(e,t){var r,n=e.toLowerCase(),o=t.toLowerCase(),i=/harmonyos/g.test(n);"linux"==o&&n.indexOf("windows nt")>=0&&(o="harmonyos",i=!0);var a=!i&&/cros/.test(n),s=!i&&/android/g.test(n)||/android/g.test(o),c=/iphone/g.test(n)||/iphone/g.test(o),u=/macintosh/.test(n),f=navigator.maxTouchPoints||0,l=/ipad/g.test(n)||(u||"macintel"==o)&&f>1,h=/ucweb|ucbrowser/g.test(n),d=!h&&/nexus/g.test(n)&&/version\/[\d.]+.*safari\//g.test(n),p=/playbook/g.test(n),v=/hp-tablet/g.test(n),m=/blackberry|bb10/g.test(n),y=/symbian/g.test(n),g=/windows phone/g.test(n),b=/mobile/g.test(n),x=/arm64|aarch64/g.test(n),w=/mips64/g.test(n),_=/huaweibrowser/g.test(n),S=/jsdom/g.test(n),k=p||l||v,C=!k&&!a&&(c||d||m||y||g||s||i||b),T=!C&&!k&&!a,E=T&&/win32|win64|windows/.test(o),O=E&&/win64|x64/.test(n),I=T&&/mac68k|macppc|macintosh|macintel/.test(n),A=T&&/linux/.test(o),L="win64"==o||/wow64|x86_64|win64|x64/.test(n)||x||w,j=/wow64/g.test(n),P=Pe,N=/opera|opr/g.test(n),D=/360se/g.test(n),R=/maxthon/g.test(n),M=/tencenttraveler|qqbrowser/g.test(n),U=/the world/g.test(n),F=/metasr/g.test(n),B=/avant/g.test(n),H=/firefox|fxios/g.test(n),G=/gecko/g.test(n),W=!(H||_)&&/edge\/|edga\/|edgios\/|edg\//g.test(n),J=!(m||p||h||N||W||_||S)&&/chrome|crios/g.test(n),$=!1,q=Me,V=0,z=0,Y=Me;if(E&&!W&&!H&&!J){var Z=n.indexOf("msie "),K=n.indexOf("trident"),X=n.indexOf("rv:");$=-1!=Z||-1!=K||-1!=X}if(!(I||c||l||E||m||p||d)||h||N||W||$||H||(r=n.match(/version\/([\d.]+).*safari\//))&&(m||p||d||(P=je,J=Pe),Y=r[1]),W){var Q=n.indexOf("edge/");Q>-1?Q+=5:(Q=n.indexOf("edg/"))>-1?Q+=4:(Q=n.indexOf("edga/"))>-1?Q+=5:(Q=n.indexOf("edgios/"))>-1&&(Q+=7),Q>-1&&(r=(Y=n.slice(Q)).indexOf(" "))>-1&&(Y=Y.slice(0,r))}else if(H)if((r=n.indexOf("firefox/"))>-1){var ee=(r=n.slice(r+8)).indexOf(" ");ee>-1&&(r=r.slice(0,ee)),Y=r,(ee=r.indexOf("."))>-1&&(r=Y.slice(0,ee))}else(c||l)&&(r=n.indexOf("fxios/"))>-1&&(Y=r=(r=n.slice(r+6)).slice(0,r.indexOf(" ")));else if($){var te=n.indexOf("msie "),re=n.indexOf("trident"),ne=n.indexOf("rv:");-1!=te?q=r=(r=n.slice(te+5)).slice(0,r.indexOf(";")):-1!=ne?q=r=(r=(r=n.slice(ne+3)).slice(0,r.indexOf(";"))).slice(0,r.indexOf(")")):-1!=re&&(q=r=(r=n.slice(re+7)).slice(0,r.indexOf(";"))),Y=r}else if(P)(r=Y.indexOf("."))>-1&&(r=Y.slice(0,r));else if(h)(r=n.indexOf("ucweb"))>-1?Y=n.slice(r+5):(r=n.indexOf("ucbrowser/"))>-1&&(r=(Y=n.slice(r+10)).indexOf(" "))>-1&&(Y=Y.slice(0,r));else if(N)(r=n.indexOf("version/"))>-1?Y=n.slice(r+8):(r=n.indexOf("opr/"))>-1&&(Y=n.slice(r+4));else if(y)(r=n.indexOf("browserng/"))>-1&&(Y=n.slice(r+10));else if(g)(r=n.indexOf("iemobile/"))>-1&&(Y=n.slice(r+9));else if(J){var oe=n.indexOf("chrome/");oe>-1?(r=(Y=n.slice(oe+7)).indexOf(" "))>-1&&(Y=Y.slice(0,r)):(oe=n.indexOf("crios/"))>-1&&(r=(Y=n.slice(oe+6)).indexOf(" "))>-1&&(Y=Y.slice(0,r)),(r=Y.indexOf("."))>-1&&(r=Y.slice(0,r))}else if(_){var ie=n.indexOf("huaweibrowser");ie>-1&&(r=(Y=n.slice(ie+14)).indexOf(" "))>-1&&(Y=Y.slice(0,r))}else if(S){var se=n.indexOf("jsdom");se>-1&&(r=(Y=n.slice(se+6)).indexOf(" "))>-1&&(Y=Y.slice(0,r))}if(W||$){var ce=window.document;ce&&ce.documentMode?V=ce.documentMode:(V=5,ce.compatMode&&"CSS1Compat"==ce.compatMode&&(V=7)),$&&(z=parseInt(Y))}(I||A)&&(L=!0,I&&(r=n.match(/mac os x (\d+)(_|\.)(\d+)/))&&r.length>3&&(10==r[1]&&r[3]<14||r[1]<10)&&(L=!1)),E||I||A||x||w||(C=!0);var ue=!0;if($)if(""===q||parseInt(q)>=10){var fe=ae.Dynamsoft;fe&&fe.DWT&&fe.DWT.IfUseActiveXForIE10Plus&&(ue=Pe)}else ue=Pe;return{bUseUserAgent:!0,bWin:E,bMac:I,bLinux:A,bMobile:C,bPad:k,bChromeOS:a,bHarmonyOS:i,bArm64:x,bMips64:w,bEmbed:x||w,bAndroid:s,biPhone:c,biPad:l,bWin64:O,bWOW64:j,bOSx64:L,bIE:$,bEdge:W,bChrome:J,bFirefox:H,bSafari:P,bOpera:N,bNexus:d,bUC:h,b360SE:D,bMaxthon:R,bTencentTraveler:M,bTheWorld:U,bMetaSr:F,bAvant:B,bHuaWeiBrowser:_,bJSDom:S,bGecko:G,bHTML5Edition:ue,strBrowserVersion:Y,IEVersion:z,IEMode:V}}(Be,He));var qe=null===(De=null===document||void 0===document?void 0:document.location)||void 0===De?void 0:De.protocol;function Ve(e){return Ue.bGecko&&"mousewheel"===e?"DOMMouseScroll":e}function ze(e,t,r){var n=Ve(t);e&&e.addEventListener(n,r,!1)}function Ye(e,t,r){var n=Ve(t);e&&e.removeEventListener(n,r,!1)}function Ze(e){var t=e||ae.event;t.preventDefault&&t.preventDefault(),t.stopPropagation&&t.stopPropagation(),t.returnValue=!1,t.cancelBubble=!0}function Ke(e,t){var r=ae.document.createEvent("HTMLEvents");r.initEvent(e,je,je),t.dispatchEvent&&t.dispatchEvent(r)}qe||(qe="https:"),Ue.protocol=qe,Ue.bSSL="https:"===qe,Ue.bFileSystem="https:"!==qe&&"http:"!==qe;var Xe,Qe,et,tt,rt=ae.document,nt=[],ot=nt.push,it=nt.slice,at=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,st=function(){Qe()};function ct(e,t,r,n){var o,i,a,s=t&&t.ownerDocument,c=t?t.nodeType:9;if(r=r||[],"string"!=typeof e||!e||1!==c&&9!==c&&11!==c)return r;if(!n&&((t?t.ownerDocument||t:rt)!==et&&Qe(t),t=t||et,11!==c&&(a=at.exec(e))))if(o=a[1]){if(9===c){if(!(i=t.getElementById(o)))return r;if(i.id===o)return r.push(i),r}else if(s&&(i=s.getElementById(o))&&tt(t,i)&&i.id===o)return r.push(i),r}else{if(a[2])return ot.apply(r,t.getElementsByTagName(e)),r;if((o=a[3])&&t.getElementsByClassName)return ot.apply(r,t.getElementsByClassName(o)),r}return r}ot.apply(it.call(rt.childNodes),rt.childNodes),Qe=ct.setDocument=function(e){var t,r=e?e.ownerDocument||e:rt;return r!==et&&9===r.nodeType&&r.documentElement?(rt!==(et=r)&&(t=et.defaultView)&&t.top!==t&&(t.addEventListener?t.addEventListener("unload",st,!1):t.attachEvent&&t.attachEvent("onunload",st)),tt=function(e,t){if(t)for(;t=t.parentNode;)if(t===e)return!0;return!1},et):et},ct.contains=function(e,t){return(e.ownerDocument||e)!==et&&Qe(e),tt(e,t)},ct.error=function(e){throw new Error("Syntax error: "+e)},Xe=ct.getText=function(e){var t,r="",n=0,o=e.nodeType;if(o){if(1===o||9===o||11===o){if("string"==typeof e.textContent)return e.textContent;for(e=e.firstChild;e;e=e.nextSibling)r+=Xe(e)}else if(3===o||4===o)return e.nodeValue}else for(;t=e[n++];)r+=Xe(t);return r},Qe();var ut={encodeChars:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",decodeChars:[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,-1,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,-1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1]},ft={UTF16ToUTF8:function(e){for(var t,r,n=[],o=e.length,i=0;i<o;i++){var a=e.charCodeAt(i);if(a>0&&a<=127)n.push(e.charAt(i));else if(a>=128&&a<=2047)t=192|a>>6&31,r=128|63&a,n.push(String.fromCharCode(t),String.fromCharCode(r));else if(a>=2048&&a<=65535){t=224|a>>12&15,r=128|a>>6&63;var s=128|63&a;n.push(String.fromCharCode(t),String.fromCharCode(r),String.fromCharCode(s))}}return n.join("")},UTF8ToUTF16:function(e){var t,r,n,o,i=[],a=e.length;for(t=0;t<a;t++)(r=e.charCodeAt(t))>>7&255?6==(r>>5&255)?(o=(31&r)<<6|63&(n=e.charCodeAt(++t)),i.push(String.fromCharCode(o))):14==(r>>4&255)&&(o=(255&(r<<4|(n=e.charCodeAt(++t))>>2&15))<<8|((3&n)<<6|63&e.charCodeAt(++t)),i.push(String.fromCharCode(o))):i.push(e.charAt(t));return i.join("")},encode:function(e){for(var t,r,n,o=this.UTF16ToUTF8(e),i=[],a=0,s=o.length;a<s;){if(t=255&o.charCodeAt(a++),a==s){i.push(ut.encodeChars.charAt(t>>2)),i.push(ut.encodeChars.charAt((3&t)<<4)),i.push("==");break}if(r=o.charCodeAt(a++),a==s){i.push(ut.encodeChars.charAt(t>>2)),i.push(ut.encodeChars.charAt((3&t)<<4|(240&r)>>4)),i.push(ut.encodeChars.charAt((15&r)<<2)),i.push("=");break}n=o.charCodeAt(a++),i.push(ut.encodeChars.charAt(t>>2)),i.push(ut.encodeChars.charAt((3&t)<<4|(240&r)>>4)),i.push(ut.encodeChars.charAt((15&r)<<2|(192&n)>>6)),i.push(ut.encodeChars.charAt(63&n))}return i.join("")},encodeArray:function(e){for(var t,r,n,o=[],i=0,a=e.length;i<a;){if(t=255&e[i++],i==a){o.push(ut.encodeChars.charAt(t>>2)),o.push(ut.encodeChars.charAt((3&t)<<4)),o.push("==");break}if(r=255&e[i++],i==a){o.push(ut.encodeChars.charAt(t>>2)),o.push(ut.encodeChars.charAt((3&t)<<4|(240&r)>>4)),o.push(ut.encodeChars.charAt((15&r)<<2)),o.push("=");break}n=255&e[i++],o.push(ut.encodeChars.charAt(t>>2)),o.push(ut.encodeChars.charAt((3&t)<<4|(240&r)>>4)),o.push(ut.encodeChars.charAt((15&r)<<2|(192&n)>>6)),o.push(ut.encodeChars.charAt(63&n))}return o.join("")},decode:function(e,t){for(var r,n,o,i,a=this,s=[],c=0,u=e.length;c<u;){do{r=ut.decodeChars[255&e.charCodeAt(c++)]}while(c<u&&-1==r);if(-1==r)break;do{n=ut.decodeChars[255&e.charCodeAt(c++)]}while(c<u&&-1==n);if(-1==n)break;t?s.push(r<<2|(48&n)>>4):s.push(String.fromCharCode(r<<2|(48&n)>>4));do{if(61==(o=255&e.charCodeAt(c++)))return t?s:a.UTF8ToUTF16(s.join(""));o=ut.decodeChars[o]}while(c<u&&-1==o);if(-1==o)break;t?s.push((15&n)<<4|(60&o)>>2):s.push(String.fromCharCode((15&n)<<4|(60&o)>>2));do{if(61==(i=255&e.charCodeAt(c++)))return t?s:a.UTF8ToUTF16(s.join(""));i=ut.decodeChars[i]}while(c<u&&-1==i);if(-1==i)break;t?s.push((3&o)<<6|i):s.push(String.fromCharCode((3&o)<<6|i))}return t?s:a.UTF8ToUTF16(s.join(""))}},lt={fromUTF16:function(e){for(var t,r=[],n=0,o=e.length;n<o;)(t=e.charCodeAt(n))>=1&&t<=127?r.push(e.charAt(n)):t>2047?(r.push(String.fromCharCode(224|t>>12&15)),r.push(String.fromCharCode(128|t>>6&63)),r.push(String.fromCharCode(128|63&t))):(r.push(String.fromCharCode(192|t>>6&31)),r.push(String.fromCharCode(128|63&t))),n++;return r.join("")},toUTF16:function(e){for(var t,r,n,o=[],i=0,a=e.length;i<a;)switch((t=e.charCodeAt(i++))>>4){case 0:case 1:case 2:case 3:case 4:case 5:case 6:case 7:o.push(e.charAt(i-1));break;case 12:case 13:r=e.charCodeAt(i++),o.push(String.fromCharCode((31&t)<<6|63&r));break;case 14:r=e.charCodeAt(i++),n=e.charCodeAt(i++),o.push(String.fromCharCode((15&t)<<12|(63&r)<<6|63&n))}return o.join("")}},ht="undefined"!=typeof self?self:global,dt=ht.btoa?function(e){return ht.btoa(e)}:function(e){for(var t,r,n=String(e),o=0,i=ut.encodeChars,a="";n.charAt(0|o)||(i="=",o%1);a+=i.charAt(63&t>>8-o%1*8)){if((r=n.charCodeAt(o+=3/4))>255)throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");t=t<<8|r}return a},pt=ht.atob?function(e){return ht.atob(e)}:function(e){var t=String(e).replace(/[=]+$/,"");if(t.length%4==1)throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");for(var r,n,o=0,i=0,a="";n=t.charAt(i++);~n&&(r=o%4?64*r+n:n,o++%4)?a+=String.fromCharCode(255&r>>(-2*o&6)):0)n=ut.encodeChars.indexOf(n);return a};function vt(e){if(null==e||"object"!=Z(e))return e;var t,r,n;if(e instanceof Date)return(t=new Date).setTime(e.getTime()),t;if(e instanceof Array){for(t=[],n=e.length,r=0;r<n;r++)t[r]=vt(e[r]);return t}if(e instanceof Object){for(r in t={},e)e.hasOwnProperty(r)&&(t[r]=vt(e[r]));return t}return 0}function mt(e){return Math.random().toString(16).substring(2,2+e)}function yt(e){var t=[mt(8),"-",mt(4),"-",mt(4),"-",mt(4),"-",mt(8)];return e&&t.unshift(e),t.join("")}var gt=Date.now||function(){return+new Date},bt=function(){return""+gt()};function xt(){for(var e,t=gt()%1e4,r=[],n=0;n<5;n++)e=Math.floor(10*Math.random()),0!=n||0!=e?r.push(e):n=-1;return t<10?r.push("000"):t<100?r.push("00"):t<1e3&&r.push("0"),r.push(t),r.join("")}function wt(e,t){var r;for(r in t)t.hasOwnProperty(r)&&(e[r]=t[r]);return e}function _t(e,t,r,n){return new(r||(r=Promise))((function(o,i){function a(e){try{c(n.next(e))}catch(t){i(t)}}function s(e){try{c(n["throw"](e))}catch(t){i(t)}}function c(e){var t;e.done?o(e.value):(t=e.value,t instanceof r?t:new r((function(e){e(t)}))).then(a,s)}c((n=n.apply(e,t||[])).next())}))}"function"==typeof SuppressedError&&SuppressedError;var St=!1;"wakeLock"in navigator&&(St=!0);var kt=null;function Ct(){St&&(null==kt?function(){_t(this,void 0,void 0,ce.mark((function e(){return ce.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.prev=0,e.next=3,navigator.wakeLock.request("screen");case 3:kt=e.sent,e.next=9;break;case 6:e.prev=6,e.t0=e["catch"](0),kt=null;case 9:case"end":return e.stop()}}),e,null,[[0,6]])})))}():kt.release().then((function(){kt=null})))}function Tt(){return kt}var Et=Array.prototype;function Ot(e,t,r){return Et.filter.call(e,t,r||this)}function It(e,t){return Et.indexOf.call(t,e)}function At(e){var t,r,n=[],o=e.length;for(t=0;t<o;t++){for(r=t+1;r<o;r++)e[t]===e[r]&&(r=++t);n.push(e[t])}return n}var Lt=/^(\/?)([\s\S]+\/(?!$)|\/)?((?:\.{1,2}$|[\s\S]+?)?(\.[^.\/]*)?)$/;function jt(e,t){var r,n=[];for(r=0;r<e.length;r++){var o=e[r];o&&"."!==o&&(".."===o?n.length&&".."!==n[n.length-1]?n.pop():t&&n.push(".."):n.push(o))}return n}function Pt(e){var t="/"===e.charAt(0),r="/"===e.slice(-1);return(e=jt(Ot(e.split("/"),(function(e){return!!e})),!t).join("/"))||t||(e="."),e&&r&&(e+="/"),(t?"/":"")+e}var Nt=function(){return Q((function e(){Y(this,e)}),[{key:"resolve",value:function(){var e,t,r="",n=arguments,o=!1;for(e=n.length-1;e>=0&&!o;e--)me(t=n[e])&&t&&(r=t+"/"+r,o="/"===t.charAt(0));return(o?"/":"")+jt(Ot(r.split("/"),(function(e){return!!e})),!o).join("/")||"."}},{key:"join",value:function(){return Pt(Ot(we(arguments),(function(e){return e&&me(e)})).join("/"))}},{key:"relative",value:function(e,t){e=Pt(e),t=Pt(t);var r,n,o=Ot(e.split("/"),(function(e){return!!e})),i=[],a=Ot(t.split("/"),(function(e){return!!e})),s=Math.min(o.length,a.length);for(r=0;r<s&&o[r]===a[r];r++);for(n=r;r<o.length;)i.push(".."),r++;return(i=i.concat(a.slice(n))).join("/")}},{key:"basename",value:function(e,t){var r;return r=(e.match(Lt)||[])[3]||"",t&&r&&r.slice(-1*t.length)===t&&(r=r.slice(0,-1*t.length)),r}},{key:"dirname",value:function(e){var t=e.match(Lt)||[],r=t[1]||"",n=t[2]||"";return r||n?(n&&(n=n.substring(0,n.length-1)),r+n):"."}},{key:"extname",value:function(e){return(e.match(Lt)||[])[4]||""}}])}(),Dt={}.hasOwnProperty;function Rt(e){if(!e||"object"!==pe(e)||e.nodeType||e.window==e)return Pe;var t,r;try{if((r=e.constructor)&&!Dt(e,"constructor")&&!Dt(r.prototype,"isPrototypeOf"))return Pe}catch(n){return Pe}for(t in e);return fe(t)||Dt(e,t)}var Mt="object"===("undefined"==typeof HTMLElement?"undefined":Z(HTMLElement));function Ut(e){return Mt?e instanceof HTMLElement:e&&"object"===Z(e)&&(1===e.nodeType||9===e.nodeType)&&"string"==typeof e.nodeName}function Ft(e){var t=e;if(Ut(e))for(;!t&&t!=document.body;)t=t.parentNode;else t=0;return!!t}function Bt(e,t){return 0===e.lastIndexOf(t,0)}function Ht(e,t){var r=e.length-t.length;return r>=0&&e.indexOf(t,r)===r}function Gt(e){return null==e?Me:String.prototype.trim.call(e)}function Wt(e){var t;if(e)for(t in e)if(!fe(t))return!1;return!0}function Jt(e){return me(e)?e.replace(/[^\x20-\x7E]/g,""):e}function $t(e,t,r){return e.replace(new RegExp(t,"gi"),r)}function qt(e){return e.charAt(0).toUpperCase()+e.substr(1)}var Vt,zt="none",Yt={getOffset:function(e,t,r){var n,o;e=e||ae.event;for(var i,a,s=r||e.target,c=0,u=0,f=0,l=0,h=!1,d=ae.document;s&&!isNaN(s.offsetLeft)&&!isNaN(s.offsetTop);)a=s.scrollLeft,i=s.scrollTop,"BODY"===s.tagName?h?(a=0,i=0):(a|=null===(n=d.documentElement)||void 0===n?void 0:n.scrollLeft,i|=null===(o=d.documentElement)||void 0===o?void 0:o.scrollTop):"fixed"===s.style.position&&(h=!0),c+=s.offsetLeft-a,u+=s.offsetTop-i,s=s.offsetParent;return t&&(f=t.Left,l=t.Top),{x:c=e.clientX-c-f,y:u=e.clientY-u-l}},getElDimensions:function(e,t){var r,n;return e?(r=e.style.display,e.style.display="",n=t?{offsetTop:e.offsetTop,offsetLeft:e.offsetLeft,offsetWidth:e.offsetWidth,offsetHeight:e.offsetHeight}:{clientTop:e.clientTop,clientLeft:e.clientLeft,clientWidth:e.clientWidth?e.clientWidth:parseInt(e.style.width)?parseInt(e.style.width):0,clientHeight:e.clientHeight?e.clientHeight:parseInt(e.style.height)?parseInt(e.style.height):0},e.style.display=r,n):{offsetTop:0,offsetLeft:0,offsetWidth:0,offsetHeight:0}}};function Zt(e){return document.getElementById(e)}function Kt(e){var t=me(e)?Zt(e):e;t&&(t.length>0&&(t=t[0]),t.style.display=zt)}function Xt(e){var t=me(e)?Zt(e):e;t&&(t.length>0&&(t=t[0]),t.style.display=Me)}function Qt(e){var t=me(e)?Zt(e):e;t&&(t.length>0&&(t=t[0]),t.style.display===zt?t.style.display=Me:t.style.display=zt)}function er(e){if(e)for(;e.firstChild;)e.removeChild(e.firstChild)}function tr(e){return encodeURIComponent(String(e))}function rr(e){return decodeURIComponent(e.replace(/\+/g," "))}if(window.trustedTypes){try{Vt=window.trustedTypes.createPolicy("d-create-script",{createScriptURL:function(e){return e}})}catch(Dr){}}function nr(e){return Vt?Vt.createScriptURL(e):e}var or=!0,ir=document,ar=ir&&ir.documentElement,sr=ir.getElementsByTagName("head")[0]||ar,cr=ir.createElement("script").readyState?function(e,t){var r=e.onreadystatechange;e.onreadystatechange=function(){var n=e.readyState;if("loaded"===n||"complete"===n){e.onreadystatechange=null,r&&r();t.call(this,{type:"load",path:[e]})}else"loading"===n||t.call(this,{type:"error",path:[e]})}}:function(e,t){e.addEventListener("load",t,Pe),e.addEventListener("error",t,Pe)};function ur(e,t,r){return fr(e,t,!1,r)}function fr(e,t,r,n){var o,i,a=n;if(ve(a)||(a=function(){}),me(e)&&e!=Me)return o=ir.createElement("script"),i=["",e].join(Me),o.src=nr(i),t&&(o.async=or),o.charset="utf-8",cr(o,a),r?sr.appendChild(o):sr.insertBefore(o,sr.firstChild),o;a()}function lr(e,t,r){return hr(e,t,!1,r)}function hr(e,t,r,n){var o=n;if(ve(o)||(o=function(){}),Ue.bJSDom)o("ok");else if(xe(e)){var i=e.length,a=function(e){e&&"load"==e.type?i--:(e&&"error"==e.type&&Oe(["Failed to load resource: ",e.target.src,"."].join("")),o()),i<=0&&o("ok")};i<=0?o("ok"):Ne(e,(function(e){fr(e,t,r,a)}))}else o()}function dr(e,t){return pr(e,!1,t)}function pr(e,t,r){var n,o=r;if(ve(o)||(o=!1),me(e)&&e!=Me){if(!Ue.bJSDom)return(n=ir.createElement("link")).href=nr(e),n.rel="stylesheet",n.async=or,o&&cr(n,o),t?sr.appendChild(n):sr.insertBefore(n,sr.firstChild),n;o&&o()}else o&&o()}function vr(e,t){return mr(e,!1,t)}function mr(e,t,r){if(Ue.bJSDom)r&&r("ok");else if(xe(e)){var n=e.length,o=function(e){e&&"load"==e.type&&n--,e&&"load"!=e.type&&(e&&"error"==e.type&&Oe(["Failed to load resource: ",e.target.href,"."].join("")),r()),n<=0&&r("ok")};Ne(e,(function(e){pr(e,t,o)}))}else r&&r()}function yr(e){var t,r;if(!Ue.bJSDom){var n=document;if(n&&me(r=e.body)&&r!=Me){(t=n.createElement("script")).charset="utf-8",Ue.bIE?t.text=r:t.appendChild(n.createTextNode(r)),e.language?t.language=e.language:t.language="javascript",e.type?t.type=e.type:t.type="text/javascript";var o=n&&n.documentElement,i=n.getElementsByTagName("head")[0]||o;i.insertBefore(t,i.firstChild)}}}function gr(e){yr({body:e})}function br(e){yr({body:e,language:"vbscript",type:"text/vbscript"})}function xr(e){return null!=e&&e==e.window}var wr=new(function(){return Q((function e(){Y(this,e),this.nil=undefined,this.bNode=!1,this.noop=function(){},this.mix=wt,this.clone=vt,this.keys=Object.keys,this.now=bt,this.getFormatedNow=ue,this.getRandom=xt,this.guid=yt,this.get=Zt,this.show=Xt,this.hide=Kt,this.toggle=Qt,this.empty=er,this.stringify=ae.JSON.stringify,this.parse=ae.JSON.parse,this.isDef=le,this.isUndef=fe,this.isUndefined=fe,this.isNull=he,this.isNaN=isNaN,this.isFunction=ve,this.isString=me,this.isObject=ye,this.isBoolean=ge,this.isNumber=be,this.isArray=xe,this.type=pe,this.isPlainObject=Rt,this.isDOM=Ut,this.isDOMInBody=Ft,this.each=Ne,this.getLogger=Ce,this.setLogger=Te,this.log=Ee,this.error=Oe,this.warn=Ie,this.info=Ae,this.filter=Ot,this.indexOf=It,this.uniq=At,this.startsWith=Bt,this.endsWith=Ht,this.replaceAll=$t,this.upperCaseFirst=qt,this.removeNonPrintableChar=Jt,this.trim=Gt,this.makeArray=we,this.isEmptyObject=Wt,this.Path=new Nt,this.DOM=Yt,this.isWindow=xr,this.obj={customEvent:Re},this.addEventListener=ze,this.removeEventListener=Ye,this.stopPropagation=Ze,this.fireEvent=Ke,this.base64=ft,this.utf8=lt,this.btoa=dt,this.atob=pt,this.asyncQueue=Le,this.sizzle=ct,this.toggleWakeLock=Ct,this.getWakeLock=Tt,this.urlEncode=tr,this.urlDecode=rr,this.scriptOnload=cr,this.addAllCss=mr,this.getAllCss=vr,this.addCss=pr,this.getCss=dr,this.addScripts=hr,this.getScripts=lr,this.addScript=fr,this.getScript=ur,this.addJS=gr,this.addVBS=br}),[{key:"debug",get:function(){return ke.debug},set:function(e){ke.debug=e}},{key:"showConsoleError",get:function(){return ke.debug},set:function(e){ke.showConsoleError=e}}])}()),_r=wr.clone,Sr=wr.startsWith,kr=wr.each,Cr=wr.isString,Tr=/[#\/\?@]/g,Er=/[#\?]/g,Or={scheme:1,userInfo:2,hostname:3,port:4,path:5},Ir=new RegExp("^(?:([\\w\\d+.-]+):)?(?://(?:([^/?#@]*)@)?([\\w\\d\\-\\u0100-\\uffff.+%]*|\\[[^\\]]+\\])(?::([0-9]+))?)?(.+)?$");function Ar(e,t){return Cr(e)&&Cr(t)?e.toLowerCase()===t.toLowerCase():e===t}function Lr(e,t){return encodeURI(e).replace(t,(function(e){return"%"+function(e){return 1===e.length?"0"+e:e}(e.charCodeAt(0).toString(16))}))}var jr=function(){function e(t){if(Y(this,e),this.scheme="",this.userInfo="",this.hostname="",this.port="",this.path="",t instanceof e)return _r(t);e.getComponents(t,this)}return Q(e,[{key:"clone",value:function(){var t=new e,r=this;return kr(Or,(function(e,n){t[n]=r[n]})),t}},{key:"getScheme",value:function(){return this.scheme}},{key:"setScheme",value:function(e){return this.scheme=e,this}},{key:"getHostname",value:function(){return this.hostname}},{key:"setHostname",value:function(e){return this.hostname=e,this}},{key:"setUserInfo",value:function(e){return this.userInfo=e,this}},{key:"getUserInfo",value:function(){return this.userInfo}},{key:"setPort",value:function(e){return this.port=e,this}},{key:"getPort",value:function(){return this.port}},{key:"setPath",value:function(e){return this.path=e,this}},{key:"getPath",value:function(){return this.path}},{key:"isSameOriginAs",value:function(e){var t=this;return Ar(t.hostname,e.hostname)&&Ar(t.scheme,e.scheme)&&Ar(t.port,e.port)}},{key:"toString",value:function(e){var t,r,n,o,i,a=[],s=this;return(t=s.scheme)&&(a.push(Lr(t,Tr)),a.push(":")),(r=s.hostname)&&(a.push("//"),(i=s.userInfo)&&(a.push(Lr(i,Tr)),a.push("@")),a.push(encodeURIComponent(r)),(o=s.port)&&(a.push(":"),a.push(o))),(n=s.path)&&(r&&!Sr(n,"/")&&(n="/"+n),a.push(Lr(n,Er))),a.join("")}}],[{key:"getComponents",value:function(e,t){var r=(e=e||"").match(Ir)||[],n=t||{};return kr(Or,(function(e,t){n[t]=r[e]})),n}}])}(),Pr=("undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{}).Dynamsoft;Pr.LTS={},Pr.LTS._={createLtsInstance:function(e){var t,r,n,o,i,c,u,f,l,h,d,p,v,m,y,g,b,x,w,_,S,k,C,T,E=e.fetch||a.fetch,O=e.btoa||a.btoa,I=e.atob||a.atob,A=e.bd,L=e.pd,j=e.vm,P=e.hs,N=e.dt,D=e.dm,R=["https://mlts.dynamsoft.com/","https://slts.dynamsoft.com/"],M=!1,U=Dynamsoft.Lib.Promise.resolve(),F=e.lf,B=e.log&&function(){try{for(var t=arguments.length,r=new Array(t),n=0;n<t;n++)r[n]=arguments[n];e.log.apply(null,r)}catch(o){setTimeout((function(){throw o}),0)}}||function(){},H=A&&B||function(){},G=e.fol,W=e.updl,J=e.mnet,$=e.mxet,q=e.sutlcb,V=e.feab,Y=function(e){return I(I(e.replace(/\n/g,"+").replace(/\s/g,"=")).substring(1))},Z=function(e){return O(String.fromCharCode(97+25*Math.random())+O(e)).replace(/\+/g,"\n").replace(/=/g," ")},K=function(){if(g)return g;if(a.crypto){var e=new Uint8Array(36);a.crypto.getRandomValues(e);for(var t="",r=0;r<36;++r){var n=e[r]%36;t+=n<10?n:String.fromCharCode(n+87)}return t}return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,(function(e){var t=16*Math.random()|0;return("x"==e?t:3&t|8).toString(16)}))},X=" Check your Internet connection or contact Dynamsoft Support (support@dynamsoft.com) to acquire an offline license.",Q={dlsErrorAndCacheExpire:"Failed to connect to the Dynamsoft License Server. The cached license has expired. Please get connected to the network as soon as possible or contact the site administrator for more information.",publicTrialNetworkTimeout:"Failed to connect to the Dynamsoft License Server: network timed out."+X,networkTimeout:"Failed to connect to the Dynamsoft License Server: network timed out. Check your Internet connection or contact the site administrator for more information.",publicTrialFailConnect:"Failed to connect to the Dynamsoft License Server: network connection error."+X,failConnect:"Failed to connect to the Dynamsoft License Server: network connection error. Check your Internet connection or contact the site administrator for more information.",checkLocalTime:"Your system date and time appear to have been changed, causing the license to fail. Please correct the system date and time, then try again."},ee=function(){var e=_asyncToGenerator(_regeneratorRuntime().mark((function t(){return _regeneratorRuntime().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:F||(F=z);case 1:case"end":return e.stop()}}),t)})));return function(){return e.apply(this,arguments)}}(),te=function(){var e=_asyncToGenerator(_regeneratorRuntime().mark((function t(){return _regeneratorRuntime().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.abrupt("return",b=b||_asyncToGenerator(_regeneratorRuntime().mark((function t(){var e,r,o,i,a,s,c;return _regeneratorRuntime().wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,ee();case 2:return t.next=4,F.createInstance({name:"dynamjssdkhello"});case 4:return e=t.sent,t.next=7,e.setItem("dynamjssdkhello","available");case 7:return t.next=9,F.createInstance({name:"dynamdlsinfo"});case 9:if(v=t.sent,m=g?null:O(O("v2")+String.fromCharCode(D.charCodeAt(D.length/2)+1)+O(D)),g){t.next=68;break}return t.prev=12,t.next=15,v.getItem(m);case 15:if(s=t.sent,t.t0=!s,!t.t0){t.next=28;break}return t.next=20,null===(o=self.indexedDB)||void 0===o?void 0:o.databases();case 20:if(t.t3=r=t.sent,t.t2=null!==t.t3,!t.t2){t.next=24;break}t.t2=void 0!==r;case 24:if(t.t1=t.t2,!t.t1){t.next=27;break}t.t1=r.some((function(e){return"dynamltsinfo"===(null==e?void 0:e.name)}));case 27:t.t0=t.t1;case 28:if(!t.t0){t.next=39;break}return t.next=31,F.createInstance({name:"dynamltsinfo"});case 31:return c=t.sent,t.next=34,c.getItem(m);case 34:if(s=t.sent,t.t4=s,!t.t4){t.next=39;break}return t.next=39,v.setItem(m,s);case 39:if(t.t5=s,!t.t5){t.next=50;break}return t.t6=JSON,t.next=44,Y(s);case 44:t.t7=t.sent,i=t.t6.parse.call(t.t6,t.t7),a=_slicedToArray(i,2),n=a[0],h=a[1];case 50:t.next=54;break;case 52:t.prev=52,t.t8=t["catch"](12);case 54:if(t.prev=54,t.t9=null==n,!t.t9){t.next=64;break}return n=K(),t.t10=v,t.t11=m,t.next=62,Z(JSON.stringify([n,null]));case 62:t.t12=t.sent,t.t10.setItem.call(t.t10,t.t11,t.t12);case 64:t.next=68;break;case 66:t.prev=66,t.t13=t["catch"](54);case 68:case"end":return t.stop()}}),t,null,[[12,52],[54,66]])})))());case 1:case"end":return e.stop()}}),t)})));return function(){return e.apply(this,arguments)}}(),re=function(){var e=_asyncToGenerator(_regeneratorRuntime().mark((function t(){return _regeneratorRuntime().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return y=O(String.fromCharCode(P.charCodeAt(0)+10)+O(L)+O(P)+j+O(""+N)),e.next=3,F.createInstance({name:"dynamdlsuns"+O(O("v2"))+O(String.fromCharCode(P.charCodeAt(0)+10)+O(L)+O(P)+j+O(""+N))});case 3:return p=e.sent,e.prev=4,e.next=7,v.getItem(y);case 7:r=e.sent,e.next=12;break;case 10:e.prev=10,e.t0=e["catch"](4);case 12:case"end":return e.stop()}}),t,null,[[4,10]])})));return function(){return e.apply(this,arguments)}}(),ne=function(){var e=_asyncToGenerator(_regeneratorRuntime().mark((function a(e){return _regeneratorRuntime().wrap((function(a){for(;;)switch(a.prev=a.next){case 0:return w=Date.now(),x||(x=_asyncToGenerator(_regeneratorRuntime().mark((function s(){var a,p,b,w,_,S;return _regeneratorRuntime().wrap((function(s){for(;;)switch(s.prev=s.next){case 0:if(s.prev=0,a={pd:L,vm:j,v:t,dt:N||"browser",ed:"javascript",cu:n,ad:D,os:o,fn:i},f&&(a.rmk=f),P&&(-1!=P.indexOf("-")?a.hs=P:a.og=P),p={},!h||g){s.next=20;break}return s.next=7,v.getItem(m);case 7:if(_=s.sent,s.t0=_,!s.t0){s.next=19;break}return s.t1=JSON,s.next=13,Y(_);case 13:s.t2=s.sent,b=s.t1.parse.call(s.t1,s.t2),w=_slicedToArray(b,2),n=w[0],h=w[1];case 19:p["lts-time"]=h;case 20:return u&&(a.sp=u),s.next=23,Promise.race([_asyncToGenerator(_regeneratorRuntime().mark((function k(){var t,o,i,s,u,f,d,b;return _regeneratorRuntime().wrap((function(x){for(;;)switch(x.prev=x.next){case 0:if(o=(new Date).kUtilFormat("yyyy-MM-ddTHH:mm:ss.SSSZ"),x.t0=h&&!g,!x.t0){x.next=10;break}return x.t1=v,x.t2=m,x.next=7,Z(JSON.stringify([n,o]));case 7:x.t3=x.sent,x.t1.setItem.call(x.t1,x.t2,x.t3),h=o;case 10:return i="auth/?ext="+encodeURIComponent(O(JSON.stringify(a))),l&&(i+="&"+encodeURIComponent(l)),u=!1,f=!1,d=function(){var e=_asyncToGenerator(_regeneratorRuntime().mark((function t(e){var n,o;return _regeneratorRuntime().wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(!e||e.ok){t.next=10;break}return t.prev=1,t.next=4,e.text();case 4:(n=t.sent)&&(o=JSON.parse(n)).errorCode&&(s=o,o.errorCode>100&&o.errorCode<200&&(r=null,u=!0,f=!0)),t.next=10;break;case 8:t.prev=8,t.t0=t["catch"](1);case 10:case"end":return t.stop()}}),t,null,[[1,8]])})));return function(t){return e.apply(this,arguments)}}(),x.prev=13,x.next=16,E(R[0]+i,{headers:p,cache:e?"reload":"default",mode:"cors",timeout:1e4});case 16:return t=x.sent,x.next=19,d(t);case 19:x.next=23;break;case 21:x.prev=21,x.t4=x["catch"](13);case 23:if(r||t&&t.ok||u){x.next=32;break}return x.prev=24,x.next=27,E(R[1]+i,{headers:p,mode:"cors",timeout:3e4});case 27:t=x.sent,x.next=32;break;case 30:x.prev=30,x.t5=x["catch"](24);case 32:if(r||t&&t.ok||u){x.next=43;break}return x.prev=33,x.next=36,E(R[0]+i,{headers:p,mode:"cors",timeout:3e4});case 36:return t=x.sent,x.next=39,d(t);case 39:x.next=43;break;case 41:x.prev=41,x.t6=x["catch"](33);case 43:if(x.t7=s&&151==s.errorCode&&!g,!x.t7){x.next=56;break}return v.removeItem(m),v.removeItem(y),n=K(),a.cu=n,h=void 0,i="auth/?ext="+encodeURIComponent(O(JSON.stringify(a))),x.next=53,E(R[0]+i,{headers:p,mode:"cors",timeout:3e4});case 53:return t=x.sent,x.next=56,d(t);case 56:return function(){if(!t||!t.ok){var e;f&&v.setItem(y,""),s?111==s.errorCode?e=s.message:((e=s.message.trim()).endsWith(".")||(e+="."),e="An error occurred during authorization: ".concat(e,c?" [Contact Dynamsoft](https://www.dynamsoft.com/company/contact/) for more information.":" Contact the site administrator for more information.")):e=c?Q.publicTrialFailConnect:Q.failConnect;var r=Error(e);throw s&&s.errorCode&&(r.ltsErrorCode=s.errorCode),r}}(),x.next=59,t.text();case 59:if(b=x.sent,x.prev=60,x.t8=h||g,x.t8){x.next=70;break}return x.t9=v,x.t10=m,x.next=67,Z(JSON.stringify([n,o]));case 67:x.t11=x.sent,x.t9.setItem.call(x.t9,x.t10,x.t11),h=o;case 70:v.setItem(y,b),x.next=75;break;case 73:x.prev=73,x.t12=x["catch"](60);case 75:return x.abrupt("return",b);case 76:case"end":return x.stop()}}),k,null,[[13,21],[24,30],[33,41],[60,73]])})))(),new Dynamsoft.Lib.Promise((function(e,t){var n;n=c?Q.publicTrialNetworkTimeout:Q.networkTimeout,setTimeout((function(){return t(new Error(n))}),r?3e3:15e3)}))]);case 23:S=s.sent,r=S,s.next=30;break;case 27:s.prev=27,s.t3=s["catch"](0),d=s.t3;case 30:x=null;case 31:case"end":return s.stop()}}),s,null,[[0,27]])})))()),a.next=4,x;case 4:case"end":return a.stop()}}),a)})));return function(t){return e.apply(this,arguments)}}(),oe=function(){var e=_asyncToGenerator(_regeneratorRuntime().mark((function a(){return _regeneratorRuntime().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return _||(_=_asyncToGenerator(_regeneratorRuntime().mark((function a(){var e;return _regeneratorRuntime().wrap((function(a){for(;;)switch(a.prev=a.next){case 0:if(H(n),r){a.next=4;break}if(M){a.next=3;break}throw B(d.message),d;case 3:return a.abrupt("return");case 4:e={dm:D},A&&(e.bd=!0),e.brtk=!0,e.ls=R[0],P&&(-1!=P.indexOf("-")?e.hs=P:e.og=P),e.cu=n,i&&(e.fn=i),L&&(e.pd=L),t&&(e.v=t),N&&(e.dt=N),o&&(e.os=o),f&&(e.rmk=f),H(r);try{e.ar=r,e.bafc=!!d}catch(Dr){}return H(e),a.prev=8,a.next=11,W(e);case 11:a.next=16;break;case 13:a.prev=13,a.t0=a["catch"](8),H("error updl");case 16:return a.next=18,ie();case 18:M||(M=!0),_=null;case 20:case"end":return a.stop()}}),a,null,[[8,13]])})))()),e.next=3,_;case 3:case"end":return e.stop()}}),a)})));return function(){return e.apply(this,arguments)}}(),ie=function(){var e=_asyncToGenerator(_regeneratorRuntime().mark((function t(){var e,r;return _regeneratorRuntime().wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return e=(new Date).kUtilFormat("yyyy-MM-ddTHH:mm:ss.SSSZ"),t.next=3,$();case 3:if(r=t.sent,H(r),!(r&&r<e)){t.next=6;break}throw d?new Error(Q.dlsErrorAndCacheExpire):new Error(Q.checkLocalTime);case 6:case"end":return t.stop()}}),t)})));return function(){return e.apply(this,arguments)}}(),ae=null,se=new Dynamsoft.Lib.Promise((function(e){ae=function(){se.isPending=!1,se.isFulfilled=!0,e()}})),ce=null,ue=function(){var e=_asyncToGenerator(_regeneratorRuntime().mark((function t(e,r){return _regeneratorRuntime().wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return U=U.then(_asyncToGenerator(_regeneratorRuntime().mark((function o(){var t,i,a,c,u,f,l,d,y,b,x,w;return _regeneratorRuntime().wrap((function(o){for(;;)switch(o.prev=o.next){case 0:return o.prev=0,o.next=3,p.keys();case 3:if(t=o.sent,r||(se.isFulfilled?e&&(t=t.filter((function(t){return t<e}))):e&&t.includes(e)?t=[e]:(t=[],H("Unexpected null key"))),t.length){o.next=6;break}return o.abrupt("return");case 6:i=0;case 7:if(!(i<t.length/1e3)){o.next=67;break}a=t.slice(1e3*i,1e3*(i+1)),c=[],u=0;case 10:if(!(u<a.length)){o.next=19;break}return o.t0=c,o.next=14,p.getItem(a[u]);case 14:o.t1=o.sent,o.t0.push.call(o.t0,o.t1);case 16:++u,o.next=10;break;case 19:if(h=(new Date).kUtilFormat("yyyy-MM-ddTHH:mm:ss.SSSZ"),g){o.next=39;break}return o.next=22,v.getItem(m);case 22:if(d=o.sent,o.t2=d,!o.t2){o.next=33;break}return o.t3=JSON,o.next=28,Y(d);case 28:o.t4=o.sent,f=o.t3.parse.call(o.t3,o.t4),l=_slicedToArray(f,1),n=l[0];case 33:return o.t5=v,o.t6=m,o.next=37,Z(JSON.stringify([n,h]));case 37:o.t7=o.sent,o.t5.setItem.call(o.t5,o.t6,o.t7);case 39:o.prev=39,y=void 0,b=void 0,x=R[0]+"verify/v2",h&&!g&&(x+="?ltstime="+encodeURIComponent(h));try{y=E(x,{method:"POST",body:c.join(";"),keepalive:!0})}finally{!se.isFulfilled&&s&&ae()}return o.prev=43,o.next=46,y;case 46:b=o.sent;case 47:return o.prev=47,se.isFulfilled||ae(),o.finish(47);case 50:if(b.ok){o.next=52;break}throw new Error("verify failed. Status Code: "+b.status);case 52:w=0;case 53:if(!(w<a.length)){o.next=59;break}return o.next=56,p.removeItem(a[w]);case 56:++w,o.next=53;break;case 59:o.next=64;break;case 61:throw o.prev=61,o.t8=o["catch"](39),se.isFulfilled||ae(),G&&(G(o.t8),G=null),o.t8;case 64:++i,o.next=7;break;case 67:q&&q(),o.next=72;break;case 70:o.prev=70,o.t9=o["catch"](0);case 72:case"end":return o.stop()}}),o,null,[[0,70],[39,61],[43,,47,50]])})))),t.next=3,U;case 3:return t.abrupt("return",t.sent);case 4:case"end":return t.stop()}}),t)})));return function(t,r){return e.apply(this,arguments)}}();return{i:(T=_asyncToGenerator(_regeneratorRuntime().mark((function fe(e){return _regeneratorRuntime().wrap((function(a){for(;;)switch(a.prev=a.next){case 0:return L=e.pd,t=e.v,j=t.split(".")[0],e.dt&&(N=e.dt),P=e.l||"",o="string"!=typeof e.os?JSON.stringify(e.os):e.os,"string"==typeof(i=e.fn)&&(i=i.substring(0,255)),e.ls&&e.ls.length&&1==(R=e.ls).length&&R.push(R[0]),c=!P||"200001"===P||P.startsWith("200001-"),u=e.sp,"string"==typeof(f=e.rmk)&&(f=f.substring(0,255)),e.cv&&(l=""+e.cv),e.lf&&(F=e.lf),e.lsu&&(n=g=e.lsu),e.feab&&(V=e.feab),W=e.updl,J=e.mnet,$=e.mxet,e.sutlcb&&(q=e.sutlcb),a.next=23,te();case 23:return a.next=25,re();case 25:return a.next=27,ne();case 27:return a.next=29,oe();case 29:return(!d||d.ltsErrorCode>=102&&d.ltsErrorCode<=120)&&ue(null,!0),a.abrupt("return",{ar:r,cu:n});case 31:case"end":return a.stop()}}),fe)}))),function(e){return T.apply(this,arguments)}),ih:re,c:(C=_asyncToGenerator(_regeneratorRuntime().mark((function le(){var e,t,r,n,o,i;return _regeneratorRuntime().wrap((function(a){for(;;)switch(a.prev=a.next){case 0:if(!((e=new Date).getTime()<w+36e4)){a.next=3;break}return a.abrupt("return");case 3:return t=e.kUtilFormat("yyyy-MM-ddTHH:mm:ss.SSSZ"),a.next=6,J();case 6:return r=a.sent,a.next=9,$();case 9:if(!((n=a.sent)&&n<t)){a.next=17;break}return a.next=13,ne(!0);case 13:return a.next=15,oe();case 15:a.next=18;break;case 17:r&&r<t&&((o=new Date(e.getTime())).setMinutes(e.getMinutes()-6),i=o.kUtilFormat("yyyy-MM-ddTHH:mm:ss.SSSZ"),h<i&&ne().then((function(){return oe()})));case 18:case"end":return a.stop()}}),le)}))),function(){return C.apply(this,arguments)}),s:(k=_asyncToGenerator(_regeneratorRuntime().mark((function he(e,t,r,n){var o;return _regeneratorRuntime().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:if(!t){e.next=32;break}if(e.prev=1,!t.startsWith("{")||!t.endsWith("}")){e.next=8;break}return e.next=5,V(t);case 5:e.t0=e.sent,e.next=9;break;case 8:e.t0=t;case 9:if(!(o=e.t0)){e.next=17;break}return H("bs "+r),e.next=14,p.setItem(r,o);case 14:H("ss "+r),e.next=18;break;case 17:H("ept ecpt");case 18:e.next=22;break;case 20:e.prev=20,e.t1=e["catch"](1);case 22:if(e.t2=n,!e.t2){e.next=28;break}return H("bd "+r),e.next=27,ue(r,2==n);case 27:H("sd "+r);case 28:ce&&clearTimeout(ce),ce=setTimeout(_asyncToGenerator(_regeneratorRuntime().mark((function i(){return _regeneratorRuntime().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,ue();case 2:case"end":return e.stop()}}),i)}))),36e4),e.next=34;break;case 32:return e.next=34,ue(r);case 34:case"end":return e.stop()}}),he,null,[[1,20]])}))),function(e,t,r,n){return k.apply(this,arguments)}),p:se,u:(S=_asyncToGenerator(_regeneratorRuntime().mark((function de(){return _regeneratorRuntime().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,te();case 2:return e.abrupt("return",n);case 3:case"end":return e.stop()}}),de)}))),function(){return S.apply(this,arguments)}),caret:ie}}},Pr.Lib.Uri=jr}();
(function (dynam, nil) {

	"use strict";
	var lib = dynam.Lib,
		win = window,
		_fetch_ver = 20230615;

	if (dynam._fetch_ver) {
		if (dynam._fetch_ver >= _fetch_ver) {
			return;
		}
	}
	dynam._fetch_ver = _fetch_ver;
	
	if(win.fetch) {
		return;
	}

	var bIE6_9 = Dynamsoft.navInfoSync.bIE && (parseInt(Dynamsoft.navInfoSync.strBrowserVersion) <= 9),
		bIE6_10 = Dynamsoft.navInfoSync.bIE && (parseInt(Dynamsoft.navInfoSync.strBrowserVersion) <= 10),
		each = lib.each,
		rlocalProtocol = /^(?:about|app|app\-storage|.+\-extension|file|widget)$/,

		STATE_READY = 1,
		STATE_OK = 2,
		STATE_ABORT = 3,

		OK_CODE = 200,
		NO_CONTENT_CODE = 204,
		MULTIPLE_CHOICES = 300,
		NOT_MODIFIED = 304,
		BAD_REQUEST = 400,
    UN_AUTH_REQUEST = 401,
		FORBIDDEN_REQUEST = 403,
		NOT_FOUND_CODE = 404,
		NO_CONTENT_CODE2 = 1223,
		SERVER_ERR = 500,
    ERR_NAME_NOT_RESOLVED = 12007,
    ERR_CANNOT_CONNECT = 12029,
    ERR_NO_RESPONSE = 2,

		_strOpenErr = 'open error: ',
		_strSendErr = 'send error: ',

		simulatedLocation = new lib.Uri(location.href),
		isLocal = simulatedLocation && rlocalProtocol.test(simulatedLocation.getScheme()),
		XDomainRequest_ = false,//bIE6_9 && win.XDomainRequest,

		createStandardXHR = function () {
			try {
				return new win.XMLHttpRequest();
			} catch (e) {
			}
			// return undefined;
		},

		createActiveXHR = function () {
			try {
				var http = false;
				// code for IE9,IE8,IE7,IE6,IE5
				each(['Msxml2.XMLHTTP.6.0',
					'Msxml2.XMLHTTP',
					'Microsoft.XMLHTTP',
					'Msxml2.XMLHTTP.3.0',
					'Msxml3.XMLHTTP'],
					function (item) {
						try {
              if(!http){
                http = new win.ActiveXObject(item);
                return false;
              }
						}
						catch (e) {
							lib.error('new xhr error: ' + e.message);
						}
					});
				return http;
			} catch (e) {
			}
			// return undefined;
		},

		supportCORS = (!isLocal && win.XMLHttpRequest) ? ('withCredentials' in (createStandardXHR() || [])) : false,

		//Create a xmlHttpRequest object
		_newXhr = win.ActiveXObject ? function (crossDomain) {

			if (bIE6_9)
				return createActiveXHR();

			if (!supportCORS && crossDomain && XDomainRequest_) {
				return new XDomainRequest_();
			}
			return !isLocal && createStandardXHR() || createActiveXHR();

		} : createStandardXHR,

		isInstanceOfXDomainRequest = function (xhr) {
			return XDomainRequest_ && (xhr instanceof XDomainRequest_);
		},

		rnoContent = /^(?:GET|HEAD)$/,
		rheaders = /^(.*?):[ \t]*([^\r\n]*)\r?$/mg,
		accepts = { 'xml': "application/xml, text/xml", 'html': "text/html", 'text': "text/plain", 'json': "application/json, text/javascript", "*": "*/*" },
		nilFun = nil,
		nativeFetch;
	
	// IE<=8 fixed
	if (bIE6_10) {
		nilFun = function(){};
	}

	function _io() { }

	lib.mix(_io.prototype, {

		url: false, //URL to be loaded
		onSuccess: false, //Function that should be called at success
		onError: false, //Function that should be called at error
		onComplete: false,
		method: "GET", //GET or POST	
		async: true, // async or sync
		xhrFields: false,
		mimeType: false,
		username: false,
		password: false,
		data: false,
		dataType: 'text', //Return type - could be 'blob', 'arraybuffer', 'text', 'xml', 'json', 'user-defined'(which is used for acquiring image data from service)
		headers: false,
		contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
		beforeSend: false,
		afterSend: false,
		timeout: 0,		// seconds		default 0 means no timeout
		cache: true,
		crossDomain: false,
		retry: 0,

		setRequestHeader: function (name, value) {
			var self = this;
			self.headers[name] = value;
			return self;
		}, getAllResponseHeaders: function () {
			var self = this;
			return self.state === STATE_OK ? self.responseHeadersString : null;
		}, getNativeXhr: function () {
			var self = this;
			return self.nativeXhr;
		}, getResponseHeader: function (name) {
			var match, self = this, responseHeaders;
			name = name.toLowerCase();
			if (self.state === STATE_OK) {
				if (!(responseHeaders = self.responseHeaders)) {
					responseHeaders = self.responseHeaders = {};
					while ((match = rheaders.exec(self.responseHeadersString))) {
						responseHeaders[match[1].toLowerCase()] = match[2];
					}
				}
				match = responseHeaders[name];
			}
			return match === undefined ? null : match;
		}, overrideMimeType: function (type) {
			var self = this;
			if (!self.state) {
				self.mimeType = type;
			}
			return self;
		}, abort: function (statusText) {
			var self = this;
			statusText = statusText || "abort";

			self.state = STATE_ABORT;
			self.status = 0;
			self.statusText = statusText;

			if (self.nativeXhr) {
				self.nativeXhr.abort();
			}

			self._callback();
			return self;
		}, _ioReady: function (status, statusText) {
			var self = this, isSuccess = false;
			if (self.state === STATE_OK || self.state === STATE_ABORT) {
				return;
			}
			if (self.state === STATE_READY)
				self.state = STATE_OK;
			self.readyState = 4;

			if (status >= OK_CODE && status < MULTIPLE_CHOICES || status === NOT_MODIFIED) {
				if (status === NOT_MODIFIED) {
					statusText = "not modified";
					isSuccess = true;
				} else {
					statusText = "success";
					isSuccess = true;
				}
			} else {
				if (status < 0) {
					status = 0;
				}
			}

			try {
				if (status >= OK_CODE)
					self.handleResponseData();
			} catch (e) {
				lib.error(e.stack || e, "error");
				statusText = e.message || "parser error";
			}
			
			
			if (status < OK_CODE || !isSuccess) {
				if(self.retry > 0) {
					self.retry = self.retry - 1;
					setTimeout(function(){
						self.sendInternal();
					}, 200);
					return;
				}
			}

			self.status = status;
			self.statusText = statusText;
			self._callback(isSuccess);
		},
		_callback: function (isSuccess) {
			var self = this, timeoutTimer = self.timeoutTimer;
			if (timeoutTimer) {
				clearTimeout(timeoutTimer);
				self.timeoutTimer = 0;
			}

			each([isSuccess ? self.onSuccess : self.onError, self.onComplete], function (func) {
				if (lib.isFunction(func)) {
					func.apply(self.context, [self.responseData, self.statusText, self]);
				}
			});

			self.responseData = null;
		},
		handleResponseData: function () {
			var self = this, result, dataType = self.dataType, nativeXhr = self.nativeXhr;

			self.responseText = result = nativeXhr.responseText || '';
			try {
				var xml = nativeXhr.responseXML;
				if (xml && xml.documentElement /*#4958#*/) {
					self.responseXML = xml;
				}
			} catch (e) { }

			self.responseData = result;
		},

		sendInternal: function (opt) {
			//The XMLHttpRequest object is recreated at every call - to defeat Cache problem in IE
			var self = this, c, i,
				method, url, dataType, contentType,
				nativeXhr, xhrFields, mimeType, requestHeaders,
				hasContent, sendContent;

			c = self._setup(opt);

			method = c.method;
			if(lib.isString(method)) {
				method = method.toUpperCase();
			}
			
			contentType = c.contentType;
			
			url = c.url;
			dataType = c.dataType;
			mimeType = c.mimeType;

			if (!lib.isString(url)) return;

			self.nativeXhr = nativeXhr = _newXhr(c.crossDomain);
			if (!nativeXhr) return;

			try {
				self.state = STATE_READY;

				if (c.username) {
					nativeXhr.open(method, url, c.async, c.username, c.password);
				} else {
					nativeXhr.open(method, url, c.async);
				}

				if ((c.async || Dynamsoft.navInfoSync.bIE) && dataType && dataType != 'user-defined' && ('responseType' in nativeXhr)) {
					try {
						nativeXhr.responseType = dataType;
					} catch (e) { }
				}

			} catch (ex) {
				if (self.state < 2) {
					lib.error(ex.stack || ex, "error");
					self._ioReady(-1, _strOpenErr +
						(lib.isNumber(ex.number) ? '(' + ex.number + ')' : '') +
						(ex.message || ''));
				} else {
					lib.error(ex);
				}

				return;
			}

			xhrFields = c.xhrFields || {};
			if ('withCredentials' in xhrFields) {
				if (!supportCORS) {
					delete xhrFields.withCredentials;
				}
			}

			each(xhrFields, function(val, key){
				try {
					nativeXhr[key] = val;
				} catch (e) {
					lib.error(e);
				}
			});

			// Override mime type if supported
			if (mimeType && nativeXhr.overrideMimeType) {
				nativeXhr.overrideMimeType(mimeType);
			}

			requestHeaders = c.headers || {};
			var xRequestHeader = requestHeaders['X-Requested-With'];
			if (xRequestHeader === false) {
				delete requestHeaders['X-Requested-With'];
			}

			// ie<10 XDomainRequest does not support setRequestHeader
			if ('setRequestHeader' in nativeXhr) {

				if (contentType) {
					nativeXhr.setRequestHeader("Content-Type", c.contentType);
				}

				nativeXhr.setRequestHeader("Accept", dataType && accepts[dataType] ? accepts[dataType] + (dataType === "*" ? "" : ", */*; q=0.01") : accepts["*"]);

				
				each(requestHeaders, function(val, key){
					nativeXhr.setRequestHeader(key, val);
				});
			}
			
			if(!c.cache)
			{
				nativeXhr.setRequestHeader('If-Modified-Since', '0');
				nativeXhr.setRequestHeader('Cache-Control', 'no-cache');
			}


			hasContent = !rnoContent.test(c.method);
			sendContent = hasContent && c.data || null;

			if (hasContent && bIE6_9) {
				sendContent = c.data;
			}

			// timeout
			if (c.async && c.timeout > 0) {
				if(c.timeout<300)
					c.timeout=300;
				self.timeoutTimer = setTimeout(function () {
					self.abort("timeout");
				}, c.timeout);
			}

			try {
				self.state = STATE_READY;
				if (lib.isFunction(self.beforeSend)) {
					var r = self.beforeSend(nativeXhr, self);
					if (r === false) {
						self.abort("cancel");
						return;
					}
				}
				nativeXhr.send(sendContent);
				sendContent = null;
				c.data = null;
				if (lib.isFunction(self.afterSend))
					self.afterSend(self);
			} catch (e) {
				if (self.state < 2) {
					lib.error(e.stack || e, "error");
					self._ioReady(-1, _strSendErr + (e.message || ''));
				} else {
					lib.error(e);
				}
			}

			if (!c.async || nativeXhr.readyState === 4) {
				self._xhrCallback();
			} else {
				if (isInstanceOfXDomainRequest(nativeXhr)) {
					nativeXhr.onload = function () {
						nativeXhr.readyState = 4;
						nativeXhr.status = OK_CODE;
						self._xhrCallback();
					};
					nativeXhr.onerror = function () {
						nativeXhr.readyState = 4;
						nativeXhr.status = SERVER_ERR;
						self._xhrCallback();
					};
				} else {
					nativeXhr.onreadystatechange = function () {
						self._xhrCallback();
					};
				}
			}
		},

		_xhrCallback: function (evt, abort) { //Call a function when the state changes.
			var self = this, nativeXhr = self.nativeXhr;

			try {
				if (nativeXhr.readyState === 4 || abort) { //Ready State will be 4 when the document is loaded.
					if (isInstanceOfXDomainRequest(nativeXhr)) {
						nativeXhr.onerror = nilFun;
						nativeXhr.onload = nilFun;
					} else {
						nativeXhr.onreadystatechange = nilFun;
					}

					if (abort) {
						if (nativeXhr.readyState !== 4) {
							nativeXhr.abort();
						}
					} else {

						if (!isInstanceOfXDomainRequest(nativeXhr)) {
							self.responseHeadersString = nativeXhr.getAllResponseHeaders();
						}

						var status = nativeXhr.status, statusText;
						try {
							statusText = nativeXhr.statusText;
						} catch (e) {
							lib.error("xhr statusText error: ");
							lib.error(e);
							statusText = "";
						}

						self._ioReady(status, statusText);
					}
				}

			} catch (e) {
				lib.error(e.stack || e, "error");

				nativeXhr.onreadystatechange = nilFun;
				if (!abort) {
					self._ioReady(-1, e.message || "process error");
				}
			}
		},

		_setup: function (opt) {
			var self = this, dataType, i, requestHeaders, url, uri;

			if(opt) {
				self.context = opt.context;
				delete opt.context;

				if (opt instanceof _io) {
					opt = opt.config;
				}

				self.config = opt;

				url = opt.url;

				if (lib.startsWith(url, 'http://') || lib.startsWith(url, 'https://')) {
					uri = new lib.Uri(url);
				} else {
					if (lib.startsWith(url, '//')) {
						opt.url = url = 'http:' + url;
					}

					uri = simulatedLocation.resolve(url);
				}

				if (!opt.dataType)
					dataType = 'text'; //Default return type is 'text'
				else
					dataType = opt.dataType.toLowerCase();
				opt.dataType = dataType;

				if (!opt.method)
					opt.method = 'GET'; //Default method is GET
				else
					opt.method = opt.method.toUpperCase();

				if (!("crossDomain" in opt)) {
					opt.crossDomain = !uri.isSameOriginAs(simulatedLocation);
				}

				requestHeaders = opt.headers;
				for (i in requestHeaders) {
					if (lib.isUndefined(requestHeaders[i]))
						delete requestHeaders[i];
				}
				lib.mix(self, opt);
			}
			
			self.state = STATE_READY;
			return self;
		}
	});

	// Chrome or Firefox
	if(!nativeFetch) {

		// fetch
		win.fetch = function(url, options){

			// options
			// {
			//    mode:"cors",			  // mode: cors / no-cors / same-origin
			//    method:"post",
			//    body:'',
			//    headers:{
			//      // set send data type for body
			//    	'content-type': 'application/json'
			// 	  },
			//    dataType: 'blob',       // Return type - could be 'blob', 'arraybuffer', 'text', 'json'
			//                            // NOTE: IE<=9 'blob', 'arraybuffer' -> 'user-defined'
			
			//    cache:'reload',         // (not supported) http cache: default / no-store / reload / no-cache / force-cache / only-if-cached
			//    redirect: 'manual',     // (not supported) redirect: follow / error / manual
			//    referrer: 'client',     // (not supported) no-referrer / client / URL (string)
			//    credentials:'include'   // (not supported) if carry cookie: omit/ same-origin / include
			// };

			return new Dynamsoft.Lib.Promise(function(resolutionFunc,rejectionFunc){
				
				var get_ret_obj = function(_bOK, _data, _reason, _io){

          return {
            'ok': _bOK,
            'text': function() {return Dynamsoft.Lib.Promise.resolve(_data);},
            'json': function() {
              var _json;
              if(Dynamsoft.Lib.isString(_data) && _data != '') {
                try{
                  _json = Dynamsoft.Lib.parse(_data);
                }catch(_ex){
                  return Dynamsoft.Lib.Promise.reject({
                    code: -2443,
                    message: 'License server response data error.'
                  });
                }
              } else {
                _json = {};
              }
              return Dynamsoft.Lib.Promise.resolve(_json);
            }
          };

        }, sFun = function(_data, _reason, _io){
					
					resolutionFunc(get_ret_obj(true, _data, _reason, _io));
					
				}, fFun = function(_data, _reason, _io){
          var reason = _reason, status = _io.status;

					if(status == NOT_FOUND_CODE || status == BAD_REQUEST || status == FORBIDDEN_REQUEST || status == UN_AUTH_REQUEST ) {

						resolutionFunc(get_ret_obj(false, _data, _reason, _io));

						return;
					} else if(status == ERR_NAME_NOT_RESOLVED || status == ERR_CANNOT_CONNECT || status == ERR_NO_RESPONSE) {
            reason = 'NetworkError';
          } else {
            var isStr = Dynamsoft.Lib.isString(reason);
            if(!isStr || isStr && reason == '') {
              reason = 'NetworkError';
            }
          }
					
					rejectionFunc({
            'ok': false,
            'code': status,
            'message': reason,
            'httpCode': status, 
            'errorString': reason
          });
				}, cfg = {
					
					url: url,
					onSuccess: sFun,
					onError: fFun,
					contentType: 'text/plain;charset=UTF-8',
					dataType: 'text'
					
				}, bContentTypeInHeaders = false;
				
				if(options) {

					if(options.method) {
						cfg.method = options.method;
					}
					
					if(options.body) {
						cfg.data = options.body;
					}
					
					if(options.headers) {
            if (!cfg.headers) {
              cfg.headers = {};
            }

						each(options.headers, function(val, key){
							if(key.toLowerCase() == 'content-type') {
								bContentTypeInHeaders = true;
							}

							cfg.headers[key] = val;
						});

					}
					
					if(options.dataType) {
						cfg.dataType = options.dataType;
					}

					if(options.contentType) {
						cfg.contentType = options.contentType;
					}
				}
				
				if(bContentTypeInHeaders) {
					cfg.contentType = false;
				}
				
				if(cfg.dataType == 'blob' && bIE6_9) {
					cfg.mimeType = 'text/plain; charset=x-user-defined';
				}
				
				if (!cfg || !lib.isString(cfg.url)) {
					lib.log('the url is error.');
					return; //Return if a url is not provided
				}

				var self = new _io();
				self.sendInternal(cfg);
			});
		};
	}

})(Dynamsoft);
