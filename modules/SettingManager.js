/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	"use strict";

	var PreferencesManager = brackets.getModule("preferences/PreferencesManager");
	var PathManager = require("modules/PathManager");
	var Panel = require("modules/Panel");
	var _ = brackets.getModule("thirdparty/lodash");

	// public methods
	var init,
			edit,
			validateAll,
			validate,
			reset,
			getServerList,
			getServerSetting,
			deleteServerSetting
			;

	var _getServerSettings,
			_rebuildIndex,
			_editServerSetting,
			_saveServerSettings,
			_connectTest,
			_showSettingAlert,
			_hideSettingAlert,
			_appendServerBtnState,
			_showConnectTestSpinner,
			_hideConnectTestSpinner
			;

	var domain,
			preferences = PreferencesManager.getExtensionPrefs("brackets-synapse");
	var Server = function () {
		this.host = null;
		this.port = 21;
		this.user = null;
		this.password = null;
		this.dir = null;
	};
	var $serverSetting = null;
	var regexp = {
		host: null,
		port: null,
		path: null
	};



	init = function (_domain) {
		var deferred = new $.Deferred();
		domain = _domain;

		$serverSetting = $("#synapse-server-setting");
		regexp.host = new RegExp("^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9])$");
		regexp.port = new RegExp("[1-65535]");
		regexp.unix_path = new RegExp("^$|^\\.\\/.*?|^\\/.*?");
		regexp.win_path = new RegExp("^[a-z]\\:\\\.*?");
		$("input", $serverSetting).val("").removeClass("invalid");
		$("th > i", $serverSetting).removeClass("done");
		$("button.btn-add").addClass("disabled");
		deferred.resolve(domain);
		return deferred.promise();
	};

	edit = function (state) {
		var deferred = new $.Deferred();
		var setting = validateAll();
		if (setting !== false) {
			_appendServerBtnState("disabled");
			_connectTest(setting)
				.done(function () {
					_editServerSetting(state, setting)
						.then(function () {
							Panel.showServerList();
						}, deferred.reject);
				})
				.fail(function (err) {
					_showSettingAlert("Failed", "Could not connect to server");
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

		var values = {
			host 		: {form: $("#synapse-server-host", $serverSetting), icon: $("i.fa-desktop"), invalid: false},
			port 		: {form: $("#synapse-server-port", $serverSetting), icon: $("i.fa-plug"), invalid: false},
			user 		: {form: $("#synapse-server-user", $serverSetting), icon: $("i.fa-user"), invalid: false},
			password: {form: $("#synapse-server-password", $serverSetting),icon: $("i.fa-unlock-alt"), invalid: false},
			dir	 		: {form: $("#synapse-server-dir", $serverSetting), icon: $("i.fa-sitemap"), invalid: false}
		};

		var keys = Object.keys(values);

		keys.forEach(function (key) {
			values[key].form.removeClass("invalid");
			values[key].invalid = false;
			values[key].icon.removeClass("done");
		});

		var invalidCnt = 0;

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
			return result;
		} else {
			_appendServerBtnState("disabled");
			return false;
		}
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
		if (prop === "dir") {
			return value === "" || (value.match(regexp.unix_path) || value.match(regexp.win_path));
		}

	};

	reset = function () {
		return init(domain);
	};

	deleteServerSetting = function (index) {
		var deferred = new $.Deferred();
		var slist = getServerList();
		var result = getServerSetting(index);
		var list = _.filter(slist, function (item, idx, ary) {
			return item.index !== index;
		});
		_saveServerSettings(list)
		.then(deferred.resolve);

		return deferred.promise();
	};

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

	_getServerSettings = function () {
		var json = preferences.get("server-settings");
		if (typeof (json) === "undefined") {
			preferences.definePreference("server-settings", "string", JSON.stringify([]));
			return [];
		} else {
			return JSON.parse(json);
		}
	};

	getServerList = function () {
		return _getServerSettings();
	};

	getServerSetting = function (index) {
		var list = _getServerSettings();
		var res = null;
		list.forEach(function (item) {
			if (item.index === index) {
				res = item;
			}
		});
		return res;
	};

	_editServerSetting = function (state, setting) {
		var list = _getServerSettings(),
				deferred = new $.Deferred(),
				index,
				temp = [];
		
		if (setting.dir.length > 1) {
			if (setting.dir.slice(-1) === "/") {
				setting.dir = setting.dir.slice(0, -1);
			}
		}
		
		if (state === "UPDATE") {
			setting.index = $("#synapse-server-setting").data("index");
			temp = _.map(list, function (item, idx, ary) {
				return (item.index === setting.index) ? setting : item;
			});
			list = temp;
		} else {
			list.push(setting);
		}
		_saveServerSettings(list)
			.then(function () {
				deferred.resolve(setting);
			}, deferred.reject);
		return deferred.promise();
	};

	_saveServerSettings = function (list) {
		var deferred = new $.Deferred();
		if (!preferences.set("server-settings", JSON.stringify(list))) {
			deferred.reject("could not set server configuration to preference.");
		} else {
			preferences.save()
				.then(_rebuildIndex)
				.then(deferred.resolve)
				.fail(function () {
					deferred.reject("could not save server configuration to preference.");
			});
		}
		return deferred.promise();
	};

	_showSettingAlert = function (title, caption) {
		var $container = $("<div/>").addClass("synapse-server-setting-alert")
				.html($("<p/>").html(title).addClass("synapse-server-setting-alert-title"))
				.append($("<p/>").html(caption).addClass("synapse-server-setting-alert-caption"));

		$("#synapse-server-setting").append($container);

		var height = $container.outerHeight();
		var left   = "-" + $container.outerWidth() + "px";
		var settingHeight = $("#synapse-server-setting").height();
		var top = (settingHeight - height) / 2;
		$container.css({"top": top + "px", "left": left});
		$container.animate({"left": left, "opacity": 1}, 100, function () {
			$("#synapse-server-setting input").addClass("disabled");
			$("#synapse-server-setting input").prop("disabled", true);
			$("#synapse-server-setting button").addClass("disabled");
			$("#synapse-server-setting button").prop("disabled", true);
			$(this).on("click", _hideSettingAlert);
		});
	};

	_hideSettingAlert = function (e) {
		var $container = $(e.currentTarget);
		var left = "-" + $container.outerWidth() + "px";
		$container.off("click", _hideSettingAlert);
		$container.animate({"left": left, "opacity": 0}, 100, function () {
			$("#synapse-server-setting input").removeClass("disabled");
			$("#synapse-server-setting input").prop("disabled", false);
			$("#synapse-server-setting button").removeClass("disabled");
			$("#synapse-server-setting button").prop("disabled", false);
			$container.remove();
		});
	};

	_rebuildIndex = function () {
		var list = _getServerSettings();
		var deferred = new $.Deferred();
		var i;

		for (i = 0; i < list.length; i++) {
			list[i].index = i + 1;
		}
		if (preferences.set("server-settings", JSON.stringify(list))) {
			preferences.save().then(deferred.resolve, deferred.reject);
		} else {
			deferred.reject("could not reset server configuration unique id");
		}
		return deferred.promise();
	};

	_connectTest = function (server) {
		var deferred = new $.Deferred();
		var remotePath = server.dir === "" ? "./" : server.dir;

		Panel.showHeaderSpinner();

		domain.exec("Connect", server, remotePath)
			.done(function (list) {
				deferred.resolve();
			})
			.fail(function (err) {
				deferred.reject(err);
			})
			.always(function () {
				Panel.hideHeaderSpinner();
			});
		return deferred.promise();
	};



	exports.init = init;
	exports.edit = edit;
	exports.validateAll = validateAll;
	exports.reset = reset;
	exports.getServerList = getServerList;
	exports.getServerSetting = getServerSetting;
	exports.deleteServerSetting = deleteServerSetting;

});
