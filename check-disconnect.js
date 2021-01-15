const querystring = require('querystring');
const https = require('https');
const parse = require('node-html-parser').parse;
const moment = require('moment');

module.exports = {
    /**
     * @param date - different format date
     * @param regions - plm , plr
     * @param street
     */
    checkDisconnect: function (date, regions, street) {
        return new Promise((resolve, reject) => {
            const formattedDate = moment(date).format('DD-MM-YYYY');
            const data = querystring.stringify({
                action: 'pagination_pl',
                seldate: formattedDate
            });
            const req = https.request({
                hostname: 'www.poe.pl.ua',
                path: '/wp-admin/admin-ajax.php',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (resp) => {
                console.log(`check disconnect external statusCode: ${resp.statusCode}`);
                resp.setEncoding('utf8');
                let data = '';

                // A chunk of data has been recieved.
                resp.on('data', (chunk) => {
                    data += chunk;
                });

                // The whole response has been received. Print out the result.
                resp.on('end', () => {
                    try {
                        const result = [];
                        const allData = JSON.parse(data);
                        let rootStr = '<div>';
                        regions.forEach(key => {
                            rootStr += allData[key];
                        })
                        rootStr += '</div>';
                        const root = parse(rootStr);
                        const tables = root.querySelectorAll('table');
                        tables.forEach(table => {
                            const trs = table.querySelectorAll('tr');
                            trs.forEach(tr => {
                                if (tr.innerText.indexOf(street) !== -1) {
                                    const res = []
                                    tr.querySelectorAll('td').forEach(td => {
                                        res.push(td.innerText);
                                    });
                                    result.push(res.join('\n\n'));
                                }
                            });
                        });
                        const resultObj = {};
                        resultObj[formattedDate] = result;
                        resolve(resultObj);
                    } catch (e) {
                        reject(new Error('error end data'));
                    }
                });
            });
            req.on("error", (err) => {
                reject("Error: " + err.message);
            });
            req.write(data);
            req.end();
        });
    },
    checkDisconnectPeriod(startDate, endDate, regions, street) {
        const current = moment(startDate);
        const end = moment(endDate);
        const dates = [];
        while (current.isSameOrBefore(end)) {
            dates.push(current.clone());
            current.add(1, 'days');
        }
        return Promise.all(dates.map(d => this.checkDisconnect(d, regions, street)))
            .then(res => {
                return new Promise((resolve, reject) => {
                    if (res && res.length) {
                        let resultObject = {};
                        res.forEach(stepResult => {
                            if (stepResult) {
                                resultObject = mergeObject(resultObject, stepResult);
                            }
                        });
                        const messages = [];
                        Object.keys(resultObject).forEach(key => {
                            if (resultObject[key] && resultObject[key].length) {
                                Array.prototype.push.apply(messages, resultObject[key].map(x => `Отключение ${key}\n${x}`));
                            }
                        });
                        if (!messages.length) {
                            messages.push(`Отключений с ${dates[0].format('DD-MM-YYYY')} по ${dates[dates.length - 1].format('DD-MM-YYYY')} не найдено`);
                        }
                        resolve(messages);
                    } else {
                        resolve([]);
                    }
                });
            });
    }
}

const mergeObject = (srcObj, targetObj) => {
    // Get all unique keys
    const aSet = new Set([...Object.keys(srcObj), ...Object.keys(targetObj)])
    const mergedObject = {}
    aSet.forEach(k => {
        // Verify if both end of key is an array
        if (Array.isArray(srcObj[k]) && Array.isArray(targetObj[k])) {
            // Concat given array
            mergedObject[k] = srcObj[k].concat(targetObj[k])
        } else {
            // assign target value if present or source value
            mergedObject[k] = targetObj[k] || srcObj[k]
        }
    });
    return mergedObject;
}
