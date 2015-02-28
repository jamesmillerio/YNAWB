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

        var overspentCalculation = function(m, b) { 

            var diff = b.runningDifference < 0 ? b.runningDifference : 0;

            return m + diff; 

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
            
            var transactions        = monthsTransactions(year, month, fullBudget);

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
            var groupedTransactions = _.groupBy(fullBudget.transactions, function(t) { return t.date.substring(0, 7); });
            var previousMonth = null;

            return _.chain(fullBudget.monthlyBudgets)
                    .sortBy(function(b) { return b.month; })
                    .map(function(b) {

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

                        b.monthlySubCategoryBudgets  = _.chain(b.monthlySubCategoryBudgets)
                                                        .map(function(sb) {

                                                            var trans = (groupedTransactions[yearMonth] == null) ? [] : groupedTransactions[yearMonth];

                                                            //sb.transactions = _.filter(fullBudget.transactions, function(t) {
                                                            sb.transactions = _.filter(trans, function(t) {

                                                                var isInMonth = t.date.indexOf(yearMonth) == 0;
                                                                var isInPriorMonth = t.date.indexOf(priorYearMonth) == 0;
                                                                var isDeferred = false;
                                                                var isInCategory = false;

                                                                if(t.categoryId == "Category/__Split__" && t.subTransactions != null && t.subTransactions.length > 0) {
                                                                    
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

                                                            sb.outflowAmount = _.reduce(sb.transactions, function(m1, t) { 

                                                                var amount = 0;

                                                                if(t.hasOwnProperty("subTransactions") && t.subTransactions != null && t.subTransactions.length > 0) {

                                                                    amount = _.chain(t.subTransactions)
                                                                              .filter(function(st) { return st.categoryId === sb.categoryId; })
                                                                              .filter(function(st) { return st.amount < 0; })
                                                                              .reduce(function(m2, st) { return m2 + st.amount; }, 0)
                                                                              .value();

                                                                } else {
                                                                    //amount = (t.amount < 0) ? t.amount : 0;
                                                                    amount = t.amount;
                                                                }

                                                                return m1 + amount;

                                                            }, 0);

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
                                                            sb.runningBudget = parseFloat(budgetRecord[sb.categoryId].toFixed(2));
                                                            sb.runningOutflow = parseFloat(outflowRecord[sb.categoryId].toFixed(2));
                                                            sb.runningDifference = sb.runningBudget + sb.runningOutflow;

                                                            if(sb.runningDifference < 0) {
                                                                budgetRecord[sb.categoryId] = 0;
                                                                outflowRecord[sb.categoryId] = 0;
                                                            }

                                                            return sb;

                                                        })
                                                        .indexBy(function(sb) { return sb.categoryId; })
                                                        .value();

                        if(previousMonth != null) {

                            var incomeThisMonth     = incomeForMonth(date[0], date[1], fullBudget);
                            var budgetedThisMonth   = _.reduce(b.monthlySubCategoryBudgets, function(m, budget) { return m + budget.budgeted; }, 0);
                            
                            b.notBudgetedThisMonth  = previousMonth.notBudgetedThisMonth + previousMonth.overspentThisMonth + incomeThisMonth - budgetedThisMonth;
                            b.overspentThisMonth    = _.reduce(b.monthlySubCategoryBudgets, overspentCalculation, 0);
                            
                            b.overspentLastMonth    = previousMonth.overspentThisMonth;
                            b.notBudgetedLastMonth  = previousMonth.notBudgetedThisMonth;
                            
                            b.incomeThisMonth       = incomeThisMonth;
                            b.budgetedThisMonth     = budgetedThisMonth;

                        } else {

                            b.notBudgetedThisMonth  = 0;
                            b.notBudgetedLastMonth  = 0;
                            b.overspentLastMonth    = 0;
                            b.incomeThisMonth       = 0;
                            b.budgetedThisMonth     = 0;
                            b.overspentThisMonth    = 0;

                        }

                        previousMonth = b;

                        return b;

            })
            .indexBy(function(b) { return b.month; })
            .value();

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
                            .filter(function(c) { return c.hasOwnProperty("subCategories") && c.subCategories != null && c.subCategories.length > 0; })
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

                         b.monthlyBudgets    = _.chain(b.monthlyBudgets)
                                                .map(function(mb) {

                                                    mb.monthlySubCategoryBudgets = _.chain(masterBudgets)
                                                                                    .filter(removeTombstones)
                                                                                    .map(function(msb) {

                                                                                        var existingBudget = _.chain(mb.monthlySubCategoryBudgets)
                                                                                                              .filter(removeTombstones)
                                                                                                              .find(function(mscb) { return mscb.categoryId == msb.categoryId; })
                                                                                                              .value();

                                                                                        return (existingBudget != null) ? existingBudget : msb;

                                                                                    })
                                                                                    .value();

                                                    return mb;

                                                })
                                                .sortBy(function(mb) { return mb.month; })
                                                .value();

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

                var previousMonth           = new Date(year, month - 1, 1);
                var previousPreviousMonth   = new Date(year, month - 1, 1);

                /* Subtract two since months are zero-relative 
                 * and we need to go back a month. */
                previousMonth.setMonth(previousMonth.getMonth() - 1);
                previousPreviousMonth.setMonth(previousPreviousMonth.getMonth() - 2);

                var summary                 = getBudgetSummary(b);
                var yearMonth               = formatYearMonth(year, month) + "-01";
                var lastYearMonth           = formatYearMonth(previousMonth.getFullYear(), previousMonth.getMonth() + 1) + "-01";
                var currentSummary          = summary[yearMonth];
                var lastSummary             = summary[lastYearMonth];
                var lastLastYearMonth       = formatYearMonth(previousPreviousMonth.getFullYear(), previousPreviousMonth.getMonth() + 1) + "-01";
                var income                  = incomeForMonth(year, month, b);
                var lastMonthsIncome        = incomeForMonth(previousMonth.getFullYear(), previousMonth.getMonth() + 1, b); //Once again, months are zero relative so add one.

                var lastMonthBudgeted       = lastSummary == null                   ? 0 : _.reduce(lastSummary.monthlySubCategoryBudgets, function(m, b) { return m + b.budgeted; }, 0);
                var budgeted                = currentSummary == null                ? 0 : _.reduce(currentSummary.monthlySubCategoryBudgets, function(m, b) { return m + b.budgeted; }, 0);
                var lastMonthOutflows       = lastSummary == null                   ? 0 : _.reduce(lastSummary.monthlySubCategoryBudgets, function(m, b) { return m + b.outflowAmount; }, 0);
                var outflows                = currentSummary == null                ? 0 : _.reduce(currentSummary.monthlySubCategoryBudgets, function(m, b) { return m + b.outflowAmount; }, 0);
                var balance                 = currentSummary == null                ? 0 : _.reduce(currentSummary.monthlySubCategoryBudgets, function(m, b) { return m + b.runningBudget + b.runningOutflow; }, 0);
                var lastMonthOverspent      = lastSummary ==  null                  ? 0 : _.reduce(lastSummary.monthlySubCategoryBudgets, overspentCalculation, 0);
                var lastLastMonthOverspent  = summary[lastLastYearMonth] ==  null   ? 0 : _.reduce(summary[lastLastYearMonth].monthlySubCategoryBudgets, overspentCalculation, 0);

                deferred.resolve({
                    summary: {
                        date:                   new Date(year, month - 1, 1),
                        monthAbbr:              self.monthAbbr[month - 1],
                        lastMonthAbbr:          self.monthAbbr[month - 2],
                        year:                   year,
                        notBudgeted:            (income > budgeted) ? (income - budgeted) : 0,
                        //lastMonthNotBudgeted:   (lastMonthsIncome + lastLastMonthOverspent) - lastMonthBudgeted,
                        lastMonthNotBudgeted:   currentSummary.notBudgetedLastMonth,
                        lastMonthOverspent:     currentSummary.overspentLastMonth,
                        overspent:              (budgeted < outflows) ? (budgeted - outflows) : 0,
                        income:                 currentSummary.incomeThisMonth,
                        budgeted:               currentSummary.budgetedThisMonth,
                        availableToBudget:      currentSummary.notBudgetedThisMonth,
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