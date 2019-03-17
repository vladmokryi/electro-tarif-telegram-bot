const TelegramBot = require('node-telegram-bot-api');

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TOKEN || '';
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true, webHook: {port: process.env.PORT}});

const TARIF_AFTER_100 = parseFloat(parseFloat(process.env.TARIF_AFTER_100 || 1.68).toFixed(2));
const TARIF_BEFORE_100 = parseFloat(parseFloat(process.env.TARIF_BEFORE_100 || 0.9).toFixed(2));
const COEFFICIENT_NIGHT = parseFloat(process.env.COEFFICIENT_NIGHT || 0.5);

let activeChats = {};

bot.setWebHook(process.env.WEBHOOK_URL);

bot.on('callback_query', query => {
    const chatId = query.message.chat.id;

    if (query.data === '1') {
        bot.sendMessage(chatId, 'Введите количество КВт').then(function (data) {
            activeChats[chatId] = {
                type: query.data,
                step: 1,
                data: []
            };
        });
    } else if (query.data === '2') {
        bot.sendMessage(chatId, 'Введите количество КВт за день').then(function (data) {
            activeChats[chatId] = {
                type: query.data,
                step: 1,
                data: []
            };
        });
    }
});

bot.on('message', (msg) => {
    console.log(`Message from ${msg.from.first_name} ${msg.from.last_name} - ${msg.text}`);
    const chatId = msg.chat.id;
    if (activeChats[chatId]) {
        activeChats[chatId].data.push(msg.text);
        if (activeChats[chatId].type === '1') {
            calcCommandOne(chatId).then(() => showChoose(chatId));
        } else if (activeChats[chatId].type === '2') {
            if (activeChats[chatId].step === 1) {
                bot.sendMessage(chatId, 'Введите количество КВт за ночь').then(function (data) {
                    activeChats[chatId].step = 2;
                });
            } else {
                calcCommandTwo(chatId).then(() => showChoose(chatId));
            }
        } else {
            //not defined
            handleError(new Error("Callback value on active chat not defined"), chatId);
        }
    } else {
        showChoose(chatId);
    }
});

bot.on('polling_error', (error) => {
    handleError(error);
});

const handleError = (error, chatId) => {
    console.log(error);
    if (chatId) {
        bot.sendMessage(chatId, 'Ой, ошибочка');
        showChoose(chatId);
    }
};

const calcCommandOne = (chatId) => {
    const value = parseInt(activeChats[chatId].data[0]);
    if (value) {
        let result = calcCommandOneResult(value);

        return bot.sendMessage(chatId, `К оплате: ${result.toFixed(2)} грн.`);
    } else {
        return bot.sendMessage(chatId, 'Ой, ошибока');
    }
};

const calcCommandOneResult = (value) => {
    if (value > 100) {
        return 100 * TARIF_BEFORE_100 + (value - 100) * TARIF_AFTER_100;
    } else {
        return value * TARIF_BEFORE_100;
    }
};

const calcCommandTwo = (chatId) => {
    const dayValue = parseInt(activeChats[chatId].data[0]);
    const nightValue = parseInt(activeChats[chatId].data[1]);
    if (dayValue && (nightValue || nightValue === 0)) {
        const summary = dayValue + nightValue;
        const dayPercent = roundValue(dayValue / summary, 2);
        const nightPercent = roundValue(nightValue / summary, 2);
        let dayBefore100, nightBefore100, dayAfter100KW, dayAfter100, nightAfter100KW, nightAfter100, dayBefore100KW,
            nightBefore100KW;
        if (summary >= 100) {
            dayBefore100KW = roundValue(100 * dayPercent, 0);
            dayBefore100 = roundValue(dayBefore100KW * TARIF_BEFORE_100, 2);
            nightBefore100KW = roundValue(100 * nightPercent, 0);
            nightBefore100 = roundValue(nightBefore100KW * TARIF_BEFORE_100 * COEFFICIENT_NIGHT, 2);
            dayAfter100KW = dayValue - dayBefore100KW;
            dayAfter100 = roundValue(dayAfter100KW * TARIF_AFTER_100, 2);
            nightAfter100KW = nightValue - nightBefore100KW;
            nightAfter100 = roundValue(nightAfter100KW * TARIF_AFTER_100 * COEFFICIENT_NIGHT, 2);
        } else {
            dayBefore100KW = roundValue(summary * dayPercent, 0);
            dayBefore100 = roundValue(dayBefore100KW * TARIF_BEFORE_100, 2);
            nightBefore100KW = roundValue(summary * nightPercent, 0);
            nightBefore100 = roundValue(nightBefore100KW * TARIF_BEFORE_100 * COEFFICIENT_NIGHT, 2);
            dayAfter100KW = 0;
            dayAfter100 = 0;
            nightAfter100KW = 0;
            nightAfter100 = 0;
        }

        const result = dayBefore100 + nightBefore100 + dayAfter100 + nightAfter100;
        const resultCommandOne = calcCommandOneResult(summary);

        const md = `
Тариф < 100 КВт:      ${TARIF_BEFORE_100.toFixed(2)} грн.
Тариф > 100 КВт:      ${TARIF_AFTER_100.toFixed(2)} грн.
---
Всего:                ${summary} КВт
День:                 ${roundValue(dayPercent * 100, 0)} %
Ночь:                 ${roundValue(nightPercent * 100, 0)} %
День < 100КВт:        ${dayBefore100KW} КВт - ${dayBefore100.toFixed(2)} грн.
Ночь < 100КВт:        ${nightBefore100KW} КВт - ${nightBefore100.toFixed(2)} грн.
День > 100КВт:        ${dayAfter100KW} КВт - ${dayAfter100.toFixed(2)} грн.
Ночь > 100КВт:        ${nightAfter100KW} КВт - ${nightAfter100.toFixed(2)} грн.
---
Экономия:             ${resultCommandOne - result} грн. (${(100 - ((100 * result) / resultCommandOne)).toFixed(0)}%)
        `;
        bot.sendMessage(chatId, md, {parse_mode: 'Markdown'});

        return bot.sendMessage(chatId, `К оплате: *${result.toFixed(2)}* грн.`, {parse_mode: 'Markdown'});
    } else {
        return bot.sendMessage(chatId, 'Ой, ошибока');
    }
};

const showChoose = (chatId) => {
    delete activeChats[chatId];
    bot.sendMessage(chatId, 'Выберите функцию:', {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'Просчет тарифа для 1 зонного счетчика',
                        callback_data: '1'
                    }
                ],
                [
                    {
                        text: 'Просчет тарифа для 2 зонного счетчика',
                        callback_data: '2'
                    }
                ],
                // [
                //     {
                //         text: 'Разбудить',
                //         url: 'https://electro-tarif-telegram-bot.herokuapp.com/'
                //     }
                // ]
            ]
        }
    });
};

const roundValue = (value, digits) => {
    return parseFloat(parseFloat(value).toFixed(digits));
};

const express = require('express');
const app = express();
const path = require('path');

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

const server = app.listen(process.env.PORT || 5000, function () {
    const host = server.address().address;
    const port = server.address().port;

    console.log(`Web server started at http://${host}:${port}`, host, port);
});
