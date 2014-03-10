'use strict';

(function (app) {
    app.factory('$$track', ['$location', '$http', '$cookies', 'loggingService', function ($location, $http, $cookies, loggingService) {

        return {
            event: function (category, action, label) {
                if (typeof _gaq !== 'undefined') {
                    _gaq.push(["_trackEvent", category, action, label || ""]);
                }
            },
            page: function () {
                if (typeof _gaq !== 'undefined') {
                    _gaq.push(['_trackPageview', (window.location.pathname + '#!' + $location.path()).replace(/\/\//,"/")]);
                }
                mktoMunchkinFunction(
                    'visitWebPage',
                    {
                        url: $location.path(),
                        params: ''
                    }
                );
            },
            timing: function (category, variable, time) {
                if (typeof _gaq !== 'undefined') {
                    _gaq.push(['_trackTiming', category, variable, time]);
                }
            },
            //create marketing lead in marketo
            marketing_lead: function (account) {
                var enc_email = '';
                $http.get('/tracking/sha/' + account.email).success(function (data, status) {
                    enc_email = data;
                    var marketoData = {
                        Email:             account.email,
                        CAPI_UUID__c_lead: account.id || '',
                        Campaign_ID__c:    $cookies.campaignId || '70180000000ShEu'
                    };
                    mktoMunchkinFunction('associateLead', marketoData, enc_email);
                    loggingService.log('debug', 'Associate Marketo lead from client', marketoData);
                });
            },
            //inform marketo about machine provisioned
            marketo_machine_provision: function(account) {
                //NO http(s):// in the url, use relative paths to the current domain!
                mktoMunchkinFunction(
                    'visitWebPage',
                    {
                        url: '/main/#!/compute/create/success',
                        params: 'email=' + account.email
                    }
                );
            },
            //inform marketo about pageview
            marketo_pageview: function () {
                //NO http(s):// in the url, use relative paths to the current domain!
                mktoMunchkinFunction(
                    'visitWebPage',
                    {
                        url: $location.path(),
                        params: ''
                    }
                );
            },
            //inform marketo about link clicked
            marketo_clicklink: function () {
                //NO http(s):// in the link, use relative paths to the current domain!
                mktoMunchkinFunction(
                    'clickLink',
                    {
                        href: $location.path()
                    }
                );
            }
        }
    }]);

}(window.JP.getModule('Tracking')));
