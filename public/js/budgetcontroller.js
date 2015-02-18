angular.module('YNAWB') 
    .controller('BudgetController', ['$scope', '$routeParams', '$q', 'BudgetDataService', function($scope, $routeParams, $q, budgetDataService) {

        $scope.accountId = $routeParams.account;

        budgetDataService.getBudgetData($scope.accountId)
            .then(function(b) {

                var neededMonthCount = 3;
                var dt = new Date();
                var promises = [];

                //Set our needed scope variables.
                $scope.masterCategories = b.masterCategories;
                $scope.budgetData = [];

                //Just in case we decide to add more columns in the future, use a loop.
                for(var i = 1; i <= neededMonthCount; i++) {
                    promises.push(budgetDataService.getBudgetDataForMonth($scope.accountId, dt.getFullYear(), dt.getMonth() + i));
                }

                //Now go get all of our budget data.
                $q.all(promises)
                    .then(function(budgets) {
                        $scope.budgetData = _.sortBy(budgets, function(b) { return b.summary.date; });;
                    });

            });

    }]);