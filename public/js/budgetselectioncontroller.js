angular.module('YNAWB') 
    .controller('BudgetSelectionController', ['$scope', '$http', '$routeParams', 'BudgetDataService', function($scope, $http, $routeParams, budgetDataService) {

        budgetDataService.getBudgetList()
            .then(function(b) {

                var index = 0;
                
                $scope.budgets = _.map(b, function(value, key, list) {

                    var p = _.last(key.split("/"));
                    var title = _.first(p.split("~"));

                    index++;

                    return {
                        title: title,
                        path: encodeURIComponent(key),
                        id: "budget_" + index.toString(),
                        devices: _.map(value, function(v) {
                            return {
                                name: v.name,
                                deviceGuid: v.guid
                            };
                        })
                    };
                });

            });

    }]);