'use strict';

(function (app) {
    app.factory('$$track', ['$rootScope', '$location', '$http', '$cookies', 'loggingService', function ($rootScope, $location, $http, $cookies, loggingService) {

        return {
            event: function (category, action, label) {
                window.gaSend('event', category, action, label || '');
            },
            page: function () {
                window.gaSend('pageview', (window.location.pathname + '#!' + $location.path()).replace(/\/\//, "/"));
                window.mktoMunchkinFunction(
                    'visitWebPage',
                    {
                        url: $location.path(),
                        params: ''
                    }
                );
            },
            timing: function (category, variable, time) {
                window.gaSend('timing', category, variable, time);
            },
            //create marketing lead in marketo
            marketing_lead: function (account) {
                var enc_email = '';
                $http.get('/tracking/sha/' + account.email).success(function (data) {
                    enc_email = data;
                    var marketoData = {
                        Email:             account.email,
                        CAPI_UUID__c_lead: account.id || ''
                    };
                    $http.get('billing/campaign').then(function (code) {
                        marketoData.Campaign_ID__c = $cookies.campaignId || code.data.campaignId;
                        window.mktoMunchkinFunction('associateLead', marketoData, enc_email);
                        $rootScope.$emit('trackingSuccess');
                        loggingService.log('debug', 'Associate Marketo lead from client', marketoData);
                    });
                });
            },
            //inform marketo about machine provisioned
            marketo_machine_provision: function (account) {
                //NO http(s):// in the url, use relative paths to the current domain!
                window.mktoMunchkinFunction(
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
                window.mktoMunchkinFunction(
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
                window.mktoMunchkinFunction(
                    'clickLink',
                    {
                        href: $location.path()
                    }
                );
            }
        };
    }]);

}(window.JP.getModule('Tracking')));
