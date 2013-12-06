'use strict';

var crypto = require('crypto');

function getW3CTimestamp(d){

    var year = d.getFullYear();
    var month = d.getMonth() + 1;
    if (month < 10) {
        month = '0' + month;
    }
    var day = d.getDate();
    if (day < 10) {
        day = '0' + day;
    }
    var timeString = d.toTimeString();
    var time = timeString.slice(0, 8);
    var offset = timeString.slice(12, 15);
    return year + '-' + month + '-' + day + ('T' + time + offset + ':00');
}

function MarketoSecurity(clientId, secret) {
    if(!(this instanceof MarketoSecurity)) {
        return new MarketoSecurity(clientId, secret);
    }

    this.clientId = clientId;
    this.secret = secret;
}

MarketoSecurity.prototype.toXML = function () {
    var timestamp = getW3CTimestamp(new Date);
    var signature = crypto.createHmac('sha1', this.secret).update(timestamp + this.clientId).digest('hex');
    return '<tns:AuthenticationHeader>\n    <mktowsUserId>' +
        this.clientId + '</mktowsUserId>\n    <requestSignature>' +
        signature + '</requestSignature>\n    <requestTimestamp>' +
        timestamp + '</requestTimestamp>\n</tns:AuthenticationHeader>';
};

module.exports = MarketoSecurity;