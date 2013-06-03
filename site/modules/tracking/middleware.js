'use strict';

module.exports = function execute(scope) {


    var middleware = function(req, res, next) {
        if(!scope.config.marketo.accountId) {
            req.log.warn('Marketo configuration missing');
        } else {
            if(!res.locals.jss) {
                res.locals.jss = {};
            }
            res.locals.jss.marketo = 'Munchkin.init("'+ scope.config.marketo.accountId +'");';
        }

        if(!scope.config.googleAnalytics.identifier) {
            req.log.warn('GoogleAnalytics configuration missing');
        } else {

            if(!res.locals.jss) {
                res.locals.jss = {};
            }


            res.locals.jss.googleAnalytics = 'var _gaq = _gaq || [];'+
                '_gaq.push(["_setAccount", "'+ scope.config.googleAnalytics.identifier +'"]);'+
                '_gaq.push(["_trackPageview"]);'+
                '_gaq.push(["_setDomainName", "'+ scope.config.googleAnalytics.domain +'"]);'+
                '_gaq.push(["_setAllowLinker", true]);'+
                '(function() {'+
                '    var ga = document.createElement("script");'+
                '    ga.type = "text/javascript";'+
                '    ga.async = true;'+
                '    ga.src = ("https:" == document.location.protocol ? "https://ssl" : "http://www") + ".google-analytics.com/ga.js";'+
                '    var s = document.getElementsByTagName("script")[0]; s.parentNode.insertBefore(ga, s);'+
                '}());';
        }

        return next();
    };

    return middleware;
}