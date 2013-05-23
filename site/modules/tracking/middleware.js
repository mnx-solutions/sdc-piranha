'use strict';

module.exports = function(scope, callback) {


    var middleware = function(req, res, next) {
        if(!scope.config.marketo.accountId) {
            scope.log.fatal('Marketo configuration missing');
        } else {
            if(!res.locals.jss) {
                res.locals.jss = {};
            }
            res.locals.jss['marketo'] = 'Munchkin.init("'+ scope.config.marketo.accountId +'");';
        }

        if(!scope.config.googleAnalytics.identifier) {
            scope.log.fatal('GoogleAnalytics configuration missing');
        } else {

            if(!res.locals.jss) {
                res.locals.jss = {};
            }


            res.locals.jss['ggoogleAnalytics'] = 'var _gaq = _gaq || [];'+
                '_gaq.push(["_setAccount", "'+ scope.config.googleAnalytics.identifer +'"]); // XXX hardcoded'+
                '_gaq.push(["_trackPageview"]);'+
                '(function() {'+
                '    var ga = document.createElement("script");'+
                '    ga.type = "text/javascript";'+
                '    ga.async = true;'+
                '    ga.src = ("https:" == document.location.protocol ? "https://ssl" : "http://www") + ".google-analytics.com/ga.js";'+
                '    var s = document.getElementsByTagName("script")[0]; s.parentNode.insertBefore(ga, s);'+
                '}());';
        }

        return next();
    }

    setImmediate(function () {
        callback(null, middleware);
    });
}