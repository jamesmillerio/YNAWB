angular.module('YNAWB')
    .service('BudgetDataService', ['$http', '$q', '$routeParams', function($http, $q, $routeParams) {

        var self = this;

        self.budgetData = null;
        self.monthAbbr = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
        self.transformedBudgetData = null;
        self.params = {};

        var formatYearMonth = function(year, month) {

            if(month < 10) {
                return year.toString() + "-0" + month.toString();
            } else {
                return year.toString() + "-" + month.toString();
            }

        };

        var masterCategories = function(fullBudget) {

            return _.filter(fullBudget.masterCategories, function(c) { 

                return c.sortableIndex > 0 && (!c.hasOwnProperty("isTombstone") || !c.isTombstone);

            });

        }

        var monthsTransactions = function(year, month, fullBudget) {

            var m = year.toString() + "-";

            if(month < 10) {
                m += "0";
            }

            m += month.toString();
            
            return _.filter(fullBudget.transactions, function(t) { return t.date.indexOf(m) == 0; });

        };

        var incomeForMonth = function(year, month, fullBudget) {
            
            var transactions            = monthsTransactions(year, month, fullBudget);

            //Adjust date for previous month
            if(month == 1) {
                month = 12;
                year--;
            } else {
                month--;
            }

            var previousTransations     = monthsTransactions(year, month, fullBudget)
            var deferredTransactions    = _.filter(previousTransations, function(t) {

                if(t.categoryId == "Category/__Split__") {

                    return _.find(t.subTransactions, function(st) { return st.categoryId == "Category/__DeferredIncome__"; }) != null;

                } else {

                    return t.categoryId == "Category/__DeferredIncome__";

                }

            });

            var incomeTransactions = _.filter(transactions, function(t) { 

                switch(t.categoryId) {
                    case "Category/__ImmediateIncome__":
                        return true;
                    case "Category/__Split__":
                        return _.find(t.subTransactions, function(st) { return st.categoryId == "Category/__DeferredIncome__"; }) != null;
                    default:
                        return false;
                }

            });

            var deferredIncome = _.reduce(deferredTransactions, function(memo, num) { return memo + num.amount; }, 0);
            
            var currentIncome = _.reduce(incomeTransactions, function(memo, num) { 
                
                switch(num.categoryId) {
                    case "Category/__ImmediateIncome__":
                        return memo + num.amount;
                    case "Category/__Split__":
                        return memo + _.find(t.subTransactions, function(st) { return st.categoryId == "Category/__ImmediateIncome__"; }).amount;
                    default:
                        return memo;
                }

            }, 0);

            return deferredIncome + currentIncome;

        };

        var budgetForMonth = function(year, month, fullBudget) {

            var neededBudgets = [ new Date(year, month , 1).toYNABMonthDate() ];

            return _.first(_.filter(fullBudget.monthlyBudgets, function(budget) { return _.contains(neededBudgets, budget.month); }));

        };

        var totalBudgetedAmount = function(year, month, fullBudget) {

            var monthsBudget = budgetForMonth(year, month, fullBudget);
            var d            = new Date(year, month, 1).toYNABMonthDate();
            
            return _.reduce(fullBudget.monthlyBudgets, function(memo, b) {

                var budget = 0;

                if(b.month == d) {

                    budget = _.reduce(b.monthlySubCategoryBudgets, function(memo2, b2) {

                        return memo2 + budgetedAmountForCategory(b2.categoryId, monthsBudget);

                    }, 0);

                }

                return memo + budget;

            }, 0);

        };

        var budgetedAmountForCategory = function(categoryId, budgetForMonth) {
            
            var budgets = _.filter(budgetForMonth.monthlySubCategoryBudgets, function(b) { 

                return b.categoryId == categoryId; 

            });

            var budget = _.first(budgets);

            if(budget == null) 
                budget = { budgeted: 0 };

            if(budget.budgeted == 0)
                return 0;

            return budget.budgeted;

        };

        var getCategory = function(categoryId, fullBudget) {

            var masterCategory = _.filter(fullBudget.masterCategories, function(c) { return (c.entityId == categoryId); });

            if(masterCategory != null && masterCategory.length == 1) {
                return masterCategory.name;
            }

            var categories = _.map(fullBudget.masterCategories, function(c) {

                var subcategory = _.find(c.subCategories, function(sc) {

                    return (sc.entityId == categoryId);

                });

                return subcategory;

            });

            return _.first(_.filter(categories, function(c) { return c != null; }));

        };

        var getCategorySortIndex = function(categoryId, fullBudget) {

            var category = getCategory(categoryId, fullBudget);

            return (category == null) ? -1 : category.sortableIndex;

        };

        var getBudgetName = function(categoryId, fullBudget) {

            var category = getCategory(categoryId, fullBudget);

            return (category == null) ? "" : category.name;

        };

        var getBudgetSummary  = function(fullBudget) {

            if(self.transformedBudgetData != null) { return self.transformedBudgetData; }

            /* In order to make processing a bit easier on the client side, 
             * we're going to transform the budgets into a format where we can
             * essentially just say "Give me the information for month m and 
              * year n" and it'll hand us back everything we need for each budget
              * category. */
            
            var budgetRecord = {};
            var outflowRecord = {};
            var groupedBudgets = _.map(fullBudget.monthlyBudgets, function(b) {

                // Now we want to group by the budget category. This is so 
                var date                = _.map(b.month.split("-"), function(d) { return parseInt(d, 10) });
                var yearMonth           = b.month.toYNABMonthDate();
                var priorYearMonth      = "";

                if(date[1] == 1) {
                    
                    //It's January, we need to go back to December of the previous year.
                    priorYearMonth      = (date[0] - 1).toString() + "-12";

                } else {

                    //Same year, just move back a month. Also make sure we're prepending a zero if needed.
                    var priorMonth  = date[1] - 1;

                    priorMonth      = (priorMonth < 10) ? "0" + priorMonth.toString() : priorMonth.toString();

                    priorYearMonth  = date[0].toString() + "-" + priorMonth;

                }

                b.monthlySubCategoryBudgets = _.map(b.monthlySubCategoryBudgets, function(sb) {

                    sb.transactions = _.filter(fullBudget.transactions, function(t) {

                        var isInMonth = t.date.indexOf(yearMonth) == 0;
                        var isInPriorMonth = t.date.indexOf(priorYearMonth) == 0;
                        var isDeferred = false;
                        var isInCategory = false;

                        if(sb.categoryId == "Category/__Split__") {
                            
                            isInCategory = _.find(t.subTransactions, function(st) { 

                                if(isInPriorMonth && st.categoryId == "Category/__DeferredIncome__") {
                                    isDeferred = true;
                                }

                                return st.categoryId == sb.categoryId;

                            }) != null;

                            return isInCategory && (isInMonth || isDeferred);                            

                        } else {
                            
                            isDeferred = isInPriorMonth && t.categoryId == "Category/__DeferredIncome__";
                            isInCategory = t.categoryId == sb.categoryId;

                        }

                        return isInCategory && (isInMonth || isDeferred);

                    });

                    var outflows = _.filter(sb.transactions, function(t) { return t.amount < 0; });

                    sb.outflowAmount = _.reduce(outflows, function(memo, t) { return memo + t.amount}, 0);
                    sb.name = getBudgetName(sb.categoryId, fullBudget);
                    sb.sortableIndex = getCategorySortIndex(sb.categoryId, fullBudget);

                    //Record keeping for each budget/outflow.
                    if(!budgetRecord.hasOwnProperty(sb.categoryId))
                        budgetRecord[sb.categoryId] = 0;

                    if(!outflowRecord.hasOwnProperty(sb.categoryId))
                        outflowRecord[sb.categoryId] = 0;

                    //Keep our running total
                    budgetRecord[sb.categoryId] += sb.budgeted;
                    outflowRecord[sb.categoryId] += sb.outflowAmount;

                    //Set the running total locally
                    sb.runningBudget = budgetRecord[sb.categoryId];
                    sb.runningOutflow = outflowRecord[sb.categoryId];
                    sb.runningDifference = sb.runningBudget + sb.runningOutflow;

                    return sb;

                });

                b.monthlySubCategoryBudgets = _.indexBy(b.monthlySubCategoryBudgets, function(sb) { return sb.categoryId; });

                return b;

            });

            return _.indexBy(groupedBudgets, function(b) { return b.month; });

        };

        self.getBudgetData = function(budget, device, accountId) {

            var deferred = $q.defer();

            /* If we've specified "All" accounts in our querystring, just wipe out the
             * account id. The code knows to treat null as "all." */
            if(accountId != null && accountId.toLowerCase() == "all") {
                accountId = null;
            }

            if(self.budgetData == null) {
                $http.get("/api/budgetdata/" + budget + "/" + device)
                    .error(deferred.reject)
                    .success(function(b) {

                        var removeTombstones    = function(c) { return (!c.hasOwnProperty("isTombstone") || !c.isTombstone); };
                        var removeHidden        = function(c) { return c.sortableIndex >= 0; };
                        var masterBudgets       = {};

                        /* Do some cleanup. Remove deleted entries and 
                         * get only transactions for the current account
                         * if specified. */
                        b.transactions      = _.chain(b.transactions)
                            .filter(removeTombstones)
                            .filter(function(t) { return (accountId == null) || (t.accountId == accountId); })
                            .map(function(t) { 
                                
                                var account = _.find(b.accounts, function(a) { return a.entityId == t.accountId; });
                                var payee = _.find(b.payees, function(p) { return p.entityId == t.payeeId; });
                                var categoryName = _.reduce(b.masterCategories, function(memo, c) {

                                    var subCategory = _.find(c.subCategories, function(sc) { return sc.entityId == t.categoryId; });

                                    if(subCategory == null) {
                                        return memo + "";
                                    }

                                    return memo + c.name + " : " + subCategory.name;

                                }, "");

                                t.payeeName = (payee != null) ? payee.name : "";
                                t.categoryName = categoryName;
                                t.cleared = t.cleared == "Cleared";
                                t.accountName = (account != null) ? account.accountName : "";

                                return t;

                            })
                            .value();

                        /* Do some cleanup. Remove deleted and hidden 
                         * entries. Also, grab some totals to make things 
                         * easier down the line. */
                        b.masterCategories  = _.chain(b.masterCategories)
                            .filter(removeTombstones)
                            .filter(removeHidden)
                            .map(function(c) {

                                if(c.hasOwnProperty("subCategories") && c.subCategories != null) {
                                    c.subCategories = _.filter(c.subCategories, removeTombstones);
                                }

                                return c;

                            })
                            .value();

                        /* Generage a list of all budget categories. This way
                         * if a budget doesn't exist for a particular category,
                         * we can fill it in with some default values. */
                        _.each(b.monthlyBudgets, function(mb) {

                            _.each(mb.monthlySubCategoryBudgets, function(msb) {

                                if(!masterBudgets.hasOwnProperty(msb.categoryId)) {
                                    masterBudgets[msb.categoryId] = {
                                        entityType: "monthlyCategoryBudget",
                                        budgeted: 0,
                                        categoryId: msb.categoryId
                                    };
                                }

                            });

                        });

                        /* Now that we have our generated list of sub budget categories,
                         * we need to go through our budgets and look for stuff that
                         * isn't in each category. */

                         b.monthlyBudgets = _.map(b.monthlyBudgets, function(mb) {

                            mb.monthlySubCategoryBudgets = _.map(masterBudgets, function(msb) {

                                var existingBudget = _.find(mb.monthlySubCategoryBudgets, function(mscb) { return mscb.categoryId == msb.categoryId; });

                                return (existingBudget != null) ? existingBudget : msb;

                            });

                            return mb;

                         });

                         /* Remove any closed accounts. */
                         b.accounts = _.filter(b.accounts, function(a) { return (!a.hasOwnProperty("isTombstone") || !a.isTombstone); });

                        //Save for later use.
                        self.budgetdata = b;

                        //Resolve the promise.
                        deferred.resolve(self.budgetdata);

                    });

            } else {
                deferred.resolve(self.budgetdata);
            }

            return deferred.promise;

        };

        self.getBudgetDataForMonth = function(budget, device, accountId, year, month) {

            var deferred = $q.defer();

            self.getBudgetData(budget, device, accountId).then(function(b) {
                
                var summary             = getBudgetSummary(b);
                var yearMonth           = formatYearMonth(year, month) + "-01";
                var income              = incomeForMonth(year, month, b);
                var budgeted            = _.reduce(summary[yearMonth].monthlySubCategoryBudgets, function(m, b) { return m + b.budgeted; }, 0);
                var availableToBudget   = (budgeted > income) ? budgeted - income : 0;
                var outflows            = _.reduce(summary[yearMonth].monthlySubCategoryBudgets, function(m, b) { return m + b.outflowAmount; }, 0);
                var balance             = _.reduce(summary[yearMonth].monthlySubCategoryBudgets, function(m, b) { return m + b.runningBudget + b.runningOutflow; }, 0);

                deferred.resolve({
                    summary: {
                        date:                   new Date(year, month - 1, 1),
                        monthAbbr:              self.monthAbbr[month - 1],
                        year:                   year,
                        notBudgeted:            (income > budgeted) ? (income - budgeted) : 0,
                        overspent:              (budgeted < outflows) ? (budgeted - outflows) : 0,
                        income:                 income,
                        budgeted:               budgeted,
                        availableToBudget:      availableToBudget,
                        outflows:               outflows,
                        balance:                balance
                    },
                    budgets: summary[yearMonth]

                });

            });

            return deferred.promise;

        };

        self.getBudgetList = function() {

            var deferred = $q.defer();

            $http.get("/api/budgets")
                .error(deferred.reject)
                .success(function(b) {
                    deferred.resolve(b);
                });

            return deferred.promise;
        };

    }]);