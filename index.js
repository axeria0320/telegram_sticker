const request = require('request');
const fs = require('fs');
const unzip = require('unzip2');
const sharp = require('sharp');
const cheerio = require('cheerio');
const Promise = require('bluebird');
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config.json');

const emojis = [
  '😊',
  '🙂',
  '😋',
  '😺',
  '🐶',
  '🐱',
  '🐰',
  '🦊',
  '🐻',
  '🐼',
  '🐨',
  '🐯',
  '🦁',
  '🐮',
  '🐷',
  '🐵',
  '🐧',
  '🐔',
  '🦋',
];

const langs = [
  'zh-Hant',
  'ja',
  'zh-Hans',
  'en',
  'ko'
];

Promise.config({
  cancellation: true,
});

const bot1 = new TelegramBot(config.token1, {
  polling: true,
  filepath: false
});

const bot2 = new TelegramBot(config.token2);

const userCD = {};
const pendingStickers = {};

bot1.on('message', async (msg) => {
  if (userCD[msg.from.id] !== undefined) {
    if (Date.now() - userCD[msg.from.id] < 300)
      return;
  }
  userCD[msg.from.id] = Date.now();

  console.log(msg);

  try {
    const result = await bot2.getChatMember('@SeanChannel', msg.from.id);

    if (['creator', 'administrator', 'member'].indexOf(result.status) < 0) {
      text = "請先加入 [@SeanChannel](https://t.me/SeanChannel) 後方可使用";
      bot1.sendMessage(msg.chat.id, text, {
        reply_to_message_id: msg.message_id,
        parse_mode: 'Markdown'
      });
      return;
    }
  } catch (error) {
    console.error(error.message);
    text = "請先加入 [@SeanChannel](https://t.me/SeanChannel) 後方可使用";
    bot1.sendMessage(msg.chat.id, text, {
      reply_to_message_id: msg.message_id,
      parse_mode: 'Markdown'
    });
  }

  if (msg.sticker !== undefined) {
    var text = '您的使用者編號: <code>' + msg.from.id + '</code>\n';
    if (msg.sticker.set_name !== undefined) {
      text += '貼圖包編號: <code>' + msg.sticker.set_name + '</code>\n';
      text += '貼圖表符: ' + msg.sticker.emoji + ' (<a href="http://telegra.ph/Sticker-emoji-06-03">編輯</a>)\n';
    }
    text += '貼圖大小: <b>' + msg.sticker.width + '</b>x<b>' + msg.sticker.height + '</b>\n';
    bot1.sendMessage(msg.chat.id, text, {
      reply_to_message_id: msg.message_id,
      parse_mode: 'HTML'
    });
    return;
  }

  if (msg.text === undefined)
    return;

  if (msg.text == '/start edit_emoji') {
    var text = '這邊有教學喔 :D\n';
    text += 'http://telegra.ph/Sticker-emoji-06-03';

    bot1.sendMessage(msg.chat.id, text, {
      reply_to_message_id: msg.message_id
    });
    return;
  }

  if (msg.text == '/start about' || msg.text == '/about') {
    var text = '原始碼: <a href="https://git.io/line">GitHub</a>\n\n';
    text += '別忘了參考我的另一個專案 <a href="https://t.me/Telegreat">Telegreat Desktop</a>\n';
    text += '支援<a href="https://t.me/TelegreatFAQ/8">匯出貼圖連結</a>，效果參見<a href="https://t.me/StickerGroup/67327">這裡</a>\n\n';
    text += '假如您的 LINE 貼圖不希望被轉換，請向<a href="https://t.me/SeanChannel">開發者</a>反應，將會協助加入黑名單\n';
    text += '有任何建議，歡迎至<a href="https://t.me/StickerGroup">貼圖群</a>或是 <a href="https://t.me/AntiLINE">Anti-LINE 群</a>提出';

    bot1.sendMessage(msg.chat.id, text, {
      reply_to_message_id: msg.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '更多小玩意',
              url: 'https://t.me/SeanChannel'
            },
            {
              text: '貼圖匯出工具',
              url: 'https://t.me/Telegreat'
            }
          ]
        ]
      }
    });
    return;
  }

  if (msg.text == '/queue') {
    if (config.admins.indexOf(msg.from.id) > -1) {
      console.log(pendingStickers);
    }
    var text = '目前佇列\n\n';
    for (var id in pendingStickers) {
      if (fs.existsSync('files/' + id + '/metadata')) {
        meta = JSON.parse(fs.readFileSync('files/' + id + '/metadata', 'utf8'));
        text += meta.emoji + ' <a href="https://t.me/addstickers/' + meta.name + '">' + meta.title + '</a>\n';
      } else {
        text += emojis[0] + ' <a href="https://t.me/addstickers/line' + id + '_by_Sean_Bot">UNKNOWN</a>\n';
      }

      if (pendingStickers[id].ec !== undefined) {
        text += '   └ 錯誤次數: <b>' + pendingStickers[id].ec + '</b> 次\n';
      }

      text += ' └ /line_' + id + '\n\n';
    }

    bot1.sendMessage(msg.chat.id, text, {
      parse_mode: 'HTML',
      reply_to_message_id: msg.message_id,
    })
    .catch((error) => {
      console.error('/queue command', error);
    });
    return;
  }

  if (msg.text.match(/\/delete ([0-9]+)/)) {
    if ([
      109780439 // Sean
    ].indexOf(msg.from.id) == -1) {
      bot1.sendMessage(msg.chat.id, '*401 Unauthorized*', {
        parse_mode: 'Markdown',
        reply_to_message_id: msg.message_id
      });
      return;
    }

    const result = await bot1.sendMessage(msg.chat.id, '準備重新下載貼圖包', {
      reply_to_message_id: msg.message_id
    });
    msg.msgId = result.message_id;

    const lid = msg.text.match(/[0-9]+/)[0];
    try {
      const set = await bot2.getStickerSet('line' + lid + '_by_' + config.botName2);

      if (set.stickers.length === 0) {
        downloadPack(msg, lid);
        return;
      }

      console.warn('del sticker from set', lid, set.stickers.length);
      for (var i=0; i<set.stickers.length; i++) {
        await bot2.deleteStickerFromSet(set.stickers[i].file_id);
      }

      downloadPack(msg, lid);
    } catch (error) {
      if (error.message.includes('STICKERSET_INVALID')) {
        console.error('STICKERSET_INVALID', lid);
        try {
          fs.unlinkSync('files/' + lid + '/metadata');
        } catch (err) {
          console.log("delete unlink metadata", err);
        }

        downloadPack(msg, lid);
      } else
        console.error(error);
    }

    return;
  }

  var found = msg.text.match(/^\/start ([A-Za-z0-9+\/=]+)$/);

  if (!found) {
    if (msg.chat.id < 0)
      return;

    var text = '歡迎使用 LINE 貼圖轉換器\n';
    text += '更多訊息請點<a href="https://t.me/Sean_LINE_bot?start=about">這裡</a>\n\n';
    text += '\nℹ️ 本機器人由 <a href="https://t.me/SeanChannel">Sean</a> 提供';

    bot1.sendMessage(msg.chat.id, text, {
      parse_mode: 'HTML',
      reply_to_message_id: msg.message_id,
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '回到主機器人',
              url: 'https://t.me/Sean_LINE_bot?start=back'
            }
          ]
        ]
      }
    });
    return;
  }

  if (msg.from.username === undefined) {
    var text = '請先設定 username 喔 😃';

    bot1.sendMessage(msg.chat.id, text, {
      reply_to_message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '點我看教學',
              url: 'https://t.me/UNameBot?start=Sean_LINE_bot'
            }
          ]
        ]
      }
    });
    return;
  }

  const lid = Buffer.from(found[1], 'base64').toString();

  if (lid.match(/[0-9a-f]{24}/)) {
    if (fs.existsSync('files/' + lid + '/metadata')) {
      const meta = JSON.parse(fs.readFileSync('files/' + lid + '/metadata', 'utf8'));

      text = '<a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a> 已存在';
      bot1.sendMessage(msg.chat.id, text, {
        message_id: msg.msgId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '點我安裝',
                url: 'https://t.me/addstickers/' + meta.name
              }
            ]
          ]
        }
      });
      return;
    }


    const result = await bot1.sendMessage(msg.chat.id, '準備下載表情貼', {
      parse_mode: 'HTML',
      reply_to_message_id: msg.message_id,
    });

    msg.msgId = result.message_id;
    downloadSticon(msg, lid)
    .catch((error) => {
      console.error('dl sticon', error);
      bot1.editMessageText(error, {
        chat_id: msg.chat.id,
        message_id: msg.msgId,
        parse_mode: 'HTML'
      });
    });

    return;
  } else if (lid.match(/^\d{3,}/)) {
    if (!fs.existsSync('files/' + lid)) {
      fs.mkdirSync('files/' + lid);
    }
    if (fs.existsSync('files/' + lid + '/metadata')) {
      const meta = JSON.parse(fs.readFileSync('files/' + lid + '/metadata', 'utf8'));

      text = '<a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a> 已存在';
      bot1.sendMessage(msg.chat.id, text, {
        message_id: msg.msgId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '點我安裝',
                url: 'https://t.me/addstickers/' + meta.name
              }
            ]
          ]
        }
      });
      return;
    }

    var text = '準備下載 <a href="https://store.line.me/stickershop/product/' + lid + '/zh-Hant">此貼圖</a>...';
    bot1.sendMessage(msg.chat.id, text, {
      parse_mode: 'HTML',
      reply_to_message_id: msg.message_id,
      disable_web_page_preview: true
    })
    .then((result) => {
      msg.msgId = result.message_id;
      downloadPack(msg, lid);
    });
  }
});

