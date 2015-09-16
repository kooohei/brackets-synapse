/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	
	var _ = brackets.getModule("thirdparty/lodash");
	
	var appendDoneInitModule;
	
	var states = {
		complete: {
			init: []
		}
	};
	
	
	appendDoneInitModule = function (module_name, bypass) {
		var d = new $.Deferred();
		var _init = states.complete.init;
		_init.push(module_name);
		states.complete.init = _.uniq(_init);
		return d.resolve(bypass).promise();
	};
	
	
	exports.appendDoneInitModule = appendDoneInitModule;
	
	
});