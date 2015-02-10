angular.module('YNAWB') 
    .directive('matchViewportHeight', ['$window', function($window) {

        var percentToFloat = function(p) { return parseFloat(p.replace("%")) / 100.0; };
        var elements = [];

        angular.element($window)
            .bind('resize', function () {

                _.each(elements, function(e) {

                    var element = angular.element(e.element)[0];
                    var height = (e.viewPortResizeAmount * document.documentElement.clientHeight);

                    element.style.height = height.toString() + "px";

                });

            });

        return {
            restrict: 'A',
            link: function(scope, element, attrs) {

                elements.push({
                    element: element,
                    viewPortResizeAmount: percentToFloat(attrs.matchViewportHeight)
                });

                

            }
        };
        
    }]);