async function downloadPack(msg, lid) {
  console.log('downloadPack', lid);

  try {
    const dir = await downloadZip(lid);

    fs.appendFile(dir + '/download-pack-' + Date.now(), JSON.stringify(msg), (error) => { console.error(error) });
    console.log('downloadPack unzip', dir);

    if (msg.timestamp > Date.now()) {
      console.log('downloadPack return due to error, ts:', msg.timestamp - Date.now());
      return;
    }

    const meta = JSON.parse(fs.readFileSync(dir + '/metadata', 'utf8'));

    var text = '已取得 <a href="https://store.line.me/stickershop/product/' + lid + '/' + meta['lang'] + '">' + enHTML(meta.title) + '</a> 資訊...\n';
    bot1.editMessageText(text, {
      chat_id: msg.chat.id,
      message_id: msg.msgId,
      parse_mode: 'HTML'
    });

    const sid = meta.stickers[0].id;

    try {
      const sticker = await resizePng(dir, sid);

      console.log('downloadPack resized', sticker);
      if (msg.timestamp > Date.now())
        return;

      const stickerStream = fs.createReadStream(sticker);
      const fileOptions = {
        filename: 'sean-' + sid + '.png',
        contentType: 'image/png',
      };

      try {
        const result = await bot2.createNewStickerSet(msg.from.id, meta.name, meta.title + "  @SeanChannel", stickerStream, meta.emoji, {}, fileOptions);

        fs.writeFileSync(dir + '/metadata', JSON.stringify(meta));
        var text = '建立 <a href="https://store.line.me/stickershop/product/' + lid + '/' + meta['lang'] + '">' + enHTML(meta.title) + '</a> 中...\n';
        bot1.editMessageText(text, {
          chat_id: msg.chat.id,
          message_id: msg.msgId,
          parse_mode: 'HTML'
        });
        uploadBody(msg, lid);
      } catch (error) {
        if (error.message.includes('user not found') || error.message.includes('bot was blocked by the user')) {
          var text = '請確定 <a href="https://t.me/' + config.botName2 + '">已於此啟動過機器人</a>\n';
          bot1.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.msgId,
            disable_web_page_preview: true,
            parse_mode: 'HTML'
          });
          return;
        }

        if (error.message.includes('sticker set name is already occupied')) {
          var text = '發生錯誤，嘗試添加至現有貼圖包\n';
          text += '編號: <code>' + lid + '</code> \n';
          text += '詳細報告: createNewStickerSet\n';
          text += '<pre>' + enHTML(JSON.stringify(error)) + '</pre>';
          bot1.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.msgId,
            disable_web_page_preview: true,
            parse_mode: 'HTML'
          });
          uploadBody(msg, lid, 1);
          return;
        }

        console.error('downloadPack createNewStickerSet err', lid, error);
        var text = '發生錯誤，已中斷下載\n';
        text += '編號: <code>' + lid + '</code> \n';
        text += '詳細報告: createNewStickerSet\n';
        text += '<pre>' + enHTML(JSON.stringify(error)) + '</pre>';
        bot1.editMessageText(text, {
          chat_id: msg.chat.id,
          message_id: msg.msgId,
          disable_web_page_preview: true,
          parse_mode: 'HTML'
        });
      }
    } catch (error) {
      bot1.editMessageText(error, {
        chat_id: msg.chat.id,
        message_id: msg.msgId,
        parse_mode: 'HTML'
      });
    }
  } catch (error) {
    bot1.editMessageText(error, {
      chat_id: msg.chat.id,
      message_id: msg.msgId,
      parse_mode: 'HTML'
    });
  }
}

