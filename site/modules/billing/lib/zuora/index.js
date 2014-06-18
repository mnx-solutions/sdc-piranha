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

    soap.query(query, function (err, result) {
        if (err) {
            callback(err);
            return;
        }
        if (!result || !result[0] || !result[0].Body) {
            callback(new Error('Unexpected response from zuora'));
            return;
        }
        callback(null, result[0]);
    });
}

module.exports = {
    soap: soap,
    queryPDF: queryPDF
};
