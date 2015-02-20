angular.module('YNAWB') 
    .controller('SummaryController', ['$scope', '$http', '$routeParams', 'BudgetDataService', function($scope, $http, $routeParams, budgetDataService) {

        $scope.params = budgetDataService.params;

        //We need the above params set before we can pull down our data for the summary sidebar..
        $scope.$watch('params', function() {

            $scope.budget = $scope.params.budget;
            $scope.device = $scope.params.device;
            //$scope.account = $scope.params.account;

            if($scope.params.budget == null || $scope.params.device == null || $scope.params.accountId == null) { return; }

            budgetDataService.getBudgetData($scope.params.budget, $scope.params.device, $scope.params.accountId)
                .then(function(b) {

                    $scope.accounts = _.sortBy(b.accounts, function(a) { return a.accountName; });
                    $scope.defaultAccount = _.first(b.accounts);
                    $scope.budgetFile = "budgetfilehere";

                });

        });

    }]);