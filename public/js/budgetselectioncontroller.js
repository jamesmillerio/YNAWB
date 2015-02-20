angular.module('YNAWB') 
    .controller('BudgetSelectionController', ['$scope', '$http', '$routeParams', 'BudgetDataService', function($scope, $http, $routeParams, budgetDataService) {

        budgetDataService.getBudgetList()
            .then(function(b) {

                var index = 0;
                
                $scope.budgets = _.map(b, function(value, key, list) {

                    var p = _.last(key.split("/"));
                    var file = p.split("~");
                    var title = _.first(file);
                    var id = _.first(_.last(file).split("."));

                    index++;

                    return {
                        title: title,
                        path: id,
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