/*jslint node:true, vars:true, plusplus:true, devel:true, curly: true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*jshint boss: true, expr: true */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";


	// HEADER >>
	var PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
			_ = brackets.getModule("thirdparty/lodash"),
			Async = brackets.getModule("utils/Async"),
			CryptoManager = require("modules/CryptoManager"),
			Log = require("modules/Log"),
			Utils = require("modules/Utils"),
			SettingManager = require("modules/SettingManager");

	var members = [{
		key: "version",
		type: "string",
		default: "1.0.0"
	}, {
		key: "server-settings",
		type: "string",
		default: JSON.stringify([]),
	}, {
		key: "use-crypt",
		type: "boolean",
		default: false
	}];


	var _cacheServerSettings = [];

	var init,
			getVersion,
			setVersion,
			getUseCrypt,
			setUseCrypt,
			loadServerSettings,
			saveServerSettings,
			safeSetting,
			_getExtensionPrefs;
	//<<


	/**
	 * Initialize Module.
	 * 
	 * @param domain {NodeDomain}
	 * @return {$.Promise}
	 */
	init = function () {
		var d = new $.Deferred(),
				promise = null,
				promises = [];
		var prefs = _getExtensionPrefs();
		_.forEach(members, function (member) {
			if (typeof (prefs.get(member.key)) === "undefined") {
				prefs.definePreference(member.key, member.type, member.default);
				prefs.set(member.key, member.default);
				promise = prefs.save()
				.then(function () {
					return new $.Deferred().resolve().promise();
				}, function (err) {
					throw Utils.getError("", "ExtensionDiagnosis", "init", err);
				});
			} else {
				promise = new $.Deferred().resolve().promise();
			}
			promises.push(promise);
			
		});
		Async.waitForAll(promises)
		.then(function () {
			d.resolve();
		}, d.reject);
		return d.promise();
	};


	/**
	 * return extension prefs.
	 */
	_getExtensionPrefs = function () {
		return PreferencesManager.getExtensionPrefs("brackets-synapse");
	};

	/**
	 * return version of the synapse from preference file.
	 *
	 * @return {String}
	 */
	getVersion = function () {
		return _getExtensionPrefs().get("version");
	};
	setVersion = function (version) {
		
		var prefs = _getExtensionPrefs();
		prefs.set("version", version);
		return prefs.save();
	};


	/**
	 * return Server settings state whether crypted or plain.
	 */
	getUseCrypt = function () {
		return _getExtensionPrefs().get("use-crypt");
	};
	/**
	 * setter for above value.
	 *
	 * @param isUse {Boolean}
	 * @return {$.Promise}
	 */
	setUseCrypt = function (isUse) {
		var prefs = _getExtensionPrefs();
		prefs.set("use-crypt", isUse);
		return prefs.save();
	};

	/**
	 * get server settings from preferences file.
	 * * if setting was encrypted, then decrypted to that.
	 * * set to _cacheServerSettings when the ready settings is valid format.
	 *
	 * @return {Array} array of server setting.
	 */
	loadServerSettings = function () {
		var sessionPassword = CryptoManager.getSessionPassword(),
				settings = _getExtensionPrefs().get("server-settings"),
				res;
		
		if (sessionPassword) {
			try {
				res = CryptoManager.decrypt(sessionPassword, settings);
			} catch (e) {
				throw e;
			}
		} else {
			res = settings;
		}
		res = JSON.parse(res);

		if (!Array.isArray(res) && typeof res !== "boolean") {
			throw new Error("PreferenceManager.loadServerSettings: server settings format is invalid.");
		}

		SettingManager.setServerSettings(res);
		return res;
	};

	/**
	 * when the server setting was added, updated and deleted,
	 * server setting save to prefereces file.
	 * then that should set to SettingManager member.
	 *
	 * @param {$Array} array of server settings
	 * @return {$.Promise}
	 */
	saveServerSettings = function (settings) {

		var d = new $.Deferred(),
				password = CryptoManager.getSessionPassword();

		var STR_settings = JSON.stringify(settings);

		if (safeSetting()) {
			if (password) {
				try {
					STR_settings = CryptoManager.encrypt(password, STR_settings);
				} catch(e) {
					d.reject(new Error("could not ecrypt, unknown error.")).promise();

				}
			} else {
				d.reject(new Error("could not encrypt, session password is not exists.")).promise();
			}
		}
		var prefs = _getExtensionPrefs();
		prefs.set("server-settings", STR_settings);

		prefs.save()
		.then(function () {
			SettingManager.setServerSettings(settings);
			d.resolve();
		}, function (err) {
			throw new Error(err);
			//d.reject(err);
		});
		return d.promise();
	};

	/**
	 * return setting state whether crypted of plain.
	 * just a wrapper of getUseCyrpto function.
	 */
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
});