async function uploadBody(msg, lid, seq = 2) {
  const meta = JSON.parse(fs.readFileSync('files/' + lid + '/metadata', 'utf8'));
  if (meta.emoji === undefined) {
    meta.emoji = emojis[0];
  }

  if (pendingStickers[lid] === undefined) {
    pendingStickers[lid] = {
      cd: 0,
      msg: msg
    };
  }

  if (msg.timestamp === undefined) {
    msg.timestamp = Date.now();
  }

  const dir = 'files/' + lid;
  for (; seq <= meta.stickers.length; seq++) {
    try {
      const sid = meta.stickers[seq-1].id;
      const sticker = await resizePng(dir, sid);

      const stickerStream = fs.createReadStream(sticker);
      const fileOptions = {
        filename: 'sean-' + sid + '.png',
        contentType: 'image/png',
      };

      try {
        const result = await bot2.addStickerToSet(msg.from.id, meta.name, stickerStream, meta.emoji, {}, fileOptions);
        console.log('uploadBody addStickerToSet', lid, seq);

        if (seq == meta.stickers.length) {
          var text = '上傳完成!\n';
          text += '共 <b>' + meta.stickers.length + '</b> 張貼圖\n';
          text += '安裝連結: <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a>\n';
          if (meta.stickerResourceType !== undefined && meta.stickerResourceType !== 'STATIC') {
            text += 'PS. 移植後，動態/有聲貼圖將僅保留圖片';
          }
          bot1.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.msgId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '點我安裝',
                    url: 'https://t.me/addstickers/' + meta.name
                  },
                  {
                    text: '編輯表符',
                    callback_data: 'edit_emoji_' + meta.name
                  }
                ],
                [
                  {
                    text: '分享給朋友',
                    url: 'https://t.me/share/url'
                    + '?url=' + encodeURIComponent('https://t.me/addstickers/' + meta.name)
                    + '&text=' + encodeURIComponent(meta.title + '\n剛出爐的呦~')
                  }
                ]
              ]
            }
          });

          delete pendingStickers[lid];
          meta.okay = true;
          fs.writeFileSync('files/' + lid + '/metadata', JSON.stringify(meta), (error) => { if (error) console.error(error) });
        } else if (Date.now() - msg.timestamp > 300) {
          msg.timestamp = Date.now();
          var text = '上傳 <a href="https://store.line.me/stickershop/product/' + lid + '/' + meta['lang'] + '">' + enHTML(meta.title) + '</a> 中...\n';
          text += prog(seq, meta.stickers.length);
          if (seq / meta.stickers.length >= 0.7) {
            text += '預覽連結: <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a>\n';
          }
          bot1.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.msgId,
            parse_mode: 'HTML'
          });
        }
      } catch(error) {
        console.log('uploadBody addStickerToSet err', lid, sid, error.message);

        var opt = {
          chat_id: msg.chat.id,
          message_id: msg.msgId,
          parse_mode: 'HTML'
        };

        console.log('uploadBody addStickerToSet error msg', error.message);
        if (error.message.includes('user not found') || error.message.includes('bot was blocked by the user')) {
          text = '請確定 <a href="https://t.me/' + config.botName2 + '">已於此啟動過機器人</a>\n';
          text += '點擊 /line_' + lid + ' 重試\n';
          bot1.editMessageText(text, opt);
        } else if (error.message.includes('retry after')) {
          text = '上傳速度太快啦，TG 伺服器要冷卻一下\n';
          text += '將會自動重試\n';
          text += prog(seq, meta.stickers.length);
          text += '貼圖包連結: <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a>\n';
          sec = error.message.substr(46) + 3;

          text += '\n詳細報告: addStickerToSet\n';
          text += '<pre>' + enHTML(JSON.stringify(error)) + '</pre>';
          bot1.editMessageText(text, opt);
        } else if (error.message.includes('STICKERS_TOO_MUCH')) {
          text = '貼圖數量衝破天際啦~\n';
          text += '貼圖包連結: <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a>\n';
          text += '\n詳細報告: addStickerToSet\n';
          text += '<pre>' + enHTML(JSON.stringify(error)) + '</pre>';
          bot1.editMessageText(text, opt);
        } else if (error.message.includes('STICKERSET_INVALID')) {
          console.log('uploadBody invalid set', lid);

          text = '貼圖包疑似被刪除了\n';
          text += '貼圖包連結: <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a>\n';
          text += '\n詳細報告: addStickerToSet\n';
          text += '<pre>' + enHTML(JSON.stringify(error)) + '</pre>';
          bot1.editMessageText(text, opt);

          downloadPack(msg, lid);
        } else {
          text = '發生錯誤，已中斷下載\n';
          text += '編號: <code>' + lid + '</code> \n';
          text += '\n詳細報告: addStickerToSet\n';
          text += '<pre>' + enHTML(JSON.stringify(error)) + '</pre>';
          bot1.editMessageText(text, opt);
        }

        return;
      } // addStickerToSet
    } catch(error) {
      console.log('uploadBody resizePng err', error);
      bot1.editMessageText(error, {
        chat_id: msg.chat.id,
        message_id: msg.msgId,
        parse_mode: 'HTML'
      });

      return;
    } // resizePng
  } // for
}


