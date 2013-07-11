'use strict';

window.JP.createModule('timeout', [ 'notification' ])
    .run(function($dialog, $http, localization, $rootScope) {
        var sInteraction = Date.now();
        var uInteraction = Date.now();
        var listening = false;
        var messageBox = null;

        function userTimeout() {
            uInteraction = Date.now();
        }
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

        function updateTimeout() {
            console.log(sInteraction, uInteraction);
            $http.get('timeout/check').success(function () {
                console.log('Updated sTimeout');
            });
        }
        function logout() {
            window.location.href = '/landing/forgetToken';
        }

        function showWarning() {
            listenClick(true);
            var title = localization.translate(
                'timeout',
                null,
                'Warning'
            );
            var question = localization.translate(
                'timeout',
                null,
                'You will be logged out soon.'
            );

            var btns = [
                {
                    result: 'cancel',
                    label: 'Log out',
                    cssClass: 'pull-left'
                },
                {
                    result:'ok',
                    label: 'Keep me logged in',
                    cssClass: 'btn-joyent-blue'
                }
            ];

            messageBox = $dialog.messageBox(title, question, btns)
                .open()
                .then(function (result) {
                    switch(result) {
                        case 'ok':
                            updateTimeout();
                            listenClick();
                            messageBox = null;
                            break;
                        case 'cancel':
                            logout();
                            break;
                    }
                });
        }


        window.JP.set('timeoutRefresh', serverTimeout);


        function checkTimeout() {
            var cInteraction = uInteraction > sInteraction ? uInteraction : sInteraction;
            console.log((Date.now() - sInteraction));
            if(Date.now() - sInteraction > 15 * 60 * 1000) {
                logout();
            } else if(!messageBox && (Date.now() - cInteraction) > (12 * 60 * 1000)) {
                if(uInteraction > sInteraction) {
                    updateTimeout();
                } else {
                    showWarning();
                }
            }
        }
        var interval = setInterval(checkTimeout, 1000);


        setInterval(function () {
            if(uInteraction > sInteraction) {
                updateTimeout();
            }
        }, 60 * 1000);
    });