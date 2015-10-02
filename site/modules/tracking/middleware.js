'use strict';

var config = require('easy-config');
var production = config.isProduction();

module.exports = function trackingMiddleware(req, res, next) {
    if (!res.locals.jss) {
        res.locals.jss = [];
    }
    if (config.features.marketo === 'enabled') {
        if (!config.marketo.accountId && production) {
            req.log.warn('Marketo configuration missing');
        } else {
            res.locals.jss.push('Munchkin.init("' + config.marketo.accountId + '");');
        }
    }

    if (config.features.googleAnalytics === 'enabled') {
        if (!config.googleAnalytics.identifier && production) {
            req.log.warn('GoogleAnalytics configuration missing');
        } else {
            var googleAnalytics =
                "(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){" +
                "(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o)," +
                "m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)" +
                "})(window,document,'script','//www.google-analytics.com/analytics.js','ga');" +
                "ga('create', '" + config.googleAnalytics.identifier + "', 'auto', {'allowLinker': true});" +
                "ga('require', 'linkid', 'linkid.js');" +
                "ga('require', 'linker');" +
                "ga('send', 'pageview');" +
                "ga('create', '" + config.googleAnalytics.t2identifier + "', 'auto', {'name': 't2'});" +
                "ga('t2.require', 'linkid', 'linkid.js');" +
                "ga('t2.send', 'pageview');";

            var GAlink =
                '$(document).ready(function () {' +
                '  $(document).on("mousedown", "a", function (e) {' +
                '    var href = $(this).attr("href");' +
                '    if (e.which == 3) return;' +
                '    if (href && (href.indexOf("joyent.com") > -1 || href.indexOf("github.com") > -1)) {' +
                '       ga("send", "event", "External Link", href)' +
                '    }' +
                '  });' +
                '});';

            res.locals.jss.push(googleAnalytics);
            res.locals.jss.push(GAlink);
        }
    }
    var GAHelper =
        'window.gaSend = function(type, category, action, label, value) {' +
        '   window.ga && ga("send", type, category, action, label, value);' +
        '};';
    res.locals.jss.push(GAHelper);

    if (config.features.twitter === 'enabled') {
        var signupTag = config.twitter && config.twitter.signupTag;
        if (!signupTag && production) {
            req.log.warn('Twitter configuration missing');
        } else if (signupTag && req.session.userIsNew) {
            var twitterTagCode = 'window.twttr && twttr.conversion.trackPid("' + signupTag + '");';
            res.locals.jss.push(twitterTagCode);
        }
    }

    return next();
};