bot1.on('callback_query', (query) => {
  if (userCD[query.from.id] !== undefined
    && Date.now() - userCD[query.from.id] < 300)
    return;
  userCD[query.from.id] = Date.now();

  if (query.data.startsWith('edit_emoji_')) {
    var text = '點這邊看<a href="http://telegra.ph/Sticker-emoji-06-03">表符修改教學</a>\n\n';
    text += '您的貼圖編號: <code>' + query.data.substr(11) + '</code>\n\n';
    text += '左轉找 @Stickers 機器人';

    bot1.sendMessage(query.message.chat.id, text, {
      reply_to_message_id: query.message.message_id,
      parse_mode: 'HTML'
    });

    bot1.answerCallbackQuery(query.id, {
      text: '您的貼圖編號: ' + query.data.substr(11)
    });
  }
});

async function downloadZip(lid) {
  return new Promise(function(resolve, reject) {
    const dir = 'files/' + lid;
    const zipname = dir + '/file.zip';

    request('http://dl.stickershop.line.naver.jp/products/0/0/1/' + lid + '/iphone/stickers@2x.zip')
    .on('error', function (err) {
      var text = '發生錯誤，已中斷下載\n';
      text += '編號: <code>' + lid + '</code> \n';
      text += '詳細報告: NodeJS <b>request</b> onError\n';
      text += '<pre>' + enHTML(JSON.stringify(err)) + '</pre>';
      return reject(text);
    })
    .pipe(fs.createWriteStream(zipname))
    .on('finish', (result) => {
      const zipStat = fs.statSync(zipname);
      if (zipStat.size < 69) {
        const zipText = fs.readFileSync(zipname);
        var text = '發生錯誤，已中斷下載\n';
        text += '詳細報告: LINE 伺服器提供檔案不正常\n';
        text += '下載內容:\n'
        text += '<pre>' + enHTML(zipText) + '</pre>';
        return reject(text);
      }

      fs.createReadStream(zipname)
      .pipe(unzip.Parse())
      .on('entry', function (entry) {
        var fileName = entry.path;

        if (fileName == 'productInfo.meta') {
          entry.pipe(fs.createWriteStream(dir + '/metadata'));
          return;
        }

        if (/\d+@2x.png/.test(fileName)) {
          entry.pipe(fs.createWriteStream(dir + '/origin-' + fileName.replace('@2x', '')));
          return;
        }

        if (/(\d+_key|tab_(on|off))@2x.png/.test(fileName)) {
          entry.autodrain();
          return;
        }

        entry.pipe(fs.createWriteStream(dir + '/UNKNOWN-' + fileName));
      })
      .on('close', () => {
        // build metadata
        if (!fs.existsSync(dir + '/metadata')) {
          var text = '發生錯誤，已中斷下載\n';
          text += '問題來源: 找不到 <b>metadata</b> (中繼資料) 檔案\n';
          text += '編號: <code>' + lid + '</code> \n';
          return reject(text);
        }

        const meta = JSON.parse(fs.readFileSync(dir + '/metadata', 'utf8'));

        meta.name = 'line' + lid + '_by_' + config.botName2;
        meta.emoji = emojis[Math.floor(Math.random() * emojis.length)];

        if (meta.origin_title === undefined) {
          langs.some(function (val) {
            if (meta['title'][val] !== undefined) {
              meta['lang'] = val;
              return true;
            }
          });

          meta.origin_title = meta.title;
          meta.title = meta['title'][meta.lang];
        }

        fs.writeFileSync(dir + '/metadata', JSON.stringify(meta));

        return resolve(dir);
      })
      .on("error", (err) => {
        var text = '發生錯誤，已中斷下載\n';
        text += '編號: <code>' + lid + '</code> \n';
        text += '詳細報告: fs <b>createReadStream</b> onError\n';
        text += '<pre>' + enHTML(JSON.stringify(err)) + '</pre>';
        return reject(text);
      });
    });
  });
}

