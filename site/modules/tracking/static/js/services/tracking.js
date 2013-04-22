'use strict';

(function (app) {
    app.factory('$$track', ['$location', '$http', function ($location, $http) {

        return {
            event: function (category, action, label) {
                _gaq.push(["_trackEvent", category, action, label || ""])
            },
            page: function () {
                _gaq.push(['_trackPageview', $location.path()]);
            },
            timing: function (category, variable, time) {
                _gaq.push(['_trackTiming', category, variable, time]);
            },
            marketing_lead: function (account) {
                var enc_email = '';
                $http.get('/main/marketo/sha/' + account.email).success(function (data, status) {
                    enc_email = data;
                    //TODO: username was on the wish list also
                    //TODO: campaign id propagation
                    mktoMunchkinFunction(
                        'associateLead',
                        {
                            Email:             account.email,
                            FirstName:         account.firstName,
                            LastName:          account.lastName,
                            Company:           account.companyName || '--',
                            CAPI_UUID__c:      account.id || '',
                            Campaign_ID__c:    123456789
                        },
                        enc_email
                    );
                });
            }
        }
    }]);

}(window.JP.getModule('Tracking')));
