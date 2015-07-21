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
		_initMainUI,
		_initServerSettingUI,
		_initServerListUI,
		closeProject,
		showMain,
		hideMain,
		connect,
		reloadServerSettingList,
		showSpinner,
		hideSpinner,
		showHeaderSpinner,
		hideHeaderSpinner,
		_onEdit,
		_onClickConnectBtn,
		_onClickEditBtn,
		_onClickDeleteBtn,
		_onEnterListBtns,
		_onLeaveListBtns;

	// Private methods
	var _showServerSetting,
		_toggleServerSetting,
		_hideServerSetting,
		_showServerList,
		_hideServerList;
	
	var j = {
		get sb() {
			return $("#sidebar");
		},
		get w() {
			return $("#working-set-list-container");
		},
		get ph() {
			return $("#project-files-header");
		},
		get pc() {
			return $("#project-files-container");
		},
		get m() {
			return $("#synapse");
		},
		get h() {
			return $("#synapse-header");
		},
		get s() {
			return $("#synapse-server-setting");
		},
		get l() {
			return $("#synapse-server-list");
		},
		get tv() {
			return $("#synapse-treeview-container");
		}
	};
	

	var main_html = require("../text!ui/main.html");
	var server_setting_html = require("../text!ui/serverSetting.html");
	var server_list_html = require("../text!ui/serverList.html");
	var $sidebar = $("#sidebar");


	ExtensionUtils.loadStyleSheet(module, "../ui/css/style.css");
	ExtensionUtils.loadStyleSheet(module, "../node_modules/font-awesome/css/font-awesome.min.css");
	ExtensionUtils.loadStyleSheet(module, "../node_modules/jstree/dist/themes/default-dark/style.min.css");

	init = function (domain) {
		_domain = domain;
		var deferred = new $.Deferred();
		_initMainUI()
		.then(_initServerSettingUI)
		.then(_initServerListUI)
		.then(function () {
			TreeView.init(_domain);
			//for Devel
			//showMain();
			brackets.app.showDeveloperTools();
		});
		return deferred.resolve().promise();
	};
	
	showMain = function () {
		var $main = j.m;
		
		var $pc = j.pc;
		var $ph = j.ph;
		var pcHeight = $pc.outerHeight() + j.ph.outerHeight();
		var offset = $main.outerHeight() - pcHeight;
		var $ph_pcChild = $("#project-files-header, #project-files-container > *");
		var $ph_pc = $("#project-files-header, #project-files-container");
		
		$pc.animate({"height": offset + "px"}, "fast", function () {
			$ph_pcChild.animate({"opacity": 0}, "fast", function () {
				
				$pc.css({"overflow-x": "hidden", "overflow-y": "hidden"});
				var height = $main.outerHeight() - j.h.outerHeight();
				j.tv.css({"height": height + "px"});
				$ph_pc.css({"display": "none"});
				
				$main.css({
					"margin-right": "-" + (j.m.outerWidth() * 2) + "px",
					"width": $main.width * 2,
					"display": "block"
				});

				$main.animate({
					"left": 0
				}, "fast");
			});
		});
	};
	
	hideMain = function () {
		var $main = j.m;
		var height = $main.outerHeight();
		$main.animate({
			"bottom": "-" + height + "px"
		}, "fast", function () {
			$(this).css({
				"display": "none"
			});
			$("#project-files-header, #project-files-container").css({
				"display": "",
			});
			$("#project-files-header, #project-files-container > *").animate({
				"opacity": 1
			}, 300);
		});
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
	
	showHeaderSpinner = function () {
		$("#synapse-header .spinner").addClass("spin").removeClass("hide");
	};
	
	hideHeaderSpinner = function () {
		$("#synapse-header .spinner").addClass("hide").removeClass("spin");
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
	
	reloadServerSettingList = function () {
		var $synapse = $("#synapse");
		var $serverList = null;
		
		if ($("#synapse-server-list").length) {
			$serverList = $("#synapse-server-list");
			$("button.btn-connect", $serverList).off("click", _onClickConnectBtn);
			$("button.btn-edit", $serverList).off("click", _onClickEditBtn);
			$("button.btn-delete", $serverList).off("click", _onClickDeleteBtn);
			$(".close-btn", $serverList).off("click", _hideServerList);
			$("div.item", $serverList).off({
				"mouseenter": _onEnterListBtns,
				"mouseleave": _onLeaveListBtns
			});
			$("#synapse-server-list").remove();
		}
		var list = SettingManager.getServerList();
		var html = Mustache.render(server_list_html, {
			serverList: list
		});
		var $html = $(html);
		$("#synapse-server-setting").after($html);
		
		$serverList = $("#synapse-server-list");
		$("button.btn-connect", $serverList).on("click", _onClickConnectBtn);
		$("button.btn-edit", $serverList).on("click", _onClickEditBtn);
		$("button.btn-delete", $serverList).on("click", _onClickDeleteBtn);
		$(".close-btn", $serverList).on("click", _hideServerList);
		$("div.item", $serverList).on({
			"mouseenter": _onEnterListBtns,
			"mouseleave": _onLeaveListBtns
		});
		$("#synapse-server-list div.list").addClass("quiet-scrollbars");
		
		return new $.Deferred().resolve().promise();
	};
	
	
	
	_initMainUI = function () {
		var html = Mustache.render(main_html, {Strings: Strings});
		var $main = $(html);
		var $pc = j.pc;
		
		if ($pc.length) {
			$pc.after($main);
		} else {
			j.sb.append($main);
		}
		$("span.disconnect-btn", $main).on("click", closeProject);
		$("span.list-btn", $main).on("click", _showServerList);
		$("span.close-btn", $main).on("click", hideMain);
		$("span.add-btn", $main).on("click", function (e) {
			_showServerSetting(e, "insert", null);
		});
		return new $.Deferred().resolve().promise();
	};
	
	_initServerSettingUI = function () {
		var html = Mustache.render(server_setting_html);
		var $serverSetting = $(html);
		j.h.after($serverSetting);

		$(".btn-add", $serverSetting).on("click", _onEdit);
		$(".btn-cancel", $serverSetting).on("click", _toggleServerSetting);
		$(".close-btn", $serverSetting).on("click", _toggleServerSetting);
		$("input", $serverSetting).on("blur", SettingManager.validateAll);
		return new $.Deferred().resolve().promise();
	};
	
	_initServerListUI = function () {
		reloadServerSettingList();
		return new $.Deferred().resolve().promise();
	};
	
	_toggleServerSetting = function () {
		var $main = j.m;
		$(".add-btn", $main).off("click", _toggleServerSetting);
		var $container = j.s;

		if ($container.hasClass("open")) {
			_hideServerSetting()
				.done(function () {
					$(".add-btn", $main).on("click", _toggleServerSetting);
				});
		} else {
			_showServerSetting(null, "insert", null)
				.done(function () {
					$(".add-btn", $main).on("click", _toggleServerSetting);
				});
		}
		/*
		TreeView.connect(server);
		*/
	};
	
	_showServerSetting = function (e, state, setting) {
		var $container = $("#synapse-treeview-container");
		if ($container.hasClass("open")) {
			return;
		}
		var $settingElem = $("#synapse-server-setting");
		var serverSettingHeight = $settingElem.outerHeight() + "px";
		$container.animate({
			"top": serverSettingHeight
		}, "fast", function () {
			$(this).addClass("open");
		});
		if (state === "update") {
			$settingElem.data("index", setting.index);
			$("#synapse-server-host").val(setting.host);
			$("#synapse-server-port").val(setting.port);
			$("#synapse-server-user").val(setting.user);
			$("#synapse-server-password").val(setting.password);
			$("#synapse-server-dir").val(setting.dir);
			$("#synapse-server-setting button.btn-add")
				.html("UPDATE")
				.css({
					"background-color": "#5cb85c"
				})
				.removeClass("disabled")
				.prop("disabled", false);
		} else {
			$("#synapse-server-setting button.btn-add")
				.html("APPEND")
				.css({
					"background-color": "#016dc4"
				});
		}
		return new $.Deferred().resolve().promise();
	};
	
	_hideServerSetting = function () {
		var $container = $("#synapse-treeview-container");
		$container.animate({
			"top": 0
		}, "fast", function () {
			$(this).removeClass("open");
			SettingManager.reset();
		});
		return new $.Deferred().resolve().promise();
	};
	
	_showServerList = function () {
		reloadServerSettingList()
		.then(function () {
			var $serverList = $("#synapse-server-list");
			var state = $serverList.data("state");
			if (state !== "close") {
				return;
			}
			var $treeviewContainer = $("#synapse-treeview-container");
			var height = ($("#synapse-header").outerHeight() + $("#synapse-server-setting").outerHeight()) - 250;
			$treeviewContainer.animate({
				"height": height + "px",
			}, "fast", function () {
				$serverList.data("opened", "true");
			});
		});
	};
	
	_hideServerList = function () {
		var $serverList = $("#synapse-server-list");
		if ($serverList.data("opened") !== "true") {
			return;
		}

		var $treeviewContainer = $("#synapse-treeview-container");
		var height = $treeviewContainer + $serverList.outerHeight() + "px";

		$treeviewContainer.animate({
			"height": height,
			"bottom": 0
		}, "fast", function () {
			$serverList.data("opened", "false");
		});
		/*
		var bottom = "-" + $serverList.outerHeight() + "px";
		$serverList.animate({"bottom": bottom}, "fast", function () {
			$serverList.addClass("hide");
		});
		*/
	};
	
	_onEdit = function (e) {
		var $btn = $(e.currentTarget);
		SettingManager.edit($btn.html());
	};
	
	_onClickConnectBtn = function (e) {
		var $btn = $(e.currentTarget);
		var index = $btn.data("index");
		console.log(index);
	};
	
	_onClickEditBtn = function (e) {
		var idx = $(this).data("index");
		var setting = SettingManager.getServerSetting(idx);
		if (setting === null) {
			console.error("could not read server setting for index: " + idx);
			return;
		}
		_showServerSetting(null, "update", setting);
	};
	
	_onClickDeleteBtn = function (e) {

	};
	
	_onEnterListBtns = function (e) {
		$(this).find(".btn-group").animate({
			"opacity": 1
		}, 200);
	};
	
	_onLeaveListBtns = function (e) {
		$(this).find(".btn-group").animate({
			"opacity": 0
		}, 200);
	};
	


	exports.init = init;
	exports.showMain = showMain;
	exports.showSpinner = showSpinner;
	exports.hideSpinner = hideSpinner;
	exports.showHeaderSpinner = showHeaderSpinner;
	exports.hideHeaderSpinner = hideHeaderSpinner;
	exports.reloadServerSettingList = reloadServerSettingList;
});