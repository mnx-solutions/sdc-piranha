'use strict';

module.exports = function (req, res, next) {
    console.log('CheckADMIN'); //TODO: Only allow admins
    next();
};