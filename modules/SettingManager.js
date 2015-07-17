/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	"use strict";
	
	var PreferencesManager = brackets.getModule("preferences/PreferencesManager");
	var PathManager = require("modules/PathManager");
	
	// public methods
	var init,
			append,
			validateAll,
			validate,
			reset
			;
	
	var _getServerSettings,
			_rebuildIndex,
			_addServerSetting,
			_saveServerSettings,
			_connectTest,
			_showSettingAlert,
			_hideSettingAlert
			;
	
	var domain,
			preferences;
	
	// entity object
	var Server = function () {
		this.host = null;
		this.port = 21;
		this.user = null;
		this.password = null;
		this.dir = null;
	};
	// jquery elems
	var $serverSetting = null;
	// regexps
	var regexp = {
		host: null,
		port: null,
		path: null
	};
	
	init = function (_domain) {
		domain = _domain;
		preferences = PreferencesManager.getExtensionPrefs("brackets-synapse");
		$serverSetting = $("#synapse-server-setting");
		regexp.host = new RegExp("^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9])$");
		regexp.port = new RegExp("[1-65535]");
		regexp.unix_path = new RegExp("^$|^\\.\\/.*?|^\\/.*?");
		regexp.win_path = new RegExp("^[a-z]\\:\\\.*?");
		$("input", $serverSetting).val("");
		$("button.btn-add").addClass("disabled");
		return new $.Deferred().resolve().promise();
	};
	
	append = function () {
		var deferred = new $.Deferred();
		var setting = validateAll();
		if (setting !== false) {
			$("#synapse-server-setting-footer button.btn-add").prop("disabled", true);
			$("#synapse-server-setting-footer button.btn-add").addClass("disabled");
			_connectTest(setting)
				.done(function () {
					$("#synapse-server-setting-footer button.btn-add").prop("disabled", false);
					$("#synapse-server-setting-footer button.btn-add").removeClass("disabled");
					_addServerSetting(setting);
				})
				.fail(function (err) {
					_showSettingAlert("Failed", "Could not connect to server");
			});
		}
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
			$("button.btn-add").removeClass("disabled");
			
			var result = new Server();
			keys.forEach(function(key) {
				result[key] = values[key].form.val();
			});
			
			return result;
		} else {
			if (!$("button.btn-add", $serverSetting).hasClass("disabled")) {
				$("button.btn-add").addClass("disabled");
			}
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
		init();
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
			
	_addServerSetting = function (setting) {
		var list = _getServerSettings(),
				deferred = new $.Deferred();
		list.push(setting);
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
		$container.animate({"left": 0, "opacity": 1}, 100, function () {
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
		domain.exec("Connect", server, remotePath)
			.done(function (list) {
				deferred.resolve();
			})
			.fail(function (err) {
			console.log(err);
				deferred.reject(err);
		});
		return deferred.promise();
	};
	
	exports.init = init;
	exports.append = append;
	exports.validateAll = validateAll;
	exports.reset = reset;
});