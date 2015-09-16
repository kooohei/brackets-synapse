/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50, browser: true */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	
	// Modules >
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var Resizer = brackets.getModule("utils/Resizer");
	var DocumentManager = brackets.getModule("document/DocumentManager");
	var CommandManager = brackets.getModule("command/CommandManager");
	var FileUtils = brackets.getModule("file/FileUtils");
	var Commands = brackets.getModule("command/Commands");
	var _ = brackets.getModule("thirdparty/lodash");
	
	var Utils = require("modules/Utils");
	var Project = require("modules/Project");
	var DialogCollection = require("modules/DialogCollection");
	var FileTreeView = require("modules/FileTreeView");
	var FileManager = require("modules/FileManager");
	var SettingManager = require("modules/SettingManager");
	var RemoteManager = require("modules/RemoteManager");
	var Strings = require("strings");
	var Notify = require("modules/Notify").Notify;
	var DecryptPassword = require("modules/Notify").DecryptPassword;
	var CryptoManager = require("modules/CryptoManager");
	var PreferenceManager = require("modules/PreferenceManager");
	
	// <

	// Privatevars >
	var
			_projectState = Project.CLOSE,
			_currentServerIndex = null,
			_projectDir = null,
			_domain = null,
			_currentPrivateKeyText = null;
	// <

	// Public Methods >
	var
			init,
			closeProject,
			reloadServerSettingList,
			hideMain,
			showSpinner,
			hideSpinner,
			showMain,
			getCurrentPrivateKeyText,
			connect,
			showServerList,
	// <

	// Private Methods >
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
			_readPrivateKeyFile,
			_setCurrentPrivateKeyText,
			_readPrivateKeyPath,
	// <

	// Listeners >
			onProtocolGroup,
			onAuthGroup,
			onClickConnectBtn,
			onClickDeleteBtn,
			onLeaveListBtns,
			onEdit,
			onEnterListBtns,
			onClickEditBtn,
			onProjectStateChanged,
			onPrivateKeySelected,

			resetExcludeFile,
			openFileSelect,
			resetPrivateKey;
	// <

	// UI Src >
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
	ExtensionUtils.loadStyleSheet(module, "../node_modules/font-awesome/css/font-awesome.min.css");
	// <

	
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
			//.then(_initServerListUI)
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
			.then(_enableToolbarIcon)
			.then(function () {
				return Utils.sleep(1);
			})
			.then(function () {
				if (!PreferenceManager.safeSetting()) {
					var notify = new Notify("SECURE WARNING");
					notify.show();
				}
			});
		});
	};

	/**
	 * Show progress spinner on the header when connected to server.
	 */
	showSpinner = function () {
		$("#synapse-header .spinner").addClass("spin").removeClass("hide");
	};

	/**
	 * Hide Progress spinner when the connection.
	 */
	hideSpinner = function () {
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
						}, "fast").promise().then(deferred.resolve);
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
		
		var list = [];
		if (!PreferenceManager.safeSetting()) {
			list = SettingManager.getServerList();
		} else {
			var form = new DecryptPassword();
		}
		
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

	/**
	 * PrivateMethods
	 */

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
	 * Initialize server setting panel and some events;
	 *
	 * @returns {$.Promise}
	 */
	_initServerSettingUI = function () {
		var html = Mustache.render(server_setting_html, {Strings: Strings});
		var $serverSetting = $(html);
		j.h.after($serverSetting);

		$("button#choosePrivateKey").on("click", openFileSelect);
		$("button#resetPrivateKey").on("click", resetPrivateKey);
		$("button#resetExcludeFile").on("click", resetExcludeFile);
		$(".protocol-group", $serverSetting).on("click", onProtocolGroup);
		$(".auth-group", $serverSetting).on("click", onAuthGroup);
		$(".btn-add", $serverSetting).on("click", onEdit);
		$(".btn-cancel", $serverSetting).on("click", _hideServerSetting);
		$(".close-btn", $serverSetting).on("click", _hideServerSetting);
		$("input[type='text']", $serverSetting).on("blur", SettingManager.validateAll);
		$("input[type='password']", $serverSetting).on("blur", SettingManager.validateAll);

		// reset protocol
		$("#currentProtocol").val("ftp");
		$("button.toggle-ftp").addClass("active");
		$("button.toggle-sftp").removeClass("active");
		// show ftp row
		$(".sftp-row").hide();

		return new $.Deferred().resolve().promise();
	};

	/**
	 * Initialize server list panel (see reloadServerSettingList)
	 *
	 * @returns {$.Promise}
	 */
	_initServerListUI = function () {
		return reloadServerSettingList();
	};
	/**
	 * Initialize server list panel and some events.
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
			serverList: list,
			Strings: Strings
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
		var destHeight = j.m.outerHeight() - j.h.outerHeight() - (j.l.outerHeight() + 10);
		j.tvc.animate({
			"top": j.h.outerHeight() + (j.l.outerHeight() + 10) + "px"
		}, 400).promise().then(function () {
			$("#synapse-server-list div.list").addClass("quiet-scrollbars");
			deferred.resolve();
		});

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

		function _open() {
			SettingManager.reset()
			.then(function () {
				var d = new $.Deferred();
				if (state === "update") {
					j.s.data("index", setting.index);
					if (setting.protocol === "sftp") {
						$("#currentProtocol").val("sftp");
						$("#currentAuth").val(setting.auth);
						$("button.toggle-ftp").removeClass("active");
						$("button.toggle-sftp").addClass("active");
						$(".sftp-row").show();
						
						if (setting.auth === "key") {
							
							$("#synapse-server-privateKey-name").val("Setted");
							$("#synapse-server-passphrase").val(setting.passphrase);
							$("tr.password-row").hide();
							$("tr.passphrase-row").show();
							$("button.toggle-password").removeClass("active");
							$("button.toggle-key").addClass("active");
							$("#synapse-server-privateKey-name");
							_currentPrivateKeyText = setting.privateKey;
						}
						if (setting.auth === "password") {
							$("tr.password-row").show();
							$("tr.passphrase-row").hide();
							$("#synapse-server-password").val(setting.password);
						}
					}
					if (setting.protocol === "ftp") {
						$("tr.sftp-row").hide();
						$("tr.password-row").show();
						$("button.toggle-ftp").addClass("active");
						$("button.toggle-sftp").removeClass("active");
						$("#synapse-server-password").val(setting.password);
					}
					$("#synapse-server-host").val(setting.host);
					$("#synapse-server-port").val(setting.port);
					$("#synapse-server-user").val(setting.user);
					$("#synapse-server-dir").val(setting.dir);
					$("#synapse-server-exclude").val(setting.exclude);
					$("button.btn-add", j.s)
					.html(Strings.SYNAPSE_SETTING_UPDATE)
					.css({
						"background-color": "#5cb85c"
					})
					.removeClass("disabled")
					.prop("disabled", false);
					SettingManager.validateAll();
					d.resolve();
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
					resetExcludeFile();
					d.resolve();
				}
				return d.promise();
			})
			.then(function () {
				var destHeight = j.m.outerHeight() - j.h.outerHeight() - (j.s.outerHeight() + 10);
				j.s.removeClass("hide");
				j.tvc.css({"border-top": "1px solid rgba(255, 255, 255, 0.05)"});
				j.tvc.animate({"top": (j.s.outerHeight() + 10) + j.h.outerHeight() + "px"}, "fast").promise()
				.done(function () {
					deferred.resolve();
					SettingManager.validateAll();
				});
			});
			return deferred.promise();
		}

		if (!j.l.hasClass("hide")) {
			_hideServerList()
				.then(_open)
				.then(deferred.resolve, deferred.reject);
		} else {
			_open()
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
		
		hideSpinner();
		
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
		
		hideSpinner();
		
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
	
	onProtocolGroup = function (e) {
		var $btn = $(e.target);
		if (!$btn.hasClass("toggle-ftp") && !$btn.hasClass("toggle-sftp")) {
			return;
		}
		var childs = $(".protocol-group", j.s).children();
		_.forEach(childs, function (item) {
			if ($(item).hasClass("toggle-ftp") || $(item).hasClass("toggle-sftp")) {
				$(item).removeClass("active");
			}
		});

		//SettingManager.reset();

		if ($btn.hasClass("toggle-ftp")) {
			$("#currentProtocol").val("ftp");
			$("tr.sftp-row").hide();
			$("#synapse-server-port").val("21");
			$("tr.password-row").show();
		} else if ($btn.hasClass("toggle-sftp")) {
			$("tr.password-row").hide();
			$("#synapse-server-port").val("22");
			$("#currentProtocol").val("sftp");
			$("tr.sftp-row").show();
		}
		var destHeight = j.m.outerHeight() - j.h.outerHeight() - (j.s.outerHeight() + 10);
		j.s.removeClass("hide");
		j.tvc.css({"border-top": "1px solid rgba(255, 255, 255, 0.05)"});
		j.tvc.animate({
			"top": (j.s.outerHeight() + 10) + j.h.outerHeight() + "px",
		}, 100).promise().then(function () {
			$btn.addClass("active");
			SettingManager.validateAll();
		});
	};
	
	onAuthGroup = function (e) {
		var $btn = $(e.target);
		if (!$btn.hasClass("toggle-key") && !$btn.hasClass("toggle-password")) {
			return;
		}
		
		var childs = $(".auth-group", j.s).children();
		_.forEach(childs, function (item) {
			if ($(item).hasClass("toggle-key") || $(item).hasClass("toggle-password")) {
				$(item).removeClass("active");
			}
		});
		
		
		if ($btn.hasClass("toggle-key")) {
			$("#currentAuth").val("key");
			$("tr.key-row").show();
			$("tr.passphrase-row").show();
			$("tr.password-row").hide();
			
		} else if ($btn.hasClass("toggle-password")) {
			$("#currentAuth").val("password");
			$("tr.password-row").show();
			$("tr.passphrase-row").hide();
			$("tr.key-row").hide();
		}
		$btn.addClass("active");
	};

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

	openFileSelect = function (e) {
		if ($("#synapse-server-privateKey").length) {
			$("#synapse-server-privateKey").remove();
		}
		var $input = $("<input>").attr({type: "file", id: "synapse-server-privateKey"}).css({
		"display": "none"});
		$("div.privateKeyFileSelect > div").html($input);
		$input.on("change", onPrivateKeySelected);
		$input.click();
	};

	resetPrivateKey = function (e) {
		if ($("#synapse-server-privateKey").length) {
			$("#synapse-server-privateKey").remove();
		}
		$("#synapse-server-privateKey-name").val("");
		_currentPrivateKeyText = null;
		SettingManager.validateAll();
	};
	
	resetExcludeFile = function (e) {
		$("#synapse-server-exclude").val("^\\.$, ^\\.\\.$, ^\\..+$");
	};

	onPrivateKeySelected = function (e) {
		var file = $(e.target).prop("files")[0];
		var $keyName = $("#synapse-server-privateKey-name", j.s);
		
		_readPrivateKeyFile(file)
		.then(function(res) {
			var text = res;
			//var reg = new RegExp(/PRIVATE KEY/g);
			var reg = new RegExp(/^$/g);
			if (!text.match(reg)) {
				$keyName.val("").addClass("invalid");
				_currentPrivateKeyText = null;
			} else {
				$keyName.removeClass("invalid");
				$keyName.val(file.name);
				_currentPrivateKeyText = res;
			}
		}, function () {
			if ($("#synapse-server-privateKey").length) {
				$("#synapse-server-privateKey").remove();
			}
			$keyName.val("").addClass("invalid");
			_currentPrivateKeyText = null;
			console.error("error");
		}).always(function () {
			SettingManager.validateAll();
		});
	};
	/* unuse */
	_readPrivateKeyPath = function (file) {
		var reader = new FileReader();
		var deferred = new $.Deferred();
		reader.onload = function (e) {
			deferred.resolve(e.target.result);
		};
		reader.onerror= function () {
			deferred.reject();
		};
		reader.readAsDataURL(file);
		
		return deferred.promise();
	};
	
	_readPrivateKeyFile = function (file) {
		var reader = new FileReader();
		var deferred = new $.Deferred();
		reader.onload = function (e) {
			deferred.resolve(e.target.result);
		};
		reader.onerror = function () {
			deferred.reject();
		};
		reader.readAsText(file);
		return deferred.promise();
	};

	getCurrentPrivateKeyText = function () {
		return _currentPrivateKeyText;
	};
	
	
	
		
	exports.init = init;
	exports.showMain = showMain;
	exports.showSpinner = showSpinner;
	exports.hideSpinner = hideSpinner;
	exports.getCurrentPrivateKeyText = getCurrentPrivateKeyText;
	exports.reloadServerSettingList = reloadServerSettingList;
	exports.showServerList = showServerList;
	exports.getModuleName = function () {
		return module.id;
	};
});
