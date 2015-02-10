angular.module('YNAWB', ['ngRoute']) 
  .config(function($routeProvider) {
    $routeProvider
      .when('/', {
        controller:'HomeController',
        templateUrl:'views/home.html'
      })
      .when('/budget', {
        controller:'BudgetController',
        templateUrl:'views/budget.html'
      })
      .when('/transactions', {
        controller:'TransactionsController',
        templateUrl:'views/transactions.html'
      })
      .otherwise({
        redirectTo:'/'
      });
  });