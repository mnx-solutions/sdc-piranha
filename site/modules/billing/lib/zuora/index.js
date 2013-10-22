'use strict';

var soap = require('./soap');

function connect(config, callback) {
    soap.connect(config, callback);
}

function queryPDF (AccountId, id, callback) {
    var fieldList = [
        'Id',
        'AccountId',
        'InvoiceNumber',
        'Body'].join(',');
    var query = 'SELECT ' + fieldList + ' FROM Invoice WHERE Id = \'' + id + '\' AND AccountId = \'' + AccountId + '\'';

    soap.query({'queryString': query}, function (err, result) {
        console.log(arguments);
        if(err) {
            callback(err);
            return;
        }
        if(!result.done || !result.records || !result.records[0] || !result.records[0].Body) {
            callback(new Error('Unexpected response from zuora'));
            return;
        }
        callback(null, result.records[0]);
    });
}

module.exports = {
    connect: connect,
    soap: soap,
    queryPDF: queryPDF
};
