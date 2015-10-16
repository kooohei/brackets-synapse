/*jslint node: true, vars: true, plusplus: true, devel: true, white: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	/* region Modules */
	var FileUtils = brackets.getModule("file/FileUtils"),
			ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
			Project = require("modules/Project");
	/* endregion */

	/* region Public vars */
	var remoteRoot = [];
	var isRelative = false;
	/* endregion */

	/* region Private vars */
	var _projectDir;
	/* endregion */

	/* region Public Methods */
	var	init,
			setRemoteRoot,
			removeTrailingSlash,
			completionRemotePath,
			completionLocalPath,
			getBaseDirectory,
			getProjectDirectoryPath,
			getLocalRelativePath,
			_onProjectStateChanged;
	/* endregion */

	/* region Static vars */
	var PROJECT_DIR = "__PROJ__";
	/* endregion */

	/* Public Methods */
	init = function () {
		var deferred = new $.Deferred();
		Project.on(Project.PROJECT_STATE_CHANGED, _onProjectStateChanged);
		return deferred.resolve().promise();
	};

	setRemoteRoot = function (_path) {
		// '/.(.*n)/', '/./', '/..$', '/../$'
		if (_path.match(/(\/\.+\/|\/\.\/|\/\.\.\/?$)/g) && _path !== "./") {
			throw new Error("path is invalid");
		}
		isRelative = (_path.charAt(0) !== "/");
		if (_path === "./") {
			remoteRoot = [];
		} else {
			var ary = _path.split('/');
			remoteRoot = ary.filter(function (item) {
				return (item !== "") && (item !== ".") && (item !== "..");
			});
		}
	};

	completionRemotePath = function (setting, pathAry) {
		var res = removeTrailingSlash(setting.dir);
		if (res !== "./") {
			res += "/";
		}
		return res + pathAry.join("/");
	};

	completionLocalPath = function (pathAry) {
		return _projectDir.fullPath + pathAry.join("/");
	};

	getLocalRelativePath = function (path) {
		if (!path || path.substr(0, _projectDir.fullPath.length) !== _projectDir.fullPath) {
			return;
		}
		var result = path.substr(_projectDir.fullPath.length);
		return removeTrailingSlash(result);
	};
	
	removeTrailingSlash = function (path) {
		if (path === "") {
			path = "./";
		}
		var tmp = path.split("/");
		if (tmp.length > 1 && path !== "./" && path !== "/") {
			if (tmp[tmp.length-1] === "") {
				tmp.pop();
			}
			path = tmp.join("/");
			
		}
		return path;
	};

	getProjectDirectoryPath = function (_path) {
		var path = _path || "";
		var modulePath = FileUtils.getParentPath(ExtensionUtils.getModulePath(module));
		if (path === "#" || path === "") {
			path = modulePath + PROJECT_DIR;
		} else {
			path = modulePath + PROJECT_DIR + "/" + path;
		}
		return path;
	};
	/* Private Methods */
	_onProjectStateChanged = function (e, obj) {
		_projectDir = obj.directory;
	};

	exports.init = init;
	exports.setRemoteRoot = setRemoteRoot;
	exports.completionRemotePath = completionRemotePath;
	exports.completionLocalPath = completionLocalPath;
	exports.getProjectDirectoryPath = getProjectDirectoryPath;
	exports.getLocalRelativePath = getLocalRelativePath;
	exports.removeTrailingSlash = removeTrailingSlash;
	exports.getModuleName = function () {
		return module.id;
	};
});
