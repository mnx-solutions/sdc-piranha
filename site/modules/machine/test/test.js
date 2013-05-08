

describe("Machine module", function () {
    var $scope;
    beforeEach(function () {
        // load module
        module('JoyentPortal', 'Machine', 'mocks.Machines');


        inject(function ($controller, $rootScope) {
            $scope = $rootScope.$new();
            $controller('Machine.IndexController', {
                $scope: $scope
            });
        });
    });

    it('searches for machines', function () {
        console.log($scope);
    });

    /*
     it('searches for machines', function () {
     expect($scope.machines.length).toEqual(5);
     $scope.machines.push($scope.machines[$scope.machines.length-1]);
     $scope.search();
     expect($scope.machines.length).toEqual(6);
     });

     it('filters machines', function (){
     $scope.searchable = $scope.searchOptions.Name;
     $scope.query = 'Marabu';
     $scope.search();
     expect($scope.filteredMachines.length).toEqual(1);
     });

     it('paginates machines', function (){
     $scope.search();
     expect($scope.pagedMachines.length).toEqual(2);
     $scope.itemsPerPage = 2;
     $scope.search();
     expect($scope.pagedMachines.length).toEqual(3);
     });
     */
});