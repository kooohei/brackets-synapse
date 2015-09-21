/*jslint node:true, vars:true, plusplus:true, devel:true, curly: true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*jshint boss: true, expr: true */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	
	// Modules >
	var PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
			_ = brackets.getModule("thirdparty/lodash"),
			Async = brackets.getModule("utils/Async"),
			CryptManager = require("modules/CryptoManager")
			;
	// <
	
	// Private Vars >
	var members = [{
		key: "version",
		type: "string",
		default: "0.0.0"
	}, {
		key: "server-settings",
		type: "string",
		default: JSON.stringify([]),
	}, {
		key: "use-crypt",
		type: "boolean",
		default: false
	}];
	// <
	
	// Public Methods >
	var init,
			getVersion,
			setVersion,
			
			getUseCrypt,
			setUseCrypt,
			
			loadServerSettings,
			saveServerSettings,
			
			safeSetting
	;
	// <
	
	// Private Methods >
	var _getExtensionPrefs,
			_isExists,
			_defineMember
			;
	// <
	init = function (domain) {
		var d = new $.Deferred(),
				promises = [];
		var prefs = _getExtensionPrefs();
		_.forEach(members, function (member) {
			var p = _isExists(member, prefs);
			promises.push(p);
		});
		Async.waitForAll(promises)
		.then(function () {
			d.resolve(domain);
		}, d.reject);
		return d.promise();
	};
	
	_getExtensionPrefs = function () {
		return PreferencesManager.getExtensionPrefs("brackets-synapse");
	};
	
	_isExists = function (member, prefs) {
		var d = new $.Deferred();
		var type = typeof (prefs.get(member.key));
		if (type === "undefined") {
			_defineMember(member, prefs)
			.then(d.resolve, d.reject);
		} else {
			d.resolve();
		}
		return d.promise();
	};
	
	_defineMember = function (member, prefs) {
		var	d = new $.Deferred();
		prefs.definePreference(member.key, member.type, member.default);
		console.log(member);
		prefs.set(member.key, member.default);
		prefs.save();
		return d.resolve().promise();
	};
	
	
	getVersion = function () {
		return _getExtensionPrefs().get("version");
	};
	setVersion = function (version) {
		var prefs = _getExtensionPrefs();
		prefs.set("version", version);
		prefs.save();
		return new $.Deferred().resolve().promise();
	};
	
	getUseCrypt = function () {
		return _getExtensionPrefs().get("use-crypt");
	};
	setUseCrypt = function (isUse) {
		var prefs = _getExtensionPrefs();
		prefs.set("use-crypt", isUse);
		prefs.save();
		return new $.Deferred().resolve().promise();
	};
	
	loadServerSettings = function () {
		var sessionPassword = CryptManager.getSessionPassword(),
				settings = _getExtensionPrefs().get("server-settings");
		if (sessionPassword) {
			try {
				return CryptManager.decrypt(sessionPassword, settings);
				
			} catch (e) {
				throw new Error("session password is not exists");
			}
		} else {
			return settings;
		}
	};
	saveServerSettings = function (settings) {
		var prefs = _getExtensionPrefs();
		prefs.set("server-settings", settings);
		prefs.save();
		return new $.Deferred().resolve().promise();
	};
	
	safeSetting = function () {
		return getUseCrypt();
	};
	
	exports.init = init;
	exports.getVersion = getVersion;
	exports.setVersion = setVersion;
	exports.getUseCrypt = getUseCrypt;
	exports.setUseCrypt = setUseCrypt;
	exports.loadServerSettings = loadServerSettings;
	exports.saveServerSettings = saveServerSettings;
	exports.safeSetting = safeSetting;
	exports.getModuleName = function () {
		return module.id;
	};
});