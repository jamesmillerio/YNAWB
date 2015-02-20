angular.module('YNAWB', ['ngRoute']) 
  .config(['$routeProvider', function($routeProvider) {
    $routeProvider
      .when('/', {
        controller:'HomeController',
        templateUrl:'/views/home.html'
      })
      .when('/budget/:budget/:device/account/:account', {
        controller:'BudgetController',
        templateUrl:'/views/budget.html'
      })
      .when('/reports/:budget/:device/account/:account', {
        controller: 'ReportController',
        templateUrl: '/views/report.html'
      })
      .when('/transactions/:budget/:device/account/:account', {
        controller:'TransactionsController',
        templateUrl:'/views/transactions.html'
      })
      .otherwise({
        redirectTo:'/'
      });
  }]);