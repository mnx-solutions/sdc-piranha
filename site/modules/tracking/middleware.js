'use strict';

var config = require('easy-config');
var production = ['pro','production'].indexOf(config.getDefinedOptions().env) !== -1;

module.exports = function execute(scope) {


    var middleware = function(req, res, next) {
        if(!res.locals.jss) {
            res.locals.jss = [];
        }
        if(!scope.config.marketo.accountId && production) {
            req.log.warn('Marketo configuration missing');
        } else {
            res.locals.jss.push('Munchkin.init("'+ scope.config.marketo.accountId +'");');
        }

        if(!scope.config.googleAnalytics.identifier && production) {
            req.log.warn('GoogleAnalytics configuration missing');
        } else {
            var googleAnalytics = 'var _gaq = _gaq || [];'+
                '_gaq.push(["_setAccount", "'+ scope.config.googleAnalytics.identifier +'"]);'+
                '_gaq.push(["_trackPageview"]);'+
                '_gaq.push(["_setDomainName", "'+ scope.config.googleAnalytics.domain +'"]);'+
                '_gaq.push(["_setAllowLinker", true]);'+
                '_gaq.push(["t2._setAccount", "'+ scope.config.googleAnalytics.t2identifier +'"]);'+
                '_gaq.push(["t2._trackPageview"]);'+
                '(function() {'+
                '    var ga = document.createElement("script");'+
                '    ga.type = "text/javascript";'+
                '    ga.async = true;'+
                '    ga.src = ("https:" == document.location.protocol ? "https://ssl" : "http://www") + ".google-analytics.com/ga.js";'+
                '    var s = document.getElementsByTagName("script")[0]; s.parentNode.insertBefore(ga, s);'+
                '}());';

            var GAlink =
                '$(document).ready(function () {' +
                '  $(document).on("mousedown", "a", function (e) {' +
                '    var href = $(this).attr("href");' +
                '    if (e.which == 3) return;' +
                '    if (href && (href.indexOf("joyent.com") > -1 || href.indexOf("github.com") > -1)) {' +
                '      _gaq.push(["_trackEvent", "External Link", href]);' +
                '    }'+
                '  });'+
                '});';
            res.locals.jss.push(googleAnalytics);
            res.locals.jss.push(GAlink);
        }

        return next();
    };

    return middleware;
}