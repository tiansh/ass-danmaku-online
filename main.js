const blobUrl = (function () {
  const urls = [];
  const create = function (content) {
    const encoder = new TextEncoder();
    // Add a BOM to make some ass parser library happier
    const bom = '\ufeff';
    const encoded = encoder.encode(bom + content);
    const blob = new Blob([encoded], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    urls.push(url);
    return url;
  };
  const clear = function () {
    urls.splice(0).forEach(url => {
      URL.revokeObjectURL(url);
    });
  };
  window.addEventListener('beforeunload', event => {
    clear();
  });
  return { create, clear };
}());

const danmakuList = [];

const language = ((() => {
  const prefer = navigator.languages.find(lang => /^(?:en|zh)/.test(lang)) || 'en';
  if (/^zh(?=.*(?:TW|HK|MO|Hant))(?!.*CN|SG|Hans)/.test(prefer)) return 'zh_TW';
  if (/^zh.*/.test(prefer)) return 'zh_CN';
  return 'en';
})());

const i18nText = {
  zh_CN: {
    pageTitle: 'ASS 弹幕在线转换',
    description: '将弹幕文件转换为 ASS 格式。',
    choseFileButton: '选取文件',
    startConvertButton: '开始转换',
    converting: '正在转换……',
    restartButton: '重新开始',
  },
  zh_TW: {
    pageTitle: 'ASS 彈幕線上轉換',
    description: '將彈幕檔案轉換為 ASS 格式。',
    choseFileButton: '選取檔案',
    startConvertButton: '啟動轉換',
    converting: '轉換中……',
    restartButton: '重新開始',
  },
};

const loadOptionPanel = function () {
  const i18n = fetch(`../ass-danmaku/extension/_locales/${language}/messages.json`).then(resp => resp.json());
  const options = fetch(`../ass-danmaku/extension/options/options.html`).then(resp => resp.text());
  Promise.all([i18n, options]).then(async function ([i18n, html]) {
    const panel = new DOMParser().parseFromString(html, 'text/html').getElementById('config_panel');
    const content = panel.content;
    const main = content.querySelector('main');
    const placeholders = Array.from(main.querySelectorAll('span[data-i18n]'));
    placeholders.forEach(span => {
      const key = span.dataset.i18n;
      delete span.dataset.i18n;
      const text = i18n[key].message;
      span.textContent = text;
    });
    const options = await window.options.get();
    const instance = document.importNode(main, true);
    window.options.bindDom(options, instance);
    document.getElementById('config_panel').appendChild(instance);
  });
};

const gotDanmaku = function (danmakuItem) {
  danmakuList.push(danmakuItem);

  const fileItem = document.getElementById('file_item');
  const item = fileItem.content.querySelector('.pending-item');
  const name = item.querySelector('.item-title');
  name.textContent = danmakuItem.meta.name;
  const li = document.importNode(item, true);
  fileItem.parentNode.insertBefore(li, fileItem);

  const startConvert = document.getElementById('convert_button');
  startConvert.removeAttribute('disabled');
};

/**
 * @param {ArrayBuffer} content 
 */
const tryParse = function (content) {
  const parsers = [
    window.danmaku.parser.bilibili,
    window.danmaku.parser.bilibili_xml,
    window.danmaku.parser.niconico,
    window.danmaku.parser.acfun,
    window.danmaku.parser.bahamut,
    window.danmaku.parser.acfun_poll,
    window.danmaku.parser.acfun_v4,
    window.danmaku.parser.himawari,
  ];
  const danmaku = parsers.reduce((result, parser) => {
    let danmaku = [];
    try {
      ({ danmaku } = parser(content));
    } catch (e) {
      // wrong format
    }
    if (danmaku.length > result.length) return danmaku;
    return result;
  }, []);
  return danmaku;
};

/**
 * @param {File[]} files 
 */
const gotFiles = function (files) {
  files.forEach(file => {
    const filename = file.name;
    const name = filename.replace(/^(.+?)(?:\.+[^.]*)?$/, '$1');
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const content = tryParse(reader.result);
      if (!content.length) return;
      gotDanmaku({ meta: { name, url: filename }, content });
    });
    reader.readAsArrayBuffer(file);
  });
};

const convertDanmaku = async function (danmaku) {
  const options = await window.options.get();
  danmaku.layout = await window.danmaku.layout(danmaku.content, options);
  const content = window.danmaku.ass(danmaku, options);
  const url = blobUrl.create(content);
  return url;
};

const addResult = function (danmakuItem) {
  const itemTemplate = document.getElementById('result_item');
  const item = itemTemplate.content.querySelector('.result-item');
  const container = document.importNode(item, true);
  itemTemplate.parentNode.insertBefore(container, itemTemplate);
  return function (url) {
    const linkTemplate = document.getElementById('result_item_link');
    const link = linkTemplate.content.querySelector('.result-link');
    link.href = url;
    link.textContent = danmakuItem.meta.name;
    link.setAttribute('download', window.download.filename(danmakuItem.meta.name, 'ass'));
    container.innerHTML = '';
    container.appendChild(document.importNode(link, true));
  };
};

const listenEvents = function () {
  document.documentElement.addEventListener('drop', event => {
    const files = event.dataTransfer.items ?
      Array.from(event.dataTransfer.items)
        .map(item => item.kind === 'file' ? item.getAsFile() : null)
        .filter(file => file) :
      Array.from(event.dataTransfer.files);
    gotFiles(files);
    event.preventDefault();
  });
  document.documentElement.addEventListener('dragover', event => {
    event.preventDefault();
  });

  const choseFile = document.getElementById('chose_file');
  choseFile.addEventListener('change', function () {
    gotFiles(Array.from(choseFile.files));
    choseFile.value = null;
  });

  const startConvert = document.getElementById('convert_button');
  startConvert.addEventListener('click', async function () {
    if (!danmakuList.length) return;
    const mainArea = document.querySelector('.main-area');
    mainArea.classList.remove('main-area-step1');
    mainArea.classList.add('main-area-step2');
    const list = danmakuList.splice(0);
    for (let i = 0, l = list.length; i < l; i++) {
      list[i].fillLink = addResult(list[i]);
    }
    for (let i = 0, l = list.length; i < l; i++) {
      const url = await convertDanmaku(list[i]);
      list[i].fillLink(url, danmaku);
    }
  });

  const startOver = document.getElementById('finish_button');
  startOver.addEventListener('click', function () {
    blobUrl.clear();
    Array.from(document.querySelectorAll('.pending-item, .result-item')).forEach(element => {
      element.parentNode.removeChild(element);
    });
    const mainArea = document.querySelector('.main-area');
    mainArea.classList.remove('main-area-step2');
    mainArea.classList.add('main-area-step1');

    startConvert.setAttribute('disabled', '');
  });
};

const autoFillI18n = function () {
  document.body.lang = language.replace(/_/, '-');
  if (language === 'en') return;
  const textCollection = i18nText[language];
  document.title = textCollection.pageTitle;
  const observer = new MutationObserver(function () {
    const containerList = Array.from(document.querySelectorAll('[data-i18n]'));
    containerList.forEach(container => {
      const key = container.getAttribute('data-i18n');
      container.removeAttribute('data-i18n');
      const text = textCollection[key];
      if (!text) return;
      container.textContent = text;
    });
  });
  observer.observe(document.body, { subtree: true, childList: true });
};

document.addEventListener('DOMContentLoaded', () => {
  loadOptionPanel();
  listenEvents();
  autoFillI18n();
});

if (/like gecko/i.test(navigator.userAgent)) {
  window.font.text = window.font.textByCanvas();
}


