/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	"use strict";

	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var Resizer = brackets.getModule("utils/Resizer");
	var Strings = require("strings");
	var Project = require("modules/Project");
	var DialogCollection = require("modules/DialogCollection");
	var _ = brackets.getModule("thirdparty/lodash");
	var FileTreeView = require("modules/FileTreeView");
	var SettingManager = require("modules/SettingManager");
	
	
	var TreeView = require("modules/TreeView");
	var RemoteManager = require("modules/RemoteManager");
	
	var _domain = null;
	
	var init,
		_initServerSettingUI,
		closeProject,
		hideMain,
		reloadServerSettingList,
		hideSpinner,
		hideHeaderSpinner,
		_onEdit,
		_onClickEditBtn,
		_onEnterListBtns,
		//Methods
		_initMainUI,
		_initServerListUI,
		showMain,
		connect,
		showSpinner,
		showHeaderSpinner,
		_reloadServerSettingListWhenDelete,
		_onClickConnectBtn,
		_onClickDeleteBtn,
		_onLeaveListBtns,
		// Private methods
		_hideServerSetting,
		_hideServerList,
		_showServerSetting,
		showServerList,
		_removeServerSettingListRow;

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
		get tvc() {
			return $("#synapse-treeview-container");
		}
	};


	var main_html = require("../text!ui/main.html");
	var server_setting_html = require("../text!ui/serverSetting.html");
	var server_list_html = require("../text!ui/serverList.html");
	var $sidebar = $("#sidebar");

	
	ExtensionUtils.loadStyleSheet(module, "../ui/css/style.css");
	ExtensionUtils.loadStyleSheet(module, "../ui/css/treeview.css");
	ExtensionUtils.loadStyleSheet(module, "../node_modules/font-awesome/css/font-awesome.min.css");
	//ExtensionUtils.loadStyleSheet(module, "../node_modules/jstree/dist/themes/default-dark/style.min.css");

	init = function (domain) {
		_domain = domain;
		var deferred = new $.Deferred();
		_initMainUI()
			.then(_initServerSettingUI)
			.then(_initServerListUI)
			.then(function () {
				//for Devel
				showMain();
				brackets.app.showDeveloperTools();
				return new $.Deferred().resolve().promise();
			});
		return deferred.resolve(domain).promise();
	};

	_initMainUI = function () {
		var html = Mustache.render(main_html, {
			Strings: Strings
		});
		var $main = $(html);
		var $pc = j.pc;

		if ($pc.length) {
			$pc.after($main);
		} else {
			j.sb.append($main);
		}
		$("span.disconnect-btn", $main).on("click", closeProject);
		$("span.list-btn", $main).on("click", showServerList);
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
		$(".btn-cancel", $serverSetting).on("click", _hideServerSetting);
		$(".close-btn", $serverSetting).on("click", _hideServerSetting);
		$("input", $serverSetting).on("blur", SettingManager.validateAll);
		return new $.Deferred().resolve().promise();
	};

	_initServerListUI = function () {
		reloadServerSettingList();
		return new $.Deferred().resolve().promise();
	};

	showMain = function () {
		var $main = j.m;
		var $ph_pcChild = $("#project-files-header, #project-files-container > *");
		var $ph_pc = $("#project-files-header, #project-files-container");

		$ph_pcChild.animate({
			"opacity": 0
		}, "fast", function () {
			$ph_pc.css({
				"display": "none"
			});
			$main.removeClass("hide");
			$main.css({
				"opacity": 0,
			});

			$main.animate({
				"opacity": 1
			}, "fast");
		});
	};

	hideMain = function () {
		var $main = j.m;
		var $ph_pcChild = $("#project-files-header, #project-files-container > *");
		var $ph_pc = $("#project-files-header, #project-files-container");

		$main.animate({
			"opacity": 0,
		}, "fast", function () {
			$(this).addClass("hide");
			$ph_pc.css({
				display: "block"
			});
			$ph_pcChild.animate({
				"opacity": 1
			}, "fast");

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
		//
		//		var $btn = $(e.currentTarget);
		//		if ($btn.hasClass("disabled")) {
		//			//return;
		//		}
		//		Project.close();
	};

	reloadServerSettingList = function () {

		if (j.l.length) {
			$("button.btn-connect", j.l).off("click", _onClickConnectBtn);
			$("button.btn-edit", j.l).off("click", _onClickEditBtn);
			$("button.btn-delete", j.l).off("click", _onClickDeleteBtn);
			$(".close-btn", j.l).off("click", _hideServerList);
			$("div.item", j.l).off({
				"mouseenter": _onEnterListBtns,
				"mouseleave": _onLeaveListBtns
			});
			j.l.remove();
		}
		var list = SettingManager.getServerList();
		var html = Mustache.render(server_list_html, {
			serverList: list
		});
		var $html = $(html);
		j.s.after($html);

		$("button.btn-connect", j.l).on("click", _onClickConnectBtn);
		$("button.btn-edit", j.l).on("click", _onClickEditBtn);
		$("button.btn-delete", j.l).on("click", _onClickDeleteBtn);
		$(".close-btn", j.l).on("click", _hideServerList);
		$("div.item", j.l).on({
			"mouseenter": _onEnterListBtns,
			"mouseleave": _onLeaveListBtns
		});
		$("#synapse-server-list div.list").addClass("quiet-scrollbars");

		return new $.Deferred().resolve().promise();
	};

	_reloadServerSettingListWhenDelete = function () {

		var deferred = new $.Deferred();
		if (!j.l.length) {
			return deferred.reject().promise();
		} else {
			$("button.btn-connect", j.l).off("click", _onClickConnectBtn);
			$("button.btn-edit", j.l).off("click", _onClickEditBtn);
			$("button.btn-delete", j.l).off("click", _onClickDeleteBtn);
			$(".close-btn", j.l).off("click", _hideServerList);
			$("div.item", j.l).off({
				"mouseenter": _onEnterListBtns,
				"mouseleave": _onLeaveListBtns
			});
		}
		var list = SettingManager.getServerList();
		var html = Mustache.render(server_list_html, {
			serverList: list
		});
		var $html = $(html);
		j.l.addClass("hide");
		j.l.remove();
		j.s.after($html);
		j.l.removeClass("hide");
		$("button.btn-connect", j.l).on("click", _onClickConnectBtn);
		$("button.btn-edit", j.l).on("click", _onClickEditBtn);
		$("button.btn-delete", j.l).on("click", _onClickDeleteBtn);
		$(".close-btn", j.l).on("click", _hideServerList);
		$("div.item", j.l).on({
			"mouseenter": _onEnterListBtns,
			"mouseleave": _onLeaveListBtns
		});
		$("#synapse-server-list div.list").addClass("quiet-scrollbars");
		deferred.resolve();
		return deferred.promise();

	};

	_showServerSetting = function (e, state, setting) {
		var deferred = new $.Deferred();
		// when the setting form is already opened
		if (!j.s.hasClass("hide")) {
			return deferred.resolve().promise();
		}

		function open() {
			SettingManager.reset()
				.then(function () {
					if (state === "update") {
						j.s.data("index", setting.index);
						$("#synapse-server-host").val(setting.host);
						$("#synapse-server-port").val(setting.port);
						$("#synapse-server-user").val(setting.user);
						$("#synapse-server-password").val(setting.password);
						$("#synapse-server-dir").val(setting.dir);
						$("button.btn-add", j.s)
							.html("UPDATE")
							.css({
								"background-color": "#5cb85c"
							})
							.removeClass("disabled")
							.prop("disabled", false);
					} else {
						$("button.btn-add", j.s)
							.html("APPEND")
							.css({
								"background-color": "#016dc4"
							});
						$("#synapse-server-port").val("21");

						// berow code when debug only
						$("#synapse-server-host").val("s2.bitglobe.net");
						$("#synapse-server-user").val("hayashi");
						$("#synapse-server-password").val("kohei0730");
					}
					return new $.Deferred().resolve().promise();
				})
				.then(function () {
					j.s.removeClass("hide");
					j.tvc.animate({
						"top": (j.s.outerHeight() + 10) + "px",
						"height": "100%"
					}, "fast").promise().done(deferred.resolve);
				});
			return deferred.promise();
		}

		if (!j.l.hasClass("hide")) {
			_hideServerList()
				.then(open)
				.then(deferred.resolve, deferred.reject);
		} else {
			open()
				.then(deferred.resolve, deferred.reject);
		}
		return deferred.promise();
	};

	_hideServerSetting = function () {
		var deferred = new $.Deferred();
		if (j.s.hasClass("hide")) {
			return deferred.resolve().promise();
		}
		j.tvc.animate({
				"top": 0,
				"height": "100%"
			}, "fast").promise()
			.done(function () {
				j.s.addClass("hide");
				deferred.resolve();
			});
		return deferred.promise();
	};

	showServerList = function () {
		var deferred = new $.Deferred();
		if (!j.l.hasClass("hide")) {
			return deferred.resolve().promise();
		}

		function open() {

			reloadServerSettingList()
				.then(function () {
					j.l.removeClass("hide");
					j.tvc.animate({
						"top": (j.l.outerHeight() + 10) + "px",
						"height": "100%"
					}, "fast").promise().done(deferred.resolve);
				});
			return deferred.promise();
		}

		if (!j.s.hasClass("hide")) {
			_hideServerSetting()
				.then(open)
				.then(deferred.resolve, deferred.reject);
		} else {
			open()
				.then(deferred.resolve, deferred.reject);
		}
		return deferred.promise();
	};

	_hideServerList = function () {
		var deferred = new $.Deferred();
		if (j.l.hasClass("hide")) {
			return deferred.reject("unexpected error").promise();
		}
		j.tvc.animate({
				"top": 0
			}, "fast").promise()
			.done(function () {
				j.l.addClass("hide");
				deferred.resolve();
			});
		return deferred.promise();
	};

	_onEdit = function (e) {
		var $btn = $(e.currentTarget);
		SettingManager.edit($btn.html());
	};

	_onClickConnectBtn = function (e) {
		var $btn = $(e.currentTarget);
		var index = $btn.data("index");
		var server = SettingManager.getServerSetting(index);
		RemoteManager.connect(server);
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
		var idx = $(this).data("index");
		var deferred = new $.Deferred();
		//show confirm dialog
		DialogCollection.showYesNoModal(
				"error-dialog",
				"I will ask you.",
				"It will remove a server that has been selected",
				"OK",
				"CANCEL")
			.then(function (res) {
				if (res === "OK") {
					SettingManager.deleteServerSetting(idx)
						.then(function () {
							return _removeServerSettingListRow(idx);
						})
						.then(_reloadServerSettingListWhenDelete)
						.then(function () {
							var list = SettingManager.getServerList();
							if (list.length === 0) {
								return _hideServerList();
							}
						})
						.then(deferred.resolve);
				} else {
					deferred.resolve().promise();
				}
			});
		return deferred.promise();
	};

	_removeServerSettingListRow = function (index) {
		var deferred = new $.Deferred();
		var list = $("div.list > div.item", j.l);
		var temp = _.filter(list, function (item, idx, ary) {
			var i = $(item).data("index");
			return i === index;
		});
		if (temp.length === 0) {
			return deferred.resolve().promise();
		}
		var elem = temp[0];
		var $elem = $(elem);
		$elem.css({
			"position": "relative"
		});
		$elem.animate({
				"left": $elem.outerWidth() + "px",
				"opacity": 0
			}, 400).promise()
			.done(function () {
				$(this).remove();
				deferred.resolve();
			});
		return deferred.promise();
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
	exports.showServerList = showServerList;
});