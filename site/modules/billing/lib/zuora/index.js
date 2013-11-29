'use strict';

var soap = require('./soap');

function queryPDF (AccountId, id, callback) {
    var fieldList = [
        'Id',
        'AccountId',
        'InvoiceNumber',
        'InvoiceDate',
        'Body'].join(',');
    var query = 'SELECT ' + fieldList + ' FROM Invoice WHERE Id = \'' + id + '\' AND AccountId = \'' + AccountId + '\'';

    soap.query({queryString: query}, function (err, result) {
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
    setConfig: soap.setConfig.bind(soap),
    connect: soap.connect.bind(soap),
    soap: soap,
    queryPDF: queryPDF
};
