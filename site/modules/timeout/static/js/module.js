'use strict';

window.JP.createModule('timeout', [ 'notification' ])
    .run(function(PopupDialog, $http, localization, Account) {
        var sInteraction = Date.now();
        var uInteraction = Date.now();
        var listening = false;
        var messageBox = null;
        var warningTimeout = 105;
        var overallTimeout = 120;

        function userTimeout() {
            uInteraction = Date.now();
        }
        //Toggle listening for clicks anywhere on screen to see if user is active
        function listenClick(stop) {
            if(stop && listening) {
                window.jQuery('body').off('click', userTimeout);
                listening = false;
            } else if(!listening && !stop) {
                window.jQuery('body').on('click', userTimeout);
                listening = true;
            }
        }
        listenClick();
        function serverTimeout() {
            sInteraction = Date.now();
            listenClick();
        }

        //Create a call to server to keep session from timing out
        function updateTimeout() {
           if (window.navigator.onLine) {
                $http.get('timeout/check');
           }
        }
        function logout() {
            window.location.href = '/landing/forgetToken';
        }

        //Create a dialog to show to the user allowing them to keep the session alive
        function showWarning() {
            listenClick(true); // Stop listening to clicks otherwise session continuing would be default
            messageBox = true;
            var opts = {
                title: localization.translate(
                    'timeout',
                    null,
                    'Warning'
                ),
                question: localization.translate(
                    'timeout',
                    null,
                    'You will be logged out soon.'
                ),
                btns: [
                    {
                        result: 'cancel',
                        label: 'Log out',
                        cssClass: 'btn grey',
                        setFocus: false
                    },
                    {
                        result: 'ok',
                        label: 'Keep me logged in',
                        cssClass: 'btn orange',
                        setFocus: true
                    }
                ]
            };
            PopupDialog.custom(
                opts,
                function (result) {
                    if (result === 'cancel') {
                        logout();
                    }
                    //User opted to stay logged in so refresh server session and start listening to clicks
                    updateTimeout();
                    listenClick();
                    messageBox = null;
                }
            );
        }


        window.JP.set('timeoutRefresh', serverTimeout);

        Account.getAccount(true).then(function (account) {
            if (account.tfaEnabled) {
                warningTimeout = 12;
                overallTimeout = 15;
            }
        });

        function checkTimeout() {
            var cInteraction = uInteraction > sInteraction ? uInteraction : sInteraction; //Use the latest interaction
            if(Date.now() - sInteraction > overallTimeout * 60 * 1000) {
                logout();
            } else if(!messageBox && (Date.now() - cInteraction) > (warningTimeout * 60 * 1000)) {
                if(uInteraction > sInteraction) {
                    updateTimeout();
                } else {
                    showWarning();
                }
            }
        }
        setInterval(checkTimeout, 1000);

        //Check if we need to update server session every minute
        setInterval(function () {
            if(uInteraction > sInteraction) {
                updateTimeout();
            }
        }, 60 * 1000);
    });