angular.module('YNAWB') 
    .controller('BudgetController', ['$scope', '$http', function($scope, $http) {

        $http.get("/budgetdata")
            .success(function(b) {

                /*  We only want dates from the current
                    month and two months out. We also want
                    them in a specific format. */
                var now = new Date();
                var neededBudgets = _.map([ 
                    new Date(now.getFullYear(), now.getMonth(), 1),
                    new Date(now.getFullYear(), now.getMonth() + 1, 1),
                    new Date(now.getFullYear(), now.getMonth() + 2, 1),
                ], function(d) { 
                    return d.toYNABDate(); 
                });

                //Do some filtering for future use
                $scope.monthlyBudgets = _.filter(b.monthlyBudgets, function(budget) { return _.contains(neededBudgets, budget.month); });
                $scope.masterCategories = _.filter(b.masterCategories, function(c) { return c.sortableIndex > 0 && (!c.hasOwnProperty("isTombstone") || !c.isTombstone); });

                //Map our master categories with only sub categories that .
                $scope.masterCategories = _.map($scope.masterCategories, function(c) {

                    c.subCategories = _.filter(c.subCategories, function(c2) {

                        return !c2.hasOwnProperty("isTombstone") || !c2.isTombstone;

                    });

                    return c;

                });

                console.log($scope.monthlyBudgets);

                window.budget = b;

            });

    }]);