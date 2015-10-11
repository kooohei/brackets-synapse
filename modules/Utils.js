/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	var _			= brackets.getModule("thirdparty/lodash");

	var sleep,
			l,
			now;
	var debug = true;

	sleep = function (countBy100ms) {
		var d = new $.Deferred(),
				count = 0;
		if (countBy100ms === 0)
			return $.Deferred().resolve().promise();

		var timer = setInterval(function () {
			count++;
			if (count === countBy100ms) {
				clearInterval(timer);
				d.resolve();
			}
		}, 100);
		return d.promise();
	};

	l = function () {
		var argLength = arguments.length;
		if (argLength > 1) {
			var args = {};
			_.forEach(arguments, function (arg) {
				args.push(arg);
			});
			console.log(args);
		} else {
			console.log(arguments[0]);
		}
	};
	now = function (format) {
		var date = new Date();
		if (!format) format = 'YYYY/MM/DD hh:mm:ss';
		format = format.replace(/YYYY/g, date.getFullYear());
		format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
		format = format.replace(/DD/g, ('0' + date.getDate()).slice(-2));
		format = format.replace(/hh/g, ('0' + date.getHours()).slice(-2));
		format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
		format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
		if (format.match(/S/g)) {
			var milliSeconds = ('00' + date.getMilliseconds()).slice(-3);
			var length = format.match(/S/g).length;
			for (var i = 0; i < length; i++) format = format.replace(/S/, milliSeconds.substring(i, i + 1));
		}
		return format;
	};
	
	
	exports.l = l;
	exports.sleep = sleep;
	exports.now = now;
});
