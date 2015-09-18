/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	var sleep;
	
	
	sleep = function (sec) {
		if (sec === 0)
			return;
		var d = new $.Deferred(),
				count = 0;
		var timer = setInterval(function () {
			count++;
			
			
			if (count === sec) {
				clearInterval(timer);
				d.resolve();
			}
			console.log("count: " + count);
			
		}, 1000);
		return d.promise();
	};
	
	
	
	exports.sleep = sleep;
});