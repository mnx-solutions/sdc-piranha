'use strict';

var pkg = require('./data/packages.json');

module.exports = function execute(scope) {

    var server = scope.api('Server');
    var Marketo = scope.api('Marketo');

    server.onCall('SupportListPackages', function (call) {
        call.done(null, pkg);
    });

    server.onCall('SupportCallSales', function (call) {
        call.req.log.info('Request Call Sales ' + call.data);
    });

    server.onCall('SupportTracking', function (call) {
        var data = call.data;
        var marketoData = data.marketo;
        Marketo.update(data.id, marketoData, function (err) {
            if (err) {
                call.log.error({error: err, data: marketoData}, 'Failed to update marketo account');
                call.done(null);
            }
            call.log.debug(marketoData, 'Associate Marketo lead with SOAP API');
            call.done(null, marketoData);
        });
    });
}