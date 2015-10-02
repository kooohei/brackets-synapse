/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50, boss: true */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	// HEADER >>
	var PreferencesManager = brackets.getModule("preferences/PreferencesManager");
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var _ = brackets.getModule("thirdparty/lodash");
	var PathManager = require("modules/PathManager");
	var FileManager = require("modules/FileManager");
	var Panel = require("modules/Panel");
	var Strings = require("strings");
	var Utils = require("modules/Utils");
	var CryptoManager = require("modules/CryptoManager");
	var PreferenceManager = require("modules/PreferenceManager");
	var Notify = require("modules/Notify");
	var l = require("modules/Utils").l;
	var Log = require("modules/Log");
	var Shared = require("modules/Shared");

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
			_appendServerBtnState
			;
	
	var SERVER_SETTING_REMOVED = "SERVER_SETTING_REMOVED";
	var COULD_NOT_REMOVE_SERVER_SETTING = "COULD_NOT_REMOVE_SERVER_SETTING";
	var SERVER_SETTING_ADDED = "SERVER_SETTING_ADDED";
	var COULD_NOT_INSERT_NEW_SERVER_SETTING= "COULD_NOT_INSERT_NEW_SERVER_SETTING";
	
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
		path: null,
		unix_path: null,
		win_path: null
	};

	// <<
	
	/* Public Methods */
	init = function () {
		var deferred = new $.Deferred();
		
		$serverSetting = $("#synapse-server-setting");
		regexp.host = new RegExp("^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9])$");
		regexp.port = new RegExp("[1-65535]");
		regexp.unix_path = new RegExp("^$|^\\.\\/.*?|^\\/.*?");
		regexp.win_path = new RegExp("^[a-zA-Z]\\:\\\.*?");

		$("input[type='text'], input[type='password']", $serverSetting).val("").removeClass("invalid");
		$("th > i", $serverSetting).removeClass("done");
		$("th > i.fa-plug", $serverSetting).addClass("done");
		$("button.btn-add").addClass("disabled");
		
		return deferred.resolve(domain).promise();
	};

	/**
	 * called by [Panel.onEdit]
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
			_appendServerBtnState("disabled");
			_connectTest(setting)
			.then(function () {
				return $.Deferred().resolve().promise();
			}, function (err) {
				Log.q("Authentication Error. Please check the setting you input.", true, err);
				return $.Deferred().reject().promise();
			})
			.then(function () {
				_editServerSetting(state, setting)
					.then(function () {
						// TODO: サーバ設定が追加されました。
						if (state === "update") {
							Log.q("Complete, update the server setting.", false);
						} else {
						// TODO: サーバ設定の編集が完了しました。
							Log.q("the server setting stored.", false);
						}
						Panel.showServerList();
					}, deferred.reject);
			}, function (err) {
				// Log is shown at the above depend funcs.
				deferred.reject(err);
			}).always(function () {
				_appendServerBtnState("enabled");
			});
		}
		return deferred.promise();
	};

	validateAll = function () {
		var deferred = new $.Deferred();
		var invalid = [];

		var ftp = {
			host 				: {form: $("#synapse-server-host", $serverSetting), icon: $("i.fa-desktop"), invalid: false},
			port 				: {form: $("#synapse-server-port", $serverSetting), icon: $("i.fa-plug"), invalid: false},
			user 				: {form: $("#synapse-server-user", $serverSetting), icon: $("i.fa-user"), invalid: false},
			password		: {form: $("#synapse-server-password", $serverSetting),icon: $("i.fa-unlock"), invalid: false},
			name				: {form: $("#synapse-server-setting-name", $serverSetting), icon: $("i.fa-barcode"), invalid: false},
			dir	 				: {form: $("#synapse-server-dir", $serverSetting), icon: $("i.fa-sitemap"), invalid: false},
			exclude			: {form: $("#synapse-server-exclude", $serverSetting), icon: $("i.fa-ban"), invalid: false}
		};
		var sftpKey = {
			host 				: {form: $("#synapse-server-host", $serverSetting), icon: $("i.fa-desktop"), invalid: false},
			port 				: {form: $("#synapse-server-port", $serverSetting), icon: $("i.fa-plug"), invalid: false},
			user 				: {form: $("#synapse-server-user", $serverSetting), icon: $("i.fa-user"), invalid: false},
			privateKey	: {form: $("#synapse-server-privateKey-path", $serverSetting), icon: $("i.fa-key"), invalid: false},
			passphrase	: {form: $("#synapse-server-passphrase", $serverSetting), icon: $("i.fa-unlock-alt"), invalid: false},
			name				: {form: $("#synapse-server-setting-name", $serverSetting), icon: $("i.fa-barcode"), invalid: false},
			dir	 				: {form: $("#synapse-server-dir", $serverSetting), icon: $("i.fa-sitemap"), invalid: false},
			exclude			: {form: $("#synapse-server-exclude", $serverSetting), icon: $("i.fa-ban"), invalid: false}
		};
		var sftpPassword = {
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
			_appendServerBtnState("enabled");
			returnValue = result;
		} else {
			_appendServerBtnState("disabled");
		}

		return returnValue;
	};

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
		if (prop === "privateKey") {
			return value !== "";
		}
		if (prop === "passphrase") {
			return true;
		}
		if (prop === "name") {
			return true;
		}
		if (prop === "dir") {
			return value === "" || (value.match(regexp.unix_path) || value.match(regexp.win_path));
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
		return init(domain);
	};

	deleteServerSetting = function (index) {
		var deferred = new $.Deferred();
		var slist = getServerSettingsCache();
		
		var result = getServerSetting(index);
		var list = _.filter(slist, function (item, idx, ary) {
			return item.index !== index;
		});
		setServerSettings(list);

		PreferenceManager.saveServerSettings(list)
		.then(function () {
			// TODO: サーバ設定を削除しました。
			deferred.resolve();
		}, function (err) {
			// TODO: サーバ設定の削除に失敗しました。
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
	

	
	/* Private Methods */
	_appendServerBtnState = function (state) {
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

	_editServerSetting = function (state, setting) {
		var list = getServerSettingsCache(),
				deferred = new $.Deferred(),
				temp = [];

		if (setting.dir.length > 1 && setting.dir !== "./") {
			if (setting.dir.slice(-1) === "/") {
				setting.dir = setting.dir.slice(0, -1);
			}
		}
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
		.then(deferred.resolve, deferred.reject);
		
		return deferred.promise();
	};
	

	/**
	 * called by edit())
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
		console.log(setting);
		Shared.domain.exec(method, setting)
		.then(function (res) {
			deferred.resolve();
		}, function (err) {
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
	exports.SERVER_SETTING_REMOVED = SERVER_SETTING_REMOVED;
	exports.COULD_NOT_REMOVE_SERVER_SETTING = COULD_NOT_REMOVE_SERVER_SETTING;
	exports.getModuleName = function () {
		return module.id;
	};
});
