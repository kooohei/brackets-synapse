/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";	
	
	// Modules >
	var FileSystem = brackets.getModule("filesystem/FileSystem");
	var FileUtils = brackets.getModule("file/FileUtils");
	
	var _ = brackets.getModule("thirdparty/lodash");
	var Directory = brackets.getModule("filesystem/Directory");
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var Async = brackets.getModule("utils/Async");
	var DialogCollection = require("modules/DialogCollection");
	var PreferenceManager = require("modules/PreferenceManager");
	// <
	
	// Privatte Vars >
	var	_domain,
			PATH_TO_PACKAGE_JSON = FileUtils.getParentPath(ExtensionUtils.getModulePath(module)) + "package.json";
	
	
	
	// <
	
	// Private Methods >
	var _getVersionFromPackageJson,
			_firstLaunch,
			_checkKeysDirectory,
			_getDirectoryContents;
	// <
	
	
	// Public Mehtods >
	var init,
			getDomain;
	// <
	
	// Listener >
	var onClickSecureWarning;
	// <
	
	_getVersionFromPackageJson = function () {
		var d							= new $.Deferred(),
				file = FileSystem.getFileForPath(PATH_TO_PACKAGE_JSON);
		
		FileUtils.readAsText(file)
		.then(function (text, time) {
			var version = JSON.parse(text).version;
			d.resolve(version);
		});
		return d.promise();
	};
	
	_firstLaunch = function () {
		if (PreferenceManager.getVersion() !== _getVersionFromPackageJson()) {
			return _checkKeysDirectory();
		} else {
			return new $.Deferred().resolve().promise();
		}
	};
	
	_getDirectoryContents = function (dir) {
		var d = $.Deferred();
		dir.getContents(function (err, contents, stats, statsErrors) {
			if (err) {
				d.reject(err);
			} else {
				d.resolve(contents);
			}
		});
		return d.promise();
	};
	
	_checkKeysDirectory = function () {
		var d = new $.Deferred();
		var path = FileUtils.getParentPath(ExtensionUtils.getModulePath(module)) + "__KEYS__";
		var keysdir = FileSystem.getDirectoryForPath(path);
		var message = "Please Re-set to the following account settings<hr>";
		keysdir.exists(function (err, exists) {
			if (exists) {
				_getDirectoryContents(keysdir)
				.then(function (contents) {
					if (contents.length) {
						_.forEach(contents, function (entry) {
							var tmp = entry.name.split("@"),
									host = tmp[0],
									user = tmp[1];
							message += "Host @ User : " + host + " @ " + user + "<br>";
						});
						keysdir.moveToTrash();
						DialogCollection.showAlert("Alert", message);
					} else {
						keysdir.moveToTrash();
					}
					d.resolve();
				}, function (err) {
					d.reject(err);
				});
			} else {
				d.resolve();
			}
		});
		return d.promise();
	};
	
	init = function (domain) {
		_domain = domain;
		var d = new $.Deferred();
		_firstLaunch()
		.then(_getVersionFromPackageJson)
		.then(function (version) {
			return PreferenceManager.setVersion(version);
		})
		.then(d.resolve, function (err) {
			d.reject(err);
		});
		return d.promise();
	};
	
	exports.init = init;
	exports.getDomain = getDomain;
	exports.getModuleName = function () {
		return module.id;
	};
});