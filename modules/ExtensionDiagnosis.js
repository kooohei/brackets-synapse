/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";	
	/* region Module */
	var PreferencesManager = brackets.getModule("preferences/PreferencesManager");
	var FileSystem = brackets.getModule("filesystem/FileSystem");
	var FileUtils = brackets.getModule("file/FileUtils");
	var Notify = require("modules/Notify").Notify;
	var _ = brackets.getModule("thirdparty/lodash");
	var Directory = brackets.getModule("filesystem/Directory");
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var Async = brackets.getModule("utils/Async");
	var DialogCollection = require("modules/DialogCollection");
	
	/* endregion */
	
	/* region Privatte Vars */
	var	_domain,
			preference = PreferencesManager.getExtensionPrefs("brackets-synapse");
	/* endregion */
	
	/* region Private Methods */
	var _getRealVersion,
			_getVersionByPrefs,
			_setRealVersionToPreference,
			_firstLaunch,
			_chkKeysDirectory,
			_getDirectoryContents,
			_checkSettingState;
	/* endregion */
	
	/* region Public Methods */
	var start,
			getDomain;
	/* endregion */
	
	var onClickSecureWarning;
	
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
	
	_firstLaunch = function (prefVer, realVer) {
		if (prefVer !== realVer) {
			return _chkKeysDirectory();
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
	
	_checkSettingState = function () {
		var d = new $.Deferred(),
				settingPrefs = preference.get("server-settings");
				
		if (settingPrefs === undefined || settingPrefs === "") {
			return d.resolve().promise();
		}
		if (!settingPrefs.match(/"host".+?"port"/)) {
			console.log("there is not found to problem.");
			return d.resolve().promise();
		} else {
			console.log("not secure");
			// there is not secured setting data.
			var notify = new Notify("secureWarning",
															"secureWarning",
															"SECURE WARNING",
															{type: 1, text1: "Now I do that", text2: "Later"},
															onClickSecureWarning
														).show();
			
		}
		return d.promise();
	};
	onClickSecureWarning = function (e) {
		if (e.data === "Now I do that") {
			
		}
		if (e.data === "OK") {
			
		}
	};
	
	start = function (domain) {
		_domain = domain;
		var d = new $.Deferred();
		var prefVer = _getVersionByPrefs();
		
		_getRealVersion()
		.then(function (realVer) {
			return _firstLaunch(prefVer, realVer);
		})
		.then(function () {
			return _setRealVersionToPreference();
		})
		.then(function () {
			return _checkSettingState(domain);
		})
		.then(d.resolve, function (err) {
			d.reject(err);
		});
		return d.promise();
	};
	
	exports.start = start;
	exports.getDomain = getDomain;
});