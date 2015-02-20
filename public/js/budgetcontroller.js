angular.module('YNAWB') 
    .controller('BudgetController', ['$scope', '$routeParams', '$q', 'BudgetDataService', function($scope, $routeParams, $q, budgetDataService) {

        $scope.params = budgetDataService.params;

        $scope.params.budget = $routeParams.budget;
        $scope.params.device = $routeParams.device;
        $scope.params.accountId = $routeParams.account;

        budgetDataService.getBudgetData($scope.params.budget, $scope.params.device, $scope.params.accountId)
            .then(function(b) {

                var neededMonthCount = 3;
                var dt = new Date();
                var year = dt.getFullYear();
                var month = dt.getMonth();
                var promises = [];

                //Set our needed scope variables.
                $scope.masterCategories = b.masterCategories;
                $scope.budgetData = [];

                //Just in case we decide to add more columns in the future, use a loop.
                for(var i = 1; i <= neededMonthCount; i++) {
                    var p = budgetDataService.getBudgetDataForMonth($scope.params.budget, $scope.params.device, $scope.accountId, year, month + i);
                    promises.push(p);
                }

                //Now go get all of our budget data.
                $q.all(promises)
                    .then(function(budgets) {
                        $scope.budgetData = _.sortBy(budgets, function(b) { return b.summary.date; });;
                    });

            });

    }]);