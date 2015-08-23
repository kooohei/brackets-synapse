/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	/* region Modules */
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var Resizer = brackets.getModule("utils/Resizer");
	var DocumentManager = brackets.getModule("document/DocumentManager");
	var CommandManager = brackets.getModule("command/CommandManager");
	var Commands = brackets.getModule("command/Commands");
	var _ = brackets.getModule("thirdparty/lodash");

	var Project = require("modules/Project");
	var DialogCollection = require("modules/DialogCollection");
	var FileTreeView = require("modules/FileTreeView");
	var SettingManager = require("modules/SettingManager");
	var RemoteManager = require("modules/RemoteManager");
	var Strings = require("strings");
	/* endregion */

	/* region Private vars */
	var
			_projectState = Project.CLOSE,
			_currentServerIndex = null,
			_projectDir = null,
			_domain = null;
	/* endregion */

	/* region Public methods */
	var
			init,
			closeProject,
			reloadServerSettingList,
			hideMain,
			hideSpinner,
			hideHeaderSpinner,
			showMain,
			showSpinner,
			connect,
			showHeaderSpinner,
			showServerList,
	/* endregion */

	/* region Private methods */
			_initServerSettingUI,
			_initMainUI,
			_initServerListUI,
			_reloadServerSettingListWhenDelete,
			_hideServerSetting,
			_hideServerList,
			_showServerSetting,
			_enableToolbarIcon,
			_disableToolbarIcon,
			_flipAnimation,
			_fadeOutMain,
			_closeProject,
			_toggleConnectBtn,
			_removeServerSettingListRow,
	/* endregion */

	/* region Event handler */
			onClickConnectBtn,
			onClickDeleteBtn,
			onLeaveListBtns,
			onEdit,
			onEnterListBtns,
			onClickEditBtn,
			onProjectStateChanged;
	/* endregion */

	/* region UI Parts */
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
				},
				get t() {
					return $("#synapse-tree");
				},
				get tb() {
					return $("#synapse-tree-back");
				}
			},
	main_html = require("../text!ui/main.html"),
	server_setting_html = require("../text!ui/serverSetting.html"),
	server_list_html = require("../text!ui/serverList.html"),
	$sidebar = $("#sidebar");

	ExtensionUtils.loadStyleSheet(module, "../ui/css/style.css");
	ExtensionUtils.loadStyleSheet(module, "../ui/css/treeview.css");
	//ExtensionUtils.loadStyleSheet(module, "../node_modules/font-awesome/css/font-awesome.min.css");
	/* endregion */


	/* Public Methods */

	/**
	 * Inittialize Panel UI and register listener.
	 *
	 * @param   {DomainManager} domain
	 * @returns {$.Promise}
	 */
	init = function (domain) {
		_domain = domain;
		_projectState = Project.CLOSE;
		var deferred = new $.Deferred();
		_initMainUI()
			.then(_initServerSettingUI)
			.then(_initServerListUI)
			.then(function () {
				Project.on(Project.PROJECT_STATE_CHANGED, onProjectStateChanged);
				//for Devel
				//showMain();
				//brackets.app.showDeveloperTools();
				return new $.Deferred().resolve().promise();
			});
		return deferred.resolve(domain).promise();
	};

	/**
	 * Show Main Panel to side view.
	 */
	showMain = function () {
		if ($("#synapse-icon").hasClass("enabled")) {
			return;
		}

		var $main = j.m;
		var $ph_pcChild = $("#project-files-header, #project-files-container > *");
		var $ph_pc = $("#project-files-header, #project-files-container");

		$ph_pcChild.animate({
			"opacity": 0
		}, "fast").promise()
		.done(function () {
			$ph_pc.css({
				"display": "none"
			});
			$main.removeClass("hide");
			$main.css({
				"opacity": 0
			});
			$main.animate({
				"opacity": 1
			}, "fast").promise()
			.done(_enableToolbarIcon);
		});
	};

	/**
	 * Show progress spinner on the tree view when connected to server.
	 */
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

	/**
	 * Hide progress spinner on the tree view when disconnected from server.
	 */
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

	/**
	 * Show progress spinner on the header when connected to server.
	 */
	showHeaderSpinner = function () {
		$("#synapse-header .spinner").addClass("spin").removeClass("hide");
	};

	/**
	 * Hide Progress spinner on header when the disconnected from server.
	 */
	hideHeaderSpinner = function () {
		$("#synapse-header .spinner").addClass("hide").removeClass("spin");
	};

	/**
	 * Show server list on top of the main panel.
	 *
	 * @returns {$.Promise}
	 */
	showServerList = function () {
		var deferred = new $.Deferred();
		if (!j.l.hasClass("hide")) {
			return deferred.resolve().promise();
		}
		function open(state) {
			if (state === Project.CLOSE) {
				reloadServerSettingList()
					.then(function () {
						var destHeight = j.m.outerHeight() - j.h.outerHeight() - (j.l.outerHeight() + 10);
						j.l.removeClass("hide");
						j.tvc.css({"border-top": "1px solid rgba(255, 255, 255, 0.05)"});
						j.tvc.animate({
							"top": j.h.outerHeight() + (j.l.outerHeight() + 10) +  "px",
							//"height": destHeight + "px"
						}, "fast").promise().done(deferred.resolve);
					});
			}
			return deferred.promise();
		}

		if (!j.s.hasClass("hide")) {

			_hideServerSetting()
				.then(function () {
					return open(_projectState);
				})
				.then(deferred.resolve, deferred.reject);
		} else {
			open(_projectState)
				.then(deferred.resolve, deferred.reject);
		}
		return deferred.promise();
	};

	/**
	 * Close main panel
	 */
	hideMain = function () {
		if (_projectState === Project.OPEN) {
			closeProject()
				.then(function () {
					_fadeOutMain();
					return;
				});
		} else {
			_fadeOutMain();
		}
	};

	/**
	 * check unsaved files and project closed then fadeout panel.
	 *
	 * @returns {$.Promise}
	 */
	closeProject = function () {
		var tvcHeight = j.tvc.outerHeight() + "px";
		var deferred = new $.Deferred();
		CommandManager.execute(Commands.FILE_CLOSE_ALL)
		.fail(function () {
			console.log("closeProject > FILE_CLOSE_ALL > rejected");
			deferred.reject();
		})
		.done(function () {
			Project.closeProject()
			.then(function() {
				$("#synapse-tree").css({"height": tvcHeight});
				$("#synapse-tree-back").css({"height": tvcHeight});
				j.t.css({"border": "1px solid rgba(255, 255, 255, 0.15)"});
				j.tvc.toggleClass("flip").on("webkitTransitionEnd", function () {
					j.tvc.off("webkitTransitionEnd");
					j.t.css({"border": 0});
					Project.close()
					.then(function () {
						j.tb.css({"border": "1px solid rgba(255, 255, 255, 0.15)"});
						j.tvc.toggleClass("flip").on("webkitTransitionEnd", function () {
							j.tb.css({"border": 0});
							$("#synapse-tree").css("height", "");
							$("#synapse-tree-back").css("height", "");
							deferred.resolve();
						});
					});
				});
			});
		});
		return deferred.promise();
	};

	/**
	 * Reload server setting list in the server list panel from preference file.
	 *
	 * @returns {$.Promise}
	 */
	reloadServerSettingList = function () {

		if (j.l.length) {
			$("button.btn-connect", j.l).off("click", onClickConnectBtn);
			$("button.btn-edit", j.l).off("click", onClickEditBtn);
			$("button.btn-delete", j.l).off("click", onClickDeleteBtn);
			$(".close-btn", j.l).off("click", _hideServerList);
			$("div.item", j.l).off({
				"mouseenter": onEnterListBtns,
				"mouseleave": onLeaveListBtns
			});
			j.l.remove();
		}
		var list = SettingManager.getServerList();
		var html = Mustache.render(server_list_html, {
			serverList: list,
			Strings: Strings
		});
		var $html = $(html);
		j.s.after($html);

		$("button.btn-connect", j.l).on("click", onClickConnectBtn);
		$("button.btn-edit", j.l).on("click", onClickEditBtn);
		$("button.btn-delete", j.l).on("click", onClickDeleteBtn);
		$(".close-btn", j.l).on("click", _hideServerList);
		$("div.item", j.l).on({
			"mouseenter": onEnterListBtns,
			"mouseleave": onLeaveListBtns
		});
		$("#synapse-server-list div.list").addClass("quiet-scrollbars");

		return new $.Deferred().resolve().promise();
	};

	/* Private Methods */

	/**
	 * the panel will fadeout when close main panel then the project files container will shown.
	 */
	_fadeOutMain = function () {
		var $main = j.m;
		var $ph_pcChild = $("#project-files-header, #project-files-container > *");
		var $ph_pc = $("#project-files-header, #project-files-container");

		$main.animate({
			"opacity": 0,
		}, "slow").promise()
		.done(function () {
			_toggleConnectBtn();
			$(this).addClass("hide");
			$ph_pc.css({"display": "block"});
			$ph_pcChild.animate({"opacity": 1}, "slow").promise()
			.done(_disableToolbarIcon);
		});
	};

	/**
	 * Initialize main panel, and register some events.
	 *
	 * @returns {$.Promise}
	 */
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
		$("span.list-btn", $main).on("click", showServerList);
		$("span.close-btn", $main).on("click", hideMain);
		$("span.add-btn", $main).on("click", function (e) {
			_showServerSetting(e, "insert", null);
		});
		return new $.Deferred().resolve().promise();
	};

	/**
	 * Initialize server setting panel and some events of that.
	 *
	 * @returns {$.Promise}
	 */
	_initServerSettingUI = function () {
		var html = Mustache.render(server_setting_html, {Strings: Strings});
		var $serverSetting = $(html);
		j.h.after($serverSetting);

		$(".btn-add", $serverSetting).on("click", onEdit);
		$(".btn-cancel", $serverSetting).on("click", _hideServerSetting);
		$(".close-btn", $serverSetting).on("click", _hideServerSetting);
		$("input", $serverSetting).on("blur", SettingManager.validateAll);
		return new $.Deferred().resolve().promise();
	};

	/**
	 * Initialize server list panel (see reloadServerSettingList)
	 *
	 * @returns {$.Promise}
	 */
	_initServerListUI = function () {
		reloadServerSettingList();
		return new $.Deferred().resolve().promise();
	};

	/**
	 * Initialize server list panel and some events of that.
	 *
	 * @returns {$.Promise}
	 */
	_reloadServerSettingListWhenDelete = function () {

		var deferred = new $.Deferred();
		if (!j.l.length) {
			return deferred.reject().promise();
		} else {
			$("button.btn-connect", j.l).off("click", onClickConnectBtn);
			$("button.btn-edit", j.l).off("click", onClickEditBtn);
			$("button.btn-delete", j.l).off("click", onClickDeleteBtn);
			$(".close-btn", j.l).off("click", _hideServerList);
			$("div.item", j.l).off({
				"mouseenter": onEnterListBtns,
				"mouseleave": onLeaveListBtns
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
		$("button.btn-connect", j.l).on("click", onClickConnectBtn);
		$("button.btn-edit", j.l).on("click", onClickEditBtn);
		$("button.btn-delete", j.l).on("click", onClickDeleteBtn);
		$(".close-btn", j.l).on("click", _hideServerList);
		$("div.item", j.l).on({
			"mouseenter": onEnterListBtns,
			"mouseleave": onLeaveListBtns
		});
		$("#synapse-server-list div.list").addClass("quiet-scrollbars");
		deferred.resolve();
		return deferred.promise();

	};

	/**
	 * Show the server setting form panel
	 *
	 * @param   {Object} e       event object.
	 * @param   {String} state   update or insert.
	 * @param   {Object}   setting Server setting object when used state is update.
	 * @returns {$.Promise}
	 */
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
						$("#synapse-server-exclude").val(setting.exclude);
						$("button.btn-add", j.s)
							.html(Strings.SYNAPSE_SETTING_UPDATE)
							.css({
								"background-color": "#5cb85c"
							})
							.removeClass("disabled")
							.prop("disabled", false);
					} else {
						$("button.btn-add", j.s)
							.html(Strings.SYNAPSE_SETTING_APPEND)
							.css({
								"background-color": "#016dc4"
							});
						$("#synapse-server-port").val("21");
						// berow code when debug only
						$("#synapse-server-host").val("");
						$("#synapse-server-user").val("");
						$("#synapse-server-password").val("");
						
					}
					return new $.Deferred().resolve().promise();
				})
				.then(function () {
					var destHeight = j.m.outerHeight() - j.h.outerHeight() - (j.s.outerHeight() + 10);
					j.s.removeClass("hide");
					j.tvc.css({"border-top": "1px solid rgba(255, 255, 255, 0.05)"});
					j.tvc.animate({
						"top": (j.s.outerHeight() + 10) + j.h.outerHeight() + "px",
						//"height": destHeight + "px"
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

	/**
	 * Close the server setting form panel
	 *
	 * @returns {$.Promise}
	 */
	_hideServerSetting = function () {
		var deferred = new $.Deferred();
		if (j.s.hasClass("hide")) {
			return deferred.resolve().promise();
		}
		var destHeight = j.m.outerHeight() - j.h.outerHeight();
		j.tvc.animate({
				"top": j.h.outerHeight() + "px",
				//"height": destHeight + "px"
			}, "fast").promise()
			.done(function () {
				j.s.addClass("hide");
				j.tvc.css({"border-top": "none"});
				deferred.resolve();
			});
		return deferred.promise();
	};

	/**
	 * Close the server list panel
	 *
	 * @returns {$.Promise}
	 */
	_hideServerList = function () {
		var deferred = new $.Deferred();
		if (j.l.hasClass("hide")) {
			return deferred.reject("unexpected error").promise();
		}
		var destHeight = j.m.outerHeight() - j.h.outerHeight();
		j.tvc.animate({
				"top": j.h.outerHeight() + "px",
				"height": destHeight + "px"
			}, "fast").promise()
			.done(function () {
				j.l.addClass("hide");
				j.tvc.css({"border-top": "none"});
				deferred.resolve();
			});
		return deferred.promise();
	};

	/**
	 * Delete server setting object from index of list.
	 *
	 * @param   {int} index
	 * @returns {$.Promise}
	 */
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

	_enableToolbarIcon = function () {
		$("#synapse-icon").removeClass("disabled").addClass("enabled");
		$("#synapse-icon").css({"background-position": "0 -24px"});
	};

	_disableToolbarIcon = function () {
		$("#synapse-icon").removeClass("enabled").addClass("disabled");
		$("#synapse-icon").css({"background-position": "0 0"});
	};

	_toggleConnectBtn = function () {
		var $connectBtn = null;
		var $editBtn = null;
		var $deleteBtn = null;
		var $btnGrp = $(".synapse-server-list-user .btn-group button");
		_.forEach($btnGrp, function (button) {
			var $btn = $(button);
			if ($btn.hasClass("connection-btn") && $btn.data("index") === _currentServerIndex) {
				$connectBtn = $btn;
			}
			if ($btn.hasClass("btn-edit") && $btn.data("index") === _currentServerIndex) {
				$editBtn = $btn;
			}
			if ($btn.hasClass("btn-delete") && $btn.data("index") === _currentServerIndex) {
				$deleteBtn = $btn;
			}
		});


		if ($connectBtn === null) {
			return;
		}

		if (_projectState === Project.CLOSE) {
			$connectBtn.removeClass("btn-disconnect");
			$connectBtn.addClass("btn-connect");
			$connectBtn.html(Strings.SYNAPSE_LIST_CONNECT);

			$editBtn.prop("disabled", false);
			$deleteBtn.prop("disabled", false);

			_currentServerIndex = null;
		} else {
			$connectBtn.removeClass("btn-connect");
			$connectBtn.addClass("btn-disconnect");

			$editBtn.prop("disabled", true);
			$deleteBtn.prop("disabled", true);

			$connectBtn.html(Strings.SYNAPSE_LIST_DISCONNECT);
		}
	};

	/* Handlers */

	onEdit = function (e) {
		var $btn = $(e.currentTarget);
		SettingManager.edit($btn.html());
	};

	onClickConnectBtn = function (e) {

		var $btn = $(e.currentTarget);
		var index = $btn.data("index");
		var server = SettingManager.getServerSetting(index);

		if (_projectState === Project.OPEN) {
			if ($(this).data("index") === _currentServerIndex) {
				closeProject()
				.then(function () {
					_toggleConnectBtn();
				});
				return;
			}
			FileTreeView.showAlert("Project is already opened.", "Please close current project before open other project.");
			return;
		}

		RemoteManager.connect(server)
		.then(function () {
			_currentServerIndex = index;
			_toggleConnectBtn();
		});
	};

	onClickEditBtn = function (e) {
		var idx = $(this).data("index");
		var setting = SettingManager.getServerSetting(idx);
		if (setting === null) {
			console.error("could not read server setting for index: " + idx);
			return;
		}
		_showServerSetting(null, "update", setting);
	};

	onClickDeleteBtn = function (e) {

		var idx = $(this).data("index");
		var deferred = new $.Deferred();

		if (_projectState === Project.OPEN) {
			FileTreeView.showAlert("Failed.", "Could not delete setting because project is open");
			return deferred.reject().promise();
		}

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

	onEnterListBtns = function (e) {
		if (_projectState === Project.OPEN) {
			if ($(this).data("index") !== _currentServerIndex) {
				return;
			}
		}
		$(this).find(".btn-group").animate({
			"opacity": 1
		}, 200);
	};

	onLeaveListBtns = function (e) {
		$(this).find(".btn-group").animate({
			"opacity": 0
		}, 200);
	};

	onProjectStateChanged = function (evt, obj) {
		_projectState = obj.state;
		_projectDir = obj.directory;
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
