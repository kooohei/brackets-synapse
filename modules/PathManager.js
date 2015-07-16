/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	"use strict";
	
	var FileUtils = brackets.getModule("file/FileUtils");
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	
	var remoteRoot = [];
	var isRelative = false;
	var modulePath = null;
	
	var	setRemoteRoot,
		completion,
		getRemoteRoot,
		getBaseDirectory,
		getProjectDirectoryPath,
		getTransactionDirectoryPath
		;
	
	var PROJECT_DIR = "__PROJ__";
	var TRANSACTION_DIR  = "__TRANSACTION__";
	
	
	setRemoteRoot = function (_path) {
		isRelative = (_path.charAt(0) !== "/");
		remoteRoot = _path.split('/').filter(function (item) { return (item !== "") && (item !== "."); });
	};
	
	getRemoteRoot = function () {
		var tmp = [].concat(remoteRoot);
		return ((isRelative) ? "./" : "/") + tmp.join("/");
	};
	
	completion = function (pathAry) {
		
		var remotePath = getRemoteRoot();
		if (pathAry === "#" || pathAry === false) {
			return  remotePath;
		}
		if (pathAry.length === 0) {
			return ((isRelative) ? "./" : "/");
		}
		return remotePath + ((remotePath === "/" || remotePath === "./") ? "" : "/") + pathAry.join("/");
	};
	
	getProjectDirectoryPath = function (_path) {
		var path = _path || "";
		var modulePath = FileUtils.getParentPath(ExtensionUtils.getModulePath(module));
		if (path === "#" || path === "") {
			path = modulePath + PROJECT_DIR;
		} else {
			path = modulePath + path;
		}
		return path;
	};
	getTransactionDirectoryPath = function (_path) {
		var path = _path || "";
		var modulePath = FileUtils.getParentPath(ExtensionUtils.getModulePath(module));
		if (path === "#" || path === "") {
			path = modulePath + TRANSACTION_DIR;
		} else {
			path = modulePath + TRANSACTION_DIR;
		}
		return path;
	};
	
	
	exports.setRemoteRoot = setRemoteRoot;
	exports.getRemoteRoot = getRemoteRoot;
	exports.completion = completion;
	exports.getProjectDirectoryPath = getProjectDirectoryPath;
	exports.getTransactionDirectoryPath = getTransactionDirectoryPath;
});
