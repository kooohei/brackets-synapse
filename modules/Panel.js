/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	"use strict";
	
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var Resizer = brackets.getModule("utils/Resizer");
	var Strings = require("strings");
	var TreeView = require("modules/TreeView");
	var Project = require("modules/Project");
	var SettingManager = require("modules/SettingManager");
	var _domain = null;
	
	//Methods
	var init,
		initMainUI,
		initServerSettingUI,
		closeProject,
		showMain,
		hideMain,
		connect,
		showSpinner,
		hideSpinner,
		_onAppend
		;
	
	// Private methods
	var _showServerSetting,
			_toggleServerSetting,
			_hideServerSetting;
	
	var main_html = require("../text!ui/main.html");
	var server_setting_html = require("../text!ui/serverSetting.html");
	var $sidebar = $("#sidebar");
	var $synapse = null;
	
	//ExtensionUtils.loadStyleSheet(module, "../ui/css/jstree-style.css");
	
	ExtensionUtils.loadStyleSheet(module, "../ui/css/style.css");
	ExtensionUtils.loadStyleSheet(module, "../node_modules/font-awesome/css/font-awesome.min.css");
	ExtensionUtils.loadStyleSheet(module, "../node_modules/jstree/dist/themes/default-dark/style.min.css");
	
	
	init = function (domain) {
		_domain = domain;
		var deferred = new $.Deferred();
		initMainUI();
		initServerSettingUI();
		TreeView.init(_domain);
		
		//for Devel
		showMain();
		brackets.app.showDeveloperTools();
		return deferred.resolve().promise();
	};
	
	initMainUI = function () {
		var html = Mustache.render(main_html, {
			Strings: Strings
		});
		$synapse = $(html);
		$synapse.css({
			"bottom": "-1500px",
			"display": "none"
		});
		$sidebar.append($synapse);
		
		$(".disconnect-btn", $synapse).on("click", closeProject);
		$(".close-btn", $synapse).on("click", hideMain);
		$(".add-btn", $synapse).on("click", _showServerSetting);
	};
	
	initServerSettingUI = function () {
		var html = Mustache.render(server_setting_html);
		var $serverSetting = $(html);
		$("#synapse-header", $synapse).after($serverSetting);
		$(".btn-add", $serverSetting).on("click", _onAppend);
		$(".btn-cancel", $serverSetting).on("click", _toggleServerSetting);
		$("input", $serverSetting).on("blur", SettingManager.validateAll);
	};
	
	showMain = function () {
		$("#project-files-header").css({
			"display": "none"
		});
		$("#project-files-container").css({
			"display": "none"
		});
		$synapse.css({
			"bottom": "-1500px",
			"display": "block"
		});
		
		$synapse.animate({
			"bottom": "0px"
		}, "fast");
	};
	
	hideMain = function () {
		$synapse.animate({
			"bottom": "-1000px"
		}, "fast", function () {
			$(this).css({
				"display": "none"
			});
			$("#project-files-header").css({
				"display": ""
			});
			$("#project-files-container").css({
				"display": ""
			});
		});
	};
	
	_toggleServerSetting = function () {
		$(".add-btn", $synapse).off("click", _toggleServerSetting);
		var $container = $("#synapse-treeview-container");
		
		if ($container.hasClass("open")) {
			_hideServerSetting()
				.done(function () {
					$(".add-btn", $synapse).on("click", _toggleServerSetting);
			});
		} else {
			_showServerSetting()
				.done(function () {
					$(".add-btn", $synapse).on("click", _toggleServerSetting);
			});
		}
		/*
		TreeView.connect(server);
		*/
	};
	
	_showServerSetting = function () {
		var $container = $("#synapse-treeview-container");
		if ($container.hasClass("open")) {
			return;
		}
		var serverSettingHeight = $("#synapse-server-setting").outerHeight() + "px";
		$container.animate({"top": serverSettingHeight}, "fast", function () {
			$(this).addClass("open");
		});
		
		$("#synapse-server-host").val("s2.bitglobe.net");
		$("#synapse-server-port").val("21");
		$("#synapse-server-user").val("hayash");
		$("#synapse-server-password").val("kohei0730");
		
		return new $.Deferred().resolve().promise();
	};
	
	_hideServerSetting = function () {
		var $container = $("#synapse-treeview-container");
		$container.animate({"top": 0}, "fast", function () {
			$(this).removeClass("open");
			SettingManager.reset();
		});
		return new $.Deferred().resolve().promise();
	};
	
	_onAppend = function (e) {
		SettingManager.append();
	};
	
	showSpinner = function () {
		var $spinnerContainer = $("#synapse .spinnerContainer");
		var $spinner = $("#synapse .spinner");
		if ($spinnerContainer.hasClass("hide")) {
			$spinnerContainer.removeClass("hide");
			if (!$spinner.hasClass("spin")) {
				$spinner.addClass("spin");
			}
		}
	};
	
	hideSpinner = function () {
		var $spinnerContainer = $("#synapse .spinnerContainer");
		var $spinner = $("#synapse .spinner");
		if (!$spinnerContainer.hasClass("hide")) {
			$spinnerContainer.addClass("hide");
			if ($spinner.hasClass("spin")) {
				$spinner.removeClass("spin");
			}
		}
	};
	
	closeProject = function (e) {
		var test = {
			host: "s2.bitglobe.net",
			port: 21,
			user: "hayashi",
			password: "kohei0730",
			dir: "/home/hayashi"
		};
		TreeView.connect(test);
		
//		
//		var $btn = $(e.currentTarget);
//		if ($btn.hasClass("disabled")) {
//			//return;
//		}
//		Project.close();
	};
	
	exports.init = init;
	exports.showMain = showMain;
	exports.showSpinner = showSpinner;
	exports.hideSpinner = hideSpinner;
});