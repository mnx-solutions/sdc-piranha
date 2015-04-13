'use strict';

module.exports = function (app) {
    app.get('/check', function (req, res) {
        res.sendStatus(200).send('OK');
    });
};
