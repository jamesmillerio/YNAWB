angular.module('YNAWB') 
    .controller('SummaryController', ['$scope', '$http', '$routeParams', 'BudgetDataService', function($scope, $http, $routeParams, budgetDataService) {

        budgetDataService.getBudgetData()
            .then(function(b) {

                $scope.accounts = _.sortBy(b.accounts, function(a) { return a.accountName; });
                $scope.defaultAccount = _.first(b.accounts);
                $scope.budgetFile = "budgetfilehere";

            });

    }]);