var ynab = angular.module('YNAWB');

ynab.directive('matchViewportHeight', ['$window', function($window) {

    var percentToFloat = function(p) { return parseFloat(p.replace("%")) / 100.0; };
    var elements = [];
    var resizeElements = function () {

        _.each(elements, function(e) {

            var element = angular.element(e.element)[0];
            var height = (e.viewPortResizeAmount * document.documentElement.clientHeight);

            element.style.height = height.toString() + "px";

        });

    };

    //Bind our resize callback
    angular.element($window).bind('resize', resizeElements);

    return {
        restrict: 'A',
        link: function(scope, element, attrs) {

            elements.push({
                element: element,
                viewPortResizeAmount: percentToFloat(attrs.matchViewportHeight)
            });

            //Resize our inital window.
            resizeElements();

        }
    };
    
}]);

ynab.directive('budgetList', function() {

    return {
        restrict: 'E',
        scope: {
            categories: '=',
            budget: '='
        },
        templateUrl: '/views/shared/budgets.html',
        link: function(scope, element, attrs) {

            scope.log = function(l) { console.log(l) };

            scope.totalBudgeted = function(c, b) {
                
                if(b == null) {
                    return 0;
                }

                return _.reduce(c.subCategories, function(memo, sc) {

                    var subCategoryBudget = b.budgets.monthlySubCategoryBudgets[sc.entityId];

                    if(subCategoryBudget == null) {
                        return memo;
                    }

                    return memo + subCategoryBudget.budgeted;

                }, 0);

            };

            scope.totalOutflows = function(c, b) {

                if(b == null) {
                    return 0;
                }

                return _.reduce(c.subCategories, function(memo, sc) {

                    var subCategoryBudget = b.budgets.monthlySubCategoryBudgets[sc.entityId];

                    if(subCategoryBudget == null) {
                        return memo;
                    }

                    return memo + subCategoryBudget.outflowAmount;

                }, 0);
            };

            scope.totalBalance = function(c, b) {

                if(b == null) {
                    return 0;
                }

                return _.reduce(c.subCategories, function(memo, sc) {

                    var subCategoryBudget = b.budgets.monthlySubCategoryBudgets[sc.entityId];

                    if(subCategoryBudget == null) {
                        return memo;
                    }

                    return memo + subCategoryBudget.runningDifference;

                }, 0);

            };

        }
    };

});
