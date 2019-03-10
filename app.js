const TelegramBot = require('node-telegram-bot-api');

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TOKEN || '';
console.log(token);
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

const TARIF_AFTER_100 = parseFloat(parseFloat(process.env.TARIF_AFTER_100 || 1.68).toFixed(2));
const TARIF_BEFORE_100 = parseFloat(parseFloat(process.env.TARIF_BEFORE_100 || 0.9).toFixed(2));
const COEFFICIENT_NIGHT = parseFloat(process.env.COEFFICIENT_NIGHT || 0.5);

let activeChats = {};

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
            bot.sendMessage(chatId, 'Ой, ошибока');
            showChoose(chatId);
        }
    } else {
        showChoose(chatId);
    }
});

bot.on('polling_error', (error) => {
    console.log(error);  // => 'EFATAL'
    bot.sendMessage(chatId, 'Ой, ошибока');
});

const calcCommandOne = (chatId) => {
    const value = parseInt(activeChats[chatId].data[0]);
    if (value) {
        let result;
        if (value > 100) {
            result = 100 * TARIF_BEFORE_100 + (value - 100) * TARIF_AFTER_100;
        } else {
            result = value * TARIF_BEFORE_100;
        }

        return bot.sendMessage(chatId, `К оплате: ${result.toFixed(2)} грн.`);
    } else {
        return bot.sendMessage(chatId, 'Ой, ошибока');
    }
};

const calcCommandTwo = (chatId) => {
    const dayValue = parseInt(activeChats[chatId].data[0]);
    const nightValue = parseInt(activeChats[chatId].data[1]);
    if (dayValue && (nightValue || nightValue === 0)) {
        const summary = dayValue + nightValue;
        const dayPercent = roundValue(dayValue / summary, 2);
        const nightPercent = roundValue(nightValue / summary, 2);
        const dayBefore100 = roundValue(100 * dayPercent * TARIF_BEFORE_100, 2);
        const nightBefore100 = roundValue(100 * nightPercent * TARIF_BEFORE_100 * COEFFICIENT_NIGHT, 2);
        const dayAfter100 = roundValue(roundValue((summary - 100) * dayPercent, 0) * TARIF_AFTER_100, 2);
        const nightAfter100 = roundValue(roundValue((summary - 100) * nightPercent, 0) * TARIF_AFTER_100 * COEFFICIENT_NIGHT, 2);

        const result = dayBefore100 + nightBefore100 + dayAfter100 + nightAfter100;

        const md = `
Тариф < 100 КВт: ${TARIF_BEFORE_100.toFixed(2)} грн.
Тариф > 100 КВт: ${TARIF_AFTER_100.toFixed(2)} грн.
Всего:           ${summary} КВт
День:            ${parseInt(dayPercent * 100)} %
Ночь:            ${parseInt(nightPercent * 100)} %
День < 100КВт:   ${dayBefore100.toFixed(2)} грн.
Ночь < 100КВт:   ${nightBefore100.toFixed(2)} грн.
День > 100КВт:   ${dayAfter100.toFixed(2)} грн.
Ночь > 100КВт:   ${nightAfter100.toFixed(2)} грн.
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
                [
                    {
                        text: 'Разбудить',
                        url: 'https://electro-tarif-telegram-bot.herokuapp.com/'
                    }
                ]
            ]
        }
    });
};

const roundValue = (value, digits) => {
    return parseFloat(parseFloat(value).toFixed(digits));
};

const express = require('express');
const app = express();

app.get('/', function (req, res) {
    res.json({ message: 'Ok'});
});

const server = app.listen(process.env.PORT  || 5000, function () {
    const host = server.address().address;
    const port = server.address().port;

    console.log('Web server started at http://%s:%s', host, port);
});
