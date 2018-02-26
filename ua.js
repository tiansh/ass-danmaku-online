/* eslint-disable */

; (function () {
  "use strict";

  var fail = 0, pass = 0;
  var jsTest = function (code) {
    try {
      return eval('' + code) === true;
    } catch (e) {
      return false;
    }
  };
  var cssTest = function () {
    try {
      return CSS.supports.apply(CSS, arguments);
    } catch (e) {
      return false;
    }
  };
  var count = function (success) {
    if (success) pass++; else fail++;
  };

  count(cssTest('display', 'flex')); // flex

  count(jsTest('!!"".padStart&&"".includes&&[].find&&true')); // common methods
  count(jsTest('["a","c"].join`b`==="abc"')); // template string
  count(jsTest('"9753102468".replace(/[0-4]/ug,n=>9-n)==="9756897568"')); // RegExp u flag
  count(jsTest('new Proxy({}, {get(x){return 42}}).theAnswer===42')); // Proxy
  count(jsTest('Promise.reject&&Promise.resolve&&Promise.resolve().then&&!0')); // Promise
  count(jsTest('let f=async x=>x>1?await f(x-1)+await f(x-2):1;true')); // ascyc await
  count(jsTest('try{eval("let a;const a=3;")}catch(e){true}')); // let / const
  count(jsTest('(({a=42},[b=-1])=>a+b==45)({},[3])')); // desctructor

  if (!fail) return;
  var language = navigator.language;
  if (/^zh.*(?:HK|MO|TW)/i.test(language)) {
    alelt('本頁面僅支援 Firefox 52+ 和最新的 Chrome 瀏覽器，可能無法於您的瀏覽器上正常運作。請升級您的瀏覽器。');
  } else if (/^zh/i.test(language)) {
    alert('本网页仅支持 Firefox 52+ 和最新版 Chrome 浏览器，可能无法在您的浏览器上正常工作。请升级您的浏览器。');
  } else {
    alert('This page currently support Firefox 52+, and, most recently Chrome. This page may not work probably on your browser. Please consider to upgrade your browser.');
  }
  
}());