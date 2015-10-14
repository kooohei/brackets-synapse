/*jslint node:true, vars:true, plusplus:true, devel:true, curly: true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*jshint boss: true, expr: true */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";


	// HEADER >>
	
	/**
	 * External modules.
	 */
	var PreferencesManager 	= brackets.getModule("preferences/PreferencesManager"),
			Async 							= brackets.getModule("utils/Async"),
			_										= brackets.getModule("thirdparty/lodash"),
			CryptoManager 			= require("modules/CryptoManager"),
			Log 								= require("modules/Log"),
			Utils 							= require("modules/Utils"),
			SettingManager 			= require("modules/SettingManager"),
			Notify							= require("modules/Notify");

	/**
	 *  Persistent properties for this extension.
	 */
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
	 ** Check properties is exists on the preferences file.
	 ** defined properties if is not exists.
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
					Log.q("Initial settings could not defined to preferences file.", true, err);
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
	 * Get properties for this extension from preferences file.
	 * 
	 * return {string}
	 */
	_getExtensionPrefs = function () {
		return PreferencesManager.getExtensionPrefs("brackets-synapse");
	};

	/**
	 * return version of the synapse from preference file.
	 *
	 * @return {string}
	 */
	getVersion = function () {
		return _getExtensionPrefs().get("version");
	};
	
	/**
	 * The version of this extension, that save to preferences file.
	 ** Usually, never use this function directly.
	 ** It takes from package.json.
	 * 
	 * @param version {string}
	 * @return {$.Promise}
	 */
	setVersion = function (version) {
		var prefs = _getExtensionPrefs();
		prefs.set("version", version);
		return prefs.save();
	};


	/**
	 * Get value whether or not setting had encrypted.
	 * 
	 * @return {string}
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
	 * get server settings from preferences file.(brackets.json)
	 * * if setting was encrypted, it will be decrypted.
	 *
	 * @return {Array} array of server setting.
	 */
	loadServerSettings = function () {
		var sessionPassword = CryptoManager.getSessionPassword(),
				settings = _getExtensionPrefs().get("server-settings"),
				res = null;
		
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
				STR_settings = CryptoManager.encrypt(password, STR_settings);
			} else {
				Notify.showDecryptPassword()
				.then(function () {
					saveServerSettings(settings);
				}, function (err) {
					throw new Error(err);
				});
			}
		}
		var prefs = _getExtensionPrefs();
		prefs.set("server-settings", STR_settings);

		prefs.save()
		.then(function () {
			SettingManager.setServerSettings(settings);
			d.resolve();
		}, function (err) {
			err = new Error({message: "Faild to save the server settings", err: err});
			console.log(err);
			d.reject(err);
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
