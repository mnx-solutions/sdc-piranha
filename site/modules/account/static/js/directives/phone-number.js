'use strict';

(function (ng, app) {
    app.directive('phoneNumber', [
        'localization',
        'notification',
        '$q',
        '$http',
        function (localization, notification, $q, $http) {

            return {
                restrict: 'A',
                replace: true,
                scope: {
                    required: '=',
                    number: '=',
                    country: '@',
                    isError: '&',
                    elWidth: '@'
                },
                templateUrl: 'account/static/partials/phone-number.html',
                link: function ($scope) {
                    $scope.plainNumber = '';
                    $scope.areaCode = '';

                    $scope.$watch('plainNumber', function (plainNumber) {
                        if(plainNumber) {
                            $scope.number = $scope.areaCode + plainNumber;
                        }
                    });
                    $scope.$watch('country', function (country) {
                        if(typeof country === 'string' && $scope.countryCodes) {
                            $scope.country = isoToObj(country);
                            return;
                        }

                        if(country) {
                            $scope.areaCode = '+' + country.areaCode;
                            if($scope.plainNumber) {
                                $scope.number = $scope.areaCode + $scope.plainNumber;
                            }
                        } else {
                            $scope.areaCode = '';
                        }
                    });
                    /*var numberWatcher = */$scope.$watch('number', function (number) {
                        if(!number) {
                            return;
                        }

//                        numberWatcher();

                        var tempNumber = number.replace(/[^0-9\+]/g, '');
                        if(tempNumber !== number) {
                            $scope.number = tempNumber;
                        }
                        if(!$scope.countryCodes) {
                            return;
                        }
                        matchCountry(number);
                    });
                    function matchCountry(number) {
                        if(number.indexOf('+') !== 0) {
                            var country = isoToObj($scope.country);
                            $scope.plainNumber = number;
                            $scope.areaCode = '+' + country.areaCode;
                            $scope.number =  $scope.areaCode + number;
                            $scope.country = country;
                            return;
                        }
                        var pureNr = number.substr(1);
                        var i = 1;
                        var areaCode = pureNr.substr(0, i);
                        var found = false;
                        while(i < 4) {
                            var countries = areaCodeMap[areaCode];
                            if(countries) {
                                $scope.areaCode = '+' + areaCode;
                                $scope.plainNumber = pureNr.substr(i);
                                if(countries.length === 1 || countries.indexOf($scope.country) === -1) {
                                    $scope.country = areaCode == 1 ? $scope.country = isoToObj('USA') : countries[0];
                                }
                                found = true;
                                break;
                            }
                            i++;
                            areaCode = pureNr.substr(0, i);
                        }
                        if(!found) {
                            console.error('Couldn\'t find country for nr:', number);
                        }
                    }

                    var areaCodeMap = {};
                    function createAreaCodeMap() {
                        $scope.countryCodes.filter($scope.filterUndefinedAreas).forEach(function (country) {
                            if(!areaCodeMap[country.areaCode]) {
                                areaCodeMap[country.areaCode] = [country];
                            } else {
                                areaCodeMap[country.areaCode].push(country);
                            }
                        });
                    }

                    $scope.filterUndefinedAreas = function (country) {
                        return country.areaCode;
                    };

                    $http.get('account/countryCodes').then(function(data) {
                        $scope.countryCodes = data.data;
                        createAreaCodeMap();
                        if(typeof $scope.country === 'string') {
                            $scope.country = isoToObj($scope.country);
                        }
                        if($scope.number) {
                            matchCountry($scope.number);
                        }
                    });

                    function isoToObj(iso) {
                        if (!$scope.countryCodes){
                            return;
                        }

                        var selected = null;
                        var usa = null;

                        $scope.countryCodes.some(function (el) {
                            if (el.iso3 === 'USA') {
                                usa = el;
                            }

                            if(el.iso3 === iso) {
                                selected = el;
                                return true;
                            }
                        });

                        return selected || usa;
                    };

                    $scope.$watch('elWidth', function (width) {
                        if(width) {
                            $scope.selectStyle = {
                                width: width + 'px'
                            };
                            $scope.inputStyle = {
                                width: width - 75 + 'px'
                            };
                        } else {
                            $scope.selectStyle = {
                                width: '100%'
                            };
                            $scope.inputStyle = {
                                width: '91%'
                            };
                        }
                    });
                }
            };
        }]);
}(window.angular, window.JP.getModule('Account')));