const moment = require('moment');
const checkDisconnectModule = require('./check-disconnect');
const app = require('./app');
const mailingIds = [];
if (process.env.MAILING_IDS) {
    Array.prototype.push.apply(mailingIds, process.env.MAILING_IDS.split(','));
}
const MAILING_STREET = process.env.MAILING_STREET || 'Гоголя';
const MAILING_REGIONS = process.env.MAILING_REGIONS || 'plm'

checkDisconnectModule.checkDisconnectPeriod(moment(), moment().add(2, 'days'), MAILING_REGIONS.split(';'), MAILING_STREET)
    .then(messages => {
        const allMessages = [];
        mailingIds.forEach(id => {
            Array.prototype.push.apply(allMessages, messages.map(m => app.botApp.sendMessage(id, m)));
        });
        return Promise.all(allMessages);
    })
    .catch(error => {
        console.log(error);
        process.exit();
    }).finally(() => {
    process.exit();
});
