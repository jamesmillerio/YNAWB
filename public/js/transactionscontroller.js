angular.module('YNAWB') 
    .controller('TransactionsController', ['$scope', '$routeParams', '$q', 'BudgetDataService', function($scope, $routeParams, $q, budgetDataService) {

        $scope.transactions = null;

        $scope.budget = $routeParams.budget;
        $scope.device = $routeParams.device;
        $scope.accountId = $routeParams.account;

        budgetDataService.getBudgetData($scope.budget, $scope.device, $scope.accountId)
            .then(function(b) {

                //Set our needed scope variables.
                $scope.transactions = b.transactions;
                $scope.checkAll = false;

                $scope.toggleCheckAll = function() { $scope.checkAll = !$scope.checkAll; };

            });

    }]);