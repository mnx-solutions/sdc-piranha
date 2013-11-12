'use strict';

window.JP.createModule('timeout', [ 'notification' ])
    .run(function($dialog, $http, localization) {
        var sInteraction = Date.now();
        var uInteraction = Date.now();
        var listening = false;
        var messageBox = null;

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
            $http.get('timeout/check').success(function () {
                console.log('Updated sTimeout');
            });
        }
        function logout() {
            window.location.href = '/landing/forgetToken';
        }

        //Create a dialog to show to the user allowing them to keep the session alive
        function showWarning() {
            listenClick(true); // Stop listening to clicks otherwise session continuing would be default
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
                    cssClass: 'grey_new'
                },
                {
                    result:'ok',
                    label: 'Keep me logged in',
                    cssClass: 'orange'
                }
            ];

            messageBox = $dialog.messageBox(title, question, btns)
                .open()
                .then(function (result) {
                    switch(result) {
                        case 'ok':
                            //User opted to stay logged in so refresh server session and start listening to clicks
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
            var cInteraction = uInteraction > sInteraction ? uInteraction : sInteraction; //Use the latest interaction
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
        setInterval(checkTimeout, 1000);


        //Check if we need to update server session every minute
        setInterval(function () {
            if(uInteraction > sInteraction) {
                updateTimeout();
            }
        }, 60 * 1000);
    });