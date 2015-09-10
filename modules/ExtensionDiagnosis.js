/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	
	var PreferencesManager = brackets.getModule("preferences/PreferencesManager");
	var FileSystem = brackets.getModule("filesystem/FileSystem");
	var FileUtils = brackets.getModule("file/FileUtils");
	var Directory = brackets.getModule("filesystem/Directory");
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var Async = brackets.getModule("utils/Async");
	var _ = require("node_modules/lodash/index");
	var DialogCollection = require("modules/DialogCollection");
	
	
	
	var preference = PreferencesManager.getExtensionPrefs("brackets-synapse");
	
	
	var _getRealVersion,
			_getVersionByPrefs,
			_setRealVersionToPreference,
			
			start,
			_firstLaunch,
			_chkKeysDirectory,
			_getDirectoryContents
			;
	
	_getVersionByPrefs = function () {
		var version = preference.get("version");
		return version;
	};
	_getRealVersion = function () {
		var d = new $.Deferred();
		var file = FileSystem.getFileForPath(FileUtils.getParentPath(ExtensionUtils.getModulePath(module)) + "package.json");
		var package_json = "";
		FileUtils.readAsText(file)
		.then(function (text, time) {
			var package_json = JSON.parse(text);
			d.resolve(package_json.version);
		});
		return d.promise();
	};
	_setRealVersionToPreference = function () {
		var d = new $.Deferred();
		_getRealVersion()
		.then(function (ver) {
			if (typeof (_getVersionByPrefs) === "undefined") {
				preference.definePreference("version", "string", "");
			}
			if (!preference.set("version", ver)) {
				throw new Error("The version number could not wrote to preference file.");
			}
			preference.save()
			.then(d.resolve, d.reject);
		});
		return d.promise();
	};
	
	
	
	start = function (domain) {
		var d = new $.Deferred();
		var prefVer = _getVersionByPrefs();
		_getRealVersion()
		.then(function (realVer) {
			if (prefVer !== realVer) {
				_firstLaunch()
				.then(function () {
					return _setRealVersionToPreference();
				})
				.then(d.resolve, d.reject);
			} else {
				d.resolve();
			}
		}, function (err) {
			d.reject(err);
		});
		return d.promise();
	};
	
	
	_firstLaunch = function () {
		return _chkKeysDirectory();
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
	_chkKeysDirectory = function () {
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
	
	exports.start = start;
});