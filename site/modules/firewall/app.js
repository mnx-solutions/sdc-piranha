'use strict';

var fwrule = require('fwrule');
var uuid = require('../../static/vendor/uuid/uuid.js');

module.exports = function(app) {
    app.post('/stringify', function(req, res) {
        req.body.uuid = uuid.v4();

        var rule = '';
        try {
            rule = fwrule.create(req.body).text();
        } catch (e) {
            req.log.debug(e, 'Error while stringifing fw rule');
        }
        res.json({rule: rule});
    });
};