async function resizePng(dir, name, q = 100) {
  return new Promise(function(resolve, reject) {
    if (q < 1) {
      var text = '發生錯誤，已中斷下載\n';
      text += '問題來源: resize webp\n';
      text += '編號: <code>' + dir + '</code>, <code>' + name + '</code> \n';
      text += '詳細報告: 檔案過大\n';
      return reject(text);
    }

    const origin = dir + '/origin-' + name + '.png';
    const sticker = dir + '/sticker-' + name + '-' + q + '.png';

    var format = 'webp';
    var tmpFile = dir + '/temp-' + name + '-' + q + '.webp';
    var size = 512;
    if (q < 64) {
      console.log('resize png comp', dir, name, q);
      format = 'jpg';
      tmpFile = dir + '/temp-' + name + '-' + q + '.jpg';
      size = 8 * q;
    }

    var errorF = false;

    sharp(origin)
    .toFormat(format, {
      quality: q
    })
    .resize(size, size)
    .max()
    .toFile(tmpFile)
    .catch((err) => {
      console.error('sharp err 1', dir, name, origin, err);
      errorF = true;

      var text = '發生錯誤，已中斷下載\n';
      text += '問題來源: NodeJS <b>sharp</b> (圖片轉檔工具)\n';
      text += '編號: <code>' + dir + '</code>, <code>' + name + '</code> \n';
      text += '詳細報告: resize webp\n';
      if (err.message != undefined)
        text += '<pre>' + enHTML(err.message) + '</pre>';
      else
        text += '<pre>' + enHTML(err) + '</pre>';
      return reject(text);
    })
    .then((result) => {
      if (errorF) {
        console.error('resizePng', 'error = true', 'stage 1', result);
        return;
      }

      sharp(tmpFile)
      .resize(512, 512)
      .max()
      .png()
      .toFile(sticker)
      .then((result) => {
        if (errorF) {
          console.error('resizePng', 'error = true', 'stage 2', result);
          return;
        }

        var stat = fs.statSync(sticker);
        if (stat.size < 512 * 1000) {
          return resolve(sticker);
        }
        resizePng(dir, name, Math.floor(q*0.8))
        .catch((err) => {
          errorF = true;

          return reject(err + '.');
        })
        .then((sticker) => {
          if (errorF) {
            console.error('resizePng', 'error = true', 'stage 3', result);
            return;
          }

          return resolve(sticker);
        });
      })
      .catch((err) => {
        console.error('sharp err 2', dir, name, origin, tmpFile, err);
        errorF = true;

        var text = '發生錯誤，已中斷下載\n';
        text += '問題來源: NodeJS <b>sharp</b> (圖片轉檔工具)\n';
        text += '編號: <code>' + dir + '</code>, <code>' + name + '</code> \n';
        text += '詳細報告: convert png\n';
        text += '<pre>' + enHTML(err.message) + '</pre>';
        return reject(text);
      });
    })
  });
}

