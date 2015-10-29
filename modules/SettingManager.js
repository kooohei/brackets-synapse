/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50, boss: true */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	// HEADER >>
	var PreferencesManager	= brackets.getModule("preferences/PreferencesManager"),
			EventDispatcher			= brackets.getModule("utils/EventDispatcher"),
			_										= brackets.getModule("thirdparty/lodash"),
			FileManager					= require("modules/FileManager"),
			Panel								= require("modules/Panel"),
			Strings							= require("strings"),
			Utils								= require("modules/Utils"),
			CryptoManager				= require("modules/CryptoManager"),
			PreferenceManager		= require("modules/PreferenceManager"),
			Notify							= require("modules/Notify"),
			PathManager					= require("modules/PathManager"),
			Log									= require("modules/Log"),
			Shared							= require("modules/Shared");

	var init,
			edit,
			validateAll,
			validate,
			reset,
			getServerSetting,
			getServerSettingsCache,
			setServerSettings,
			deleteServerSetting;
	
	var	_editServerSetting,
			_connectTest,
			_setServerBtnState
			;
	
	
	var _serverSettings = [];
	
	
	var onSecureWarningDo,
			onSecureWarningLater;

	var domain;
	var Server = function () {
		this.protocol = "ftp";
		this.host = null;
		this.port = 21;
		this.user = null;
		this.password = null;
		this.passphrase = null;
		this.privateKeyPath = null;
		this.dir = null;
		this.exclude = null;
	};
	var $serverSetting = null;
	
	var regexp = {
		host: null,
		port: null,
		path: null
	};

	// Validate Object
	var ftp = null,
			sftpKey = null,
			sftpPassword = null;
	
	// <<
	
	/**
	 * Initialize module.
	 * 
	 * @Return {$.Promise} promise never rejected.
	 */
	init = function () {
		var deferred = new $.Deferred();
		
		$serverSetting = $("#synapse-server-setting");
		regexp.host = new RegExp("^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9])$");
		regexp.port = new RegExp("[1-65535]");
		//regexp.unix_path = new RegExp("^$|^\\.\\/.*?|^\\/.*?|^(?!\\/).+?|(?!\.\.)");
		$("input[type='text'], input[type='password']", $serverSetting).val("").removeClass("invalid");
		$("th > i", $serverSetting).removeClass("done");
		$("th > i.fa-plug", $serverSetting).addClass("done");
		$("button.btn-add").addClass("disabled");
		
		return deferred.resolve().promise();
	};

	/**
	 * The clicked listener of setting panel.
	 * * this function execute some process for the save server setting preprocess.
	 * * 1. validate string input values.
	 * * 2. validate whether the account could established connection.
	 * 
	 * @param {string} state value whether "update" or "insert"
	 * 
	 */
	edit = function (state) {
		var deferred = new $.Deferred();
		var setting = validateAll();
		
		setting.protocol = $("#currentProtocol").val();
		if (setting.protocol === "sftp") {
			setting.privateKeyPath = $("#synapse-server-privateKey-path").val();
			setting.auth = $("#currentAuth").val();
		}
		if (setting !== false) {
			_setServerBtnState("disabled");
			
			_connectTest(setting)
			.then(function (list) {
				if (list.length === 0) {
					Log.q("CURRENT DIRECTORY is not exists.", true);
					ftp.dir.invalid = true;
					ftp.dir.form.addClass("invalid");
					ftp.dir.icon.removeClass("done");
					return new $.Deferred().reject().promise();
				} else {
					Log.q("Authentication was successful with your new setting");
					return _editServerSetting(state, setting);
				}
			}, function (err) {
				Log.q("An error occurred in the authentication, or could not read file list from current directory", true, err);
				deferred.reject(err);
			})
			.then(function () {
				Panel.showServerList();
				deferred.resolve();
			}, deferred.reject)
			.always(function () {
				_setServerBtnState("enabled");
			});
		}
		return deferred.promise();
	};
	
	/**
	 * Validate all values for server setting.
	 * 
	 * @return {boolean} that will be true if all values passed validate, or false if some value is invalid.
	 */
	validateAll = function () {
		var deferred = new $.Deferred();
		var invalid = [];

		ftp = {
			host 				: {form: $("#synapse-server-host", $serverSetting), icon: $("i.fa-desktop"), invalid: false},
			port 				: {form: $("#synapse-server-port", $serverSetting), icon: $("i.fa-plug"), invalid: false},
			user 				: {form: $("#synapse-server-user", $serverSetting), icon: $("i.fa-user"), invalid: false},
			password		: {form: $("#synapse-server-password", $serverSetting),icon: $("i.fa-unlock"), invalid: false},
			name				: {form: $("#synapse-server-setting-name", $serverSetting), icon: $("i.fa-barcode"), invalid: false},
			dir	 				: {form: $("#synapse-server-dir", $serverSetting), icon: $("i.fa-sitemap"), invalid: false},
			exclude			: {form: $("#synapse-server-exclude", $serverSetting), icon: $("i.fa-ban"), invalid: false}
		};
		sftpKey = {
			host 				: {form: $("#synapse-server-host", $serverSetting), icon: $("i.fa-desktop"), invalid: false},
			port 				: {form: $("#synapse-server-port", $serverSetting), icon: $("i.fa-plug"), invalid: false},
			user 				: {form: $("#synapse-server-user", $serverSetting), icon: $("i.fa-user"), invalid: false},
			privateKeyPath	: {form: $("#synapse-server-privateKey-path", $serverSetting), icon: $("i.fa-key"), invalid: false},
			passphrase	: {form: $("#synapse-server-passphrase", $serverSetting), icon: $("i.fa-unlock-alt"), invalid: false},
			name				: {form: $("#synapse-server-setting-name", $serverSetting), icon: $("i.fa-barcode"), invalid: false},
			dir	 				: {form: $("#synapse-server-dir", $serverSetting), icon: $("i.fa-sitemap"), invalid: false},
			exclude			: {form: $("#synapse-server-exclude", $serverSetting), icon: $("i.fa-ban"), invalid: false}
		};
		sftpPassword = {
			host 				: {form: $("#synapse-server-host", $serverSetting), icon: $("i.fa-desktop"), invalid: false},
			port 				: {form: $("#synapse-server-port", $serverSetting), icon: $("i.fa-plug"), invalid: false},
			user 				: {form: $("#synapse-server-user", $serverSetting), icon: $("i.fa-user"), invalid: false},
			password		: {form: $("#synapse-server-password", $serverSetting),icon: $("i.fa-unlock"), invalid: false},
			name				: {form: $("#synapse-server-setting-name", $serverSetting), icon: $("i.fa-barcode"), invalid: false},
			dir	 				: {form: $("#synapse-server-dir", $serverSetting), icon: $("i.fa-sitemap"), invalid: false},
			exclude			: {form: $("#synapse-server-exclude", $serverSetting), icon: $("i.fa-ban"), invalid: false}
		};

		var currentProtocol = $("#currentProtocol").val();
		var auth = $("#currentAuth").val();
		
		var values = "";
		if (currentProtocol === "ftp") {
			values = ftp;
		} else if (currentProtocol === "sftp") {
			if (auth === "key") {
				values = sftpKey;
			} else if (auth === "password") {
				values = sftpPassword;
			}
		}
		
		var keys = Object.keys(values);

		keys.forEach(function (key) {
			values[key].form.removeClass("invalid");
			values[key].invalid = false;
			values[key].icon.removeClass("done");
		});

		var invalidCnt = 0;

		var returnValue = false;

		keys.forEach(function (key) {
			var obj = values[key];
			if (!validate(key, obj.form.val())) {
				obj.invalid = true;
				obj.form.addClass("invalid");
				obj.icon.removeClass("done");
				invalidCnt++;
			} else {
				obj.form.removeClass("invalid");
				obj.icon.addClass("done");
			}
			invalid.push(obj);
		});

		if (invalidCnt === 0) {
			var result = new Server();
			keys.forEach(function(key) {
				result[key] = values[key].form.val();
			});
			_setServerBtnState("enabled");
			returnValue = result;
		} else {
			_setServerBtnState("disabled");
		}

		return returnValue;
	};

	/**
	 * Validate each properties of server setting
	 * 
	 * @param {string} target property name.
	 * @param {value} entered value.
	 * @return {boolean} that will be true if value passed validate, or false if value is invalid.
	 */
	validate = function (prop, value) {
		if (prop === "host") {
			return value !== "" && value.match(regexp.host);
		}
		if (prop === "port") {
			return value !== "" && value.match(regexp.port);
		}
		if (prop === "user") {
			return value !== "";
		}
		if (prop === "password") {
			return value !== "";
		}
		if (prop === "privateKeyPath") {
			return value !== "";
		}
		if (prop === "passphrase") {
			return true;
		}
		if (prop === "name") {
			return true;
		}
		if (prop === "dir") {
			return !(value.match(/\.{2,}/)) && !(value.match(/\/\//)) || (value === "");
		}
		if (prop === "exclude") {
			if (value !== "") {
				var error = false;
				var tmp = value.split(",");
				if (tmp.length > 0) {
					_.forEach(tmp, function (val) {
						if (val.trim() === "") {
							error = true;
						}
					});
				}
				if (error) {
					return false;
				} else {
					return true;
				}
			} else {
				return true;
			}
		}

	};

	
	reset = function () {
		return init();
	};
	
	/**
	 * Remove server setting at index
	 * 
	 * @param {integer} the index of setting in the server list..
	 */
	deleteServerSetting = function (index) {
		var deferred = new $.Deferred(),
				slist = getServerSettingsCache(),
				result = getServerSetting(index),
				list = _.filter(slist, function (item, idx, ary) {
					return item.index !== index;
				});
		setServerSettings(list);
		PreferenceManager.saveServerSettings(list)
		.then(function () {
			Log.q("Delete the server setting was successful.");
			deferred.resolve();
		}, function (err) {
			Log.q("Failed to the server setting deleted.", true, err);
			deferred.reject();
		});
		return deferred.promise();
	};

	setServerSettings = function (settings) {
		_serverSettings = settings;
	};
	
	getServerSetting = function (index) {
		var list = getServerSettingsCache();
		var res = null;
		list.forEach(function (item) {
			if (item.index === index) {
				res = item;
			}
		});
		return res;
	};
	
	_setServerBtnState = function (state) {
		var dev_null = null;
		var _state = state;
		if (state !== "enabled" && state !== "disabled") {
			_state = "enabled";
		}
		var $btn = $(".synapse-server-setting-footer button.btn-add");
		var prop = $btn.prop("disabled");
		if (_state === "disabled") {
			if ($btn.hasClass("disabled")) {
				return;
			} else {
				dev_null = $btn.addClass("disabled");
				dev_null = $btn.prop("disabled", true);
			}
		} else if (_state === "enabled") {
			if (!$btn.hasClass("disabled")) {
				return;
			} else {
				dev_null = $btn.removeClass("disabled");
				dev_null = $btn.prop("disabled", false);
			}
		}
	};

	getServerSettingsCache = function () {
		return _serverSettings;
	};

	/**
	 * The function is the save server setting main process.
	 * * main process invoked by edit function,
	 * * this function has some process, 
	 * * first, fairing entered current directory value by protocol.
	 * * next, create name value if that is not enterred.
	 * 
	 * @param {string} state "update" or "insert"
	 * @param {object} entered values of server setting
	 * @return {$.Promise} passthrough from PreferenceManager.saveServerSettings
	 */
	_editServerSetting = function (state, setting) {
		var list = getServerSettingsCache(),
				deferred = new $.Deferred(),
				temp = [];

		setting.dir = PathManager.removeTrailingSlash(setting.dir);
		
		
		if (setting.protocol === "sftp") {
			setting.dir = setting.dir === "" ? "./" : setting.dir;
			if (setting.auth === "key") {
				delete setting.password;
			} else
			if (setting.auth === "password") {
				delete setting.privateKeyPath;
				delete setting.passphrase;
			}
		}
		if (setting.protocol === "ftp") {
			delete setting.passphrase;
			delete setting.privateKeyPath;
		}

		if (setting.name === "") {
			setting.name = setting.host + "@" + setting.user;
		}
		
		if (state === "update") {
			setting.index = $("#synapse-server-setting").data("index");
			temp = _.map(list, function (item, idx, ary) {
				return (item.index === setting.index) ? setting : item;
			});
			list = temp;
		} else {
			list.push(setting);
		}
		var index;
		for (index = 0; index < list.length; index++) {
			list[index].index = index+1;
		}
		PreferenceManager.saveServerSettings(list)
		.then(function () {
			var msg = "";
			if (state === "update") {
				msg = "Update the server setting was successful.";
			} else {
				msg = "Append the server setting was successful.";
			}
			Log.q(msg);
			setServerSettings(list);
			deferred.resolve();
		}, function (err) {
			Log.q("Failed to save the server settings", true, err);
			deferred.reject(err);
		});
		
		return deferred.promise();
	};
	

	/**
	 * Do connect to server for confirm whether authentication will be pass or not.
	 * 
	 * @param {object} entered values.
	 * @return {$.Promise} a promise that will be resolved, if account pass auth.
	 */
	_connectTest = function (setting) {
		var deferred = new $.Deferred();
		var method = "";
		if (setting.protocol === "sftp") {
			method = "sftpConnectTest";
		} else {
			method = "connectTest";
		}
		Panel.showSpinner();
		Shared.domain.exec(method, setting)
		.then(function (res) {
			deferred.resolve(res);
		}, function (err) {
			Log.q("Failed to authentication, please confirm your server setting.", true, err);
			console.log(err);
			deferred.reject(err);
		})
		.always(function () {
			Panel.hideSpinner();
		});
		return deferred.promise();
	};
	
	
	
	EventDispatcher.makeEventDispatcher(exports);

	exports.init = init;
	exports.edit = edit;
	exports.validateAll = validateAll;
	exports.reset = reset;
	exports.getServerSetting = getServerSetting;
	exports.setServerSettings = setServerSettings;
	exports.getServerSettingsCache = getServerSettingsCache;
	exports.deleteServerSetting = deleteServerSetting;
	exports.getModuleName = function () {
		return module.id;
	};
});
