// Avoid `console` errors in browsers that lack a console.
(function() {
    var method;
    var noop = function () {};
    var methods = [
        'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
        'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
        'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
        'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'
    ];
    var length = methods.length;
    var console = (window.console = window.console || {});

    while (length--) {
        method = methods[length];

        // Only stub undefined methods.
        if (!console[method]) {
            console[method] = noop;
        }
    }
}());

// Place any jQuery/helper plugins in here.

String.prototype.fromYNABDateToDateString = function() {

    var split = this.split("-");

    return split[1] + "/" + split[2] + "/" + split[0].substring(2, 4);

};

String.prototype.toYNABMonthDate = function() {

    var split = this.split("-");
    var y = split[0];
    var m = split[1];

    return y + "-" + m;

};

Date.prototype.toYNABMonthDate = function() {

    var y = this.getFullYear().toString();
    var m = (this.getMonth() + 1).toString();

    //Prepend a zero if needed.
    if(m.length == 1) { m = "0" + m; }

    return y + "-" + m;

};

Date.prototype.toYNABDate = function() {

    return this.toYNABMonthDate() + "-01";

};

Date.prototype.getMonthAbbr = function() {

    var abbr = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];

    return abbr[this.getMonth()];

};

Number.prototype.toCurrency = function(blankOnZero) {

    if(blankOnZero == null) {
        blankOnZero = false;
    }

    if(this == null) {
        return "";
    }

    if(blankOnZero && this == 0) {
        return "";
    }

    if(this < 0) {
        return "-$" + Math.abs(this).toFixed(2);
    }

    return "$" + this.toFixed(2);

};