async function downloadSticonItem(eid, seq) {
  return new Promise(function(resolve, reject) {
    const dir = 'files/' + eid;
    const seqStr = ('000' + seq).slice(-3);
    const origin =  dir + '/origin-' + seqStr + '.png';
    const url = 'https://stickershop.line-scdn.net/sticonshop/v1/sticon/' + eid + '/iphone/' + seqStr + '.png';

    console.log('dl Sticon Item', eid, seq);

    request(url)
    .pipe(fs.createWriteStream(origin))
    .on('error', function (err) {
      console.error('downloadSticonItem req', err);
      var text = '發生錯誤，已中斷下載\n';
      text += '編號: <code>' + eid + '</code>, ' + seqStr + '\n';
      text += '詳細報告: NodeJS <b>request</b> onError\n';
      text += '<pre>' + enHTML(JSON.stringify(err)) + '</pre>';
      return reject(text);
    })
    .on('finish', (result) => {
      const stat = fs.statSync(origin);
      if (stat.size < 69) {
        const context = fs.readFileSync(origin);
        var text = '發生錯誤，已中斷下載\n';
        text += '詳細報告: LINE 伺服器提供檔案不正常\n';
        text += '下載內容:\n'
        text += '<pre>' + enHTML(context) + '</pre>';
        return reject(text);
      }
      resizePng(dir, seqStr)
      .then((sticker) => {
        return resolve(sticker);
      })
      .catch((err) => {
        console.log('dl sticon res', err);
        return reject(err.message);
      });
    });
  });
}

async function uploadSticonBody(msg, eid, seq = 2) {
  const meta = JSON.parse(fs.readFileSync('files/' + eid + '/metadata', 'utf8'));
  if (meta.emoji === undefined) {
    meta.emoji = emojis[0];
  }

  if (msg.timestamp === undefined) {
    msg.timestamp = Date.now();
  }

  const dir = 'files/' + eid;
  for (; seq<=40; seq++) {
    try {
      const sticker = await downloadSticonItem(eid, seq);

      const stickerStream = fs.createReadStream(sticker);
      const fileOptions = {
        filename: 'sean-' + eid + '-' + seq + '.png',
        contentType: 'image/png',
      };

      try {
        const result = await bot2.addStickerToSet(109780439, meta.name, stickerStream, meta.emoji, {}, fileOptions);

        if (seq == 40) {
          var text = '上傳完成!\n';
          text += '安裝連結: <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a>\n';
          bot1.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.msgId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '點我安裝',
                    url: 'https://t.me/addstickers/' + meta.name
                  },
                  {
                    text: '編輯表符',
                    callback_data: 'edit_emoji_' + meta.name
                  }
                ],
                [
                  {
                    text: '分享給朋友',
                    url: 'https://t.me/share/url'
                    + '?url=' + encodeURIComponent('https://t.me/addstickers/' + meta.name)
                    + '&text=' + encodeURIComponent(meta.title + '\n剛出爐的呦~')
                  }
                ]
              ]
            }
          });

          meta.okay = true;
          fs.writeFileSync('files/' + eid + '/metadata', JSON.stringify(meta), (error) => { if (error) console.error(error) });
        } else {
          var text = '上傳 <a href="https://store.line.me/emojishop/product/' + eid + '/zh-Hant">' + enHTML(meta.title) + '</a> 中...\n';
          text += prog(seq, 40);
          if (seq >= 30) {
            text += '預覽連結: <a href="https://t.me/addstickers/' + meta.name + '">' + enHTML(meta.title) + '</a>\n';
          }
          bot1.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.msgId,
            parse_mode: 'HTML'
          });
        }
      } catch (error) {
        if (error.response != undefined && error.response.body != undefined)
          console.log('sticon add sticker to set error response body', error.response.body);
        else
          console.log('sticon add sticker to set error', error);

        if (error.message.includes('user not found') || error.message.includes('bot was blocked by the user')) {
          var text = '請確定 <a href="https://t.me/' + config.botName2 + '">已於此啟動過機器人</a>\n';
          bot1.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.msgId,
            disable_web_page_preview: true,
            parse_mode: 'HTML'
          });
          return;
        }

        var text = '發生錯誤，已中斷下載\n';
        text += '編號: <code>' + eid + '</code> \n';
        text += '詳細報告: sticon addStickerToSet\n';
        text += '<pre>' + enHTML(JSON.stringify(error)) + '</pre>';
        bot1.editMessageText(text, {
          chat_id: msg.chat.id,
          message_id: msg.msgId,
          disable_web_page_preview: true,
          parse_mode: 'HTML'
        });

        if (error.message.includes('created sticker set not found')) {
          console.error('created sticon set not found', eid);
          return;
        }
      } // addStickerToSet
    } catch(error) {
      console.log('dl sticon item err', error);
      return;
    }
  }
}

async function downloadSticon(msg, eid) {
  return new Promise(function(resolve, reject) {
    var meta;
    const dir = 'files/' + eid;
    console.log('downloadSticon', eid);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    request('https://store.line.me/emojishop/product/' + eid + '/zh-Hant', (error, response, body) => {
      if (error || response.statusCode !== 200) {
        console.error('sticon meta req', error);
        return reject('err: ' + response.statusCode + error);
      }

      if (fs.existsSync('files/' + eid + '/metadata')) {
        meta = JSON.parse(fs.readFileSync('files/' + eid + '/metadata', 'utf8'));
      } else {
        meta = {
          packageId: eid,
          name: 'line_' + eid.slice(-6) + '_by_' + config.botName2,
          title: cheerio.load(body)("title").text().slice(0, -23),
          emoji: emojis[Math.floor(Math.random() * emojis.length)]
        };
      }

      fs.writeFileSync(dir + '/metadata', JSON.stringify(meta));

      downloadSticonItem(eid, 1)
      .then((sticker) => {
        const stickerStream = fs.createReadStream(sticker);
        const fileOptions = {
          filename: 'sean-' + eid + '-001.png',
          contentType: 'image/png',
        };
        bot2.createNewStickerSet(109780439, meta.name, meta.title + "  @SeanChannel", stickerStream, meta.emoji, {}, fileOptions)
        .then((result) => {
          fs.writeFileSync(dir + '/metadata', JSON.stringify(meta));
          var text = '建立 <a href="https://store.line.me/emojishop/product/' + eid + '/zh-Hant">' + enHTML(meta.title) + '</a> 中...\n';
          bot1.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.msgId,
            parse_mode: 'HTML'
          });
          uploadSticonBody(msg, eid);
        })
        .catch((error) => {
          console.log('sticon new set err', error.response.body);

          if (error.message.includes('user not found') || error.message.includes('bot was blocked by the user')) {
            var text = '請確定 <a href="https://t.me/' + config.botName2 + '">已於此啟動過機器人</a>\n';
            bot1.editMessageText(text, {
              chat_id: msg.chat.id,
              message_id: msg.msgId,
              disable_web_page_preview: true,
              parse_mode: 'HTML'
            });
            return;
          }

          if (error.message.includes('sticker set name is already occupied')) {
            var text = '發生錯誤，嘗試添加至現有貼圖包\n';
            text += '編號: <code>' + eid + '</code> \n';
            text += '詳細報告: createNewStickerSet\n';
            text += '<pre>' + enHTML(JSON.stringify(error)) + '</pre>';
            bot1.editMessageText(text, {
              chat_id: msg.chat.id,
              message_id: msg.msgId,
              disable_web_page_preview: true,
              parse_mode: 'HTML'
            });
            uploadSticonBody(msg, eid, 1);
            return;
          }

          var text = '發生錯誤，已中斷下載\n';
          text += '編號: <code>' + eid + '</code> \n';
          text += '詳細報告: createNewStickerSet\n';
          text += '<pre>' + enHTML(JSON.stringify(error)) + '</pre>';
          bot1.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.msgId,
            disable_web_page_preview: true,
            parse_mode: 'HTML'
          });

          if (error.message.includes('created sticker set not found')) {
            console.error('created sticker set not found', eid);
            return;
          }
        });
      })
      .catch((error) => {
        console.log('dl sticon item err', error);
        return reject(error);
      });
    });
  });
}

function enHTML(str) {
  var s = str + '';
  return s.replace('&', '&amp;')
  .replace('"', '&quot;')
  .replace('<', '&lt;')
  .replace('>', '&gt;');
}

function prog(current, total) {
  if (current > total) {
    current = total;
  }
  const count = 20;
  var str = '進度: <b>' + current + '</b>/' + total + '  <code>[';
  str += '█'.repeat(Math.round(current * count / total))
  str += '-'.repeat(count - Math.round(current * count / total))
  str += ']</code>\n'
  return str;
}
