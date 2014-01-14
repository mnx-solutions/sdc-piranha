'use strict';

var fwrule = require('fwrule');
var uuid = require('../../static/vendor/uuid/uuid.js');

module.exports = function(scope, app) {
    app.post('/stringify', function(req, res) {
        req.body.uuid = uuid.v4();

        var rule = '';
        try {
            rule = fwrule.create(req.body).text();
        } catch(e) {}
        res.json({rule: rule});
    });
};