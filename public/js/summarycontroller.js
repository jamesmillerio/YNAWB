angular.module('YNAWB') 
    .controller('SummaryController', ['$scope', '$http', '$routeParams', 'BudgetDataService', function($scope, $http, $routeParams, budgetDataService) {

        $scope.params = budgetDataService.params;

        //$scope.accounts = _.sortBy(b.accounts, function(a) { return a.accountName; });
        //$scope.defaultAccount = _.first(b.accounts);

    }]);