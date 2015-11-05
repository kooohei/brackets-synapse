
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	// External Modules >>
	var ExtensionUtils		= brackets.getModule("utils/ExtensionUtils"),
			Resizer						= brackets.getModule("utils/Resizer"),
			MainViewManager		= brackets.getModule("view/MainViewManager"),
			DocumentManager		= brackets.getModule("document/DocumentManager"),
			WorkspaceManager	= brackets.getModule("view/WorkspaceManager"),
			ProjectManager		= brackets.getModule("project/ProjectManager"),
			CommandManager		= brackets.getModule("command/CommandManager"),
			FileSystem				= brackets.getModule("filesystem/FileSystem"),
			_									= brackets.getModule("thirdparty/lodash"),
			FileUtils					= brackets.getModule("file/FileUtils"),
			Commands					= brackets.getModule("command/Commands"),
			Async							= brackets.getModule("utils/Async"),
			Shared						= require("modules/Shared"),
			Utils							= require("modules/Utils"),
			Project						= require("modules/Project"),
			DialogCollection	= require("modules/DialogCollection"),
			FileTreeView			= require("modules/FileTreeView"),
			FileManager				= require("modules/FileManager"),
			SettingManager		= require("modules/SettingManager"),
			RemoteManager			= require("modules/RemoteManager"),
			Strings						= require("strings"),
			Notify						= require("modules/Notify"),
			Log								= require("modules/Log"),
			CryptoManager			= require("modules/CryptoManager"),
			PreferenceManager	= require("modules/PreferenceManager"),
			l									= require("modules/Utils").l;

	// <<

	// Vars Functions >>
	var
		_firstLaunch = true,
		_projectState = Project.CLOSE,
		_currentServerIndex = null,
		_projectDir = null;

	var
			init,
			hideMain,
			showSpinner,
			hideSpinner,
			showMain,
			toggleWorkingfiles,
			connect,
			showServerList,

			_initServerSettingUI,
			_initMainUI,
			_initServerListUI,
			_reloadServerSettingListWhenDelete,
			_hideServerSetting,
			_hideServerList,
			_showServerSetting,
			_enableToolbarIcon,
			_disableToolbarIcon,
			_fadeOutMain,
			_toggleConnectBtn,
			_refreshView,
			_removeServerSettingListRow,
			_reloadServerSettingList,
			_slideTreeviewRow,

			onProtocolGroup,
			onAuthGroup,
			onClickConnectBtn,
			onClickDeleteBtn,
			onLeaveListBtns,
			onEdit,
			onEnterListBtns,
			onClickEditBtn,
			onProjectStateChanged,

			_attachEvents,
			_detachMainViewManagerEvents,

			resetExcludeFile,
			openFileSelect,
			resetPrivateKey;
	// <<

	// UI >>
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
			get lh() {
				return $("div.synapse-server-list-header");
			},
			get ll() {
				return $("div.list", this.l);
			},
			get tvc() {
				return $("#synapse-treeview-container");
			},
			get t() {
				return $("#synapse-tree");
			},
			get wf() {
				return $("#working-set-list-container");
			}
		},
		main_html = require("text!../ui/main.html"),
		server_setting_html = require("text!../ui/serverSetting.html"),
		server_list_html = require("text!../ui/serverList.html"),
		$sidebar = $("#sidebar");
	// <<
	ExtensionUtils.loadStyleSheet(module, "../ui/css/style.css");
	ExtensionUtils.loadStyleSheet(module, "../ui/css/treeview.css");
	ExtensionUtils.loadStyleSheet(module, "../node/node_modules/font-awesome/css/font-awesome.min.css");

	/* PUBLIC METHODS */
	/**
	 * Initialize module.
	 *
	 * @param   {NodeDomain} domain
	 * @returns {$.Promise} never rejected.
	 */
	init = function () {
		var d = new $.Deferred();
		_projectState = Project.CLOSE;

		_initMainUI()
		.then(_initServerSettingUI)
		.then(_initServerListUI)
		.then(Log.init)
		.then(function () {
			_attachEvents();
			//for Devel
			//showMain();
			//brackets.app.showDeveloperTools();
			d.resolve();
		});
		return d.promise();
	};

	toggleWorkingfiles = function () {
		var wfToggleBtn = $("span.wf-toggle-btn");
		j.wf.animate({"height": "toggle"}, 300).promise()
		.then(function () {
			wfToggleBtn.toggleClass("rotate");
			if (wfToggleBtn.hasClass("rotate")) {
				wfToggleBtn.attr({"title": Strings.TWIPSY_EXPAND_WORKINGFILES});
			} else {
				wfToggleBtn.attr({"title": Strings.TWIPSY_COLLAPSE_WORKINGFILES});
			}
		});
	};

	/**
	 * Show Main Panel to side view.
	 */
	showMain = function () {
		if ($("#synapse-icon").hasClass("enabled")) {
			return;
		}
		var d = new $.Deferred();
		/**
		 * if setting is encrypted then show dialog for the entered password
		 *
		 * @return {$.Promise} a promise never rejected.
		 */
		(function () {
			var d = new $.Deferred();
			if (PreferenceManager.safeSetting()) {
				Notify.showDecryptPassword()
				.then(d.resolve);
			} else {
				d.resolve();
			}
			return d.promise();
		}())
		.then(function () {
			/**
			 * if setting is not encrypted then show dialog for the notify security alert.
			 *
			 * @return {$.Promise} a promise never rejected.
			 */
			var d = new $.Deferred();
			if (!PreferenceManager.safeSetting()) {
				var list = PreferenceManager.loadServerSettings();
				if (list.length > 0) {
					return Notify.showSecureWarning();
				} else {
					d.resolve();
				}
			} else {
				d.resolve();
			}
			return d.promise();
		})
		.then(function () {

			var def = new $.Deferred();
			var $ph_pcChild = $("#project-files-header, #project-files-container > *");
			var $ph_pc = $("#project-files-header, #project-files-container");

			$ph_pcChild.animate({"opacity": 0}, "fast").promise()
			.then(function () {
				$ph_pc.css({
					"display": "none"
				});
				j.m.removeClass("hide");
				j.m.css({
					"opacity": 0
				});
				j.m.animate({"opacity": 1}, "fast").promise()
				.then(_enableToolbarIcon)
				.then(function () {
					FileTreeView.updateTreeviewContainerSize();

					// add v1.2.85
					if (_firstLaunch) {
						_firstLaunch = false;
						showServerList();
					}
					
					var version = PreferenceManager.getVersion();
					$(".synapse-current-version").html("version&nbsp;" + version);


					d.resolve();
				}, function (err) {
					d.reject(err);
				});
			}, function (err) {
				d.reject(err);
			});
		});
		return d.promise();
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
		if (j.l.is(":visible")) {
			return deferred.resolve().promise();
		}
		function open(state) {
			var deferred = new $.Deferred();
			_reloadServerSettingList()
			.then(function () {
				j.l.removeClass("hide");
				_refreshView(true)
				.then(function () {
					j.tvc.css({
						"border-top": "1px solid rgba(255, 255, 255, 0.05)"
					});
					deferred.resolve();
				});
			});
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
			.then(function () {
				deferred.resolve();
			}, deferred.reject);
		}
		return deferred.promise();
	};
	/**
	 * Close main panel
	 */
	hideMain = function () {

		if (_projectState === Project.OPEN) {
			_slideTreeviewRow(false)
			.then(Project.openFallbackProject)
			.then(function () {
				var promises = [];
				promises.push(Project.close());
				promises.push(_hideServerList());
				promises.push(_hideServerSetting());
				return Async.waitForAll(promises, false, 3000);
			}, function () {
				// cancel unsaved document.
				return _slideTreeviewRow(true);
			})
			.then(function () {
				_toggleConnectBtn();
				_fadeOutMain()
				.then(function () {
					if (j.w.css("display") === "none") {
						toggleWorkingfiles();
					}
				});
			});
		} else {
			_fadeOutMain()
			.then(function () {
				if (j.w.css("display") === "none") {
					toggleWorkingfiles();
				}
			});
		}
	};


	/* PRIVATE METHODS */
	_refreshView = function (isAnim) {

		if (j.l.is(":visible")) {
			var targetHeight = j.m.outerHeight() - j.h.outerHeight() - j.lh.outerHeight(),
					scrollHeight = j.ll[0].scrollHeight;
			isAnim = isAnim || false;

			if (targetHeight > 350) {
				j.ll.css({"height": ""});
			} else {
				j.ll.css({"height": (targetHeight - 40) + "px"});
			}
			return FileTreeView.updateTreeviewContainerSize(isAnim);
		}
	};
	/**
	 * Reload server setting list in the server list panel from preference file.
	 *
	 * @returns {$.Promise}
	 */
	_reloadServerSettingList = function (isAfterDelete) {
		isAfterDelete = isAfterDelete || false;
		var d = new $.Deferred();

		if (_projectState === Project.OPEN) {
			return d.resolve().promise();
		}
		if (isAfterDelete && !j.l.length) {
			return d.reject().promise();
		}

		if (j.l.length) {
			$("button.btn-connect", j.l).off("click", onClickConnectBtn);
			$("button.btn-edit", j.l).off("click", onClickEditBtn);
			$("button.btn-delete", j.l).off("click", onClickDeleteBtn);
			$(".close-btn", j.l).off("click", _hideServerList);
			$("div.item .synapse-server-list-info", j.l).off({
				"mouseenter": onEnterListBtns,
				"mouseleave": onLeaveListBtns
			});
			j.l.remove();
		}

		var list = SettingManager.getServerSettingsCache();
		var html = Mustache.render(server_list_html, {
			serverList: list,
			Strings: Strings
		});

		var $html = $(html);
		if (isAfterDelete) {
			j.l.addClass("hide").remove();
		}
		j.s.after($html);
		if (isAfterDelete) {
			j.l.removeClass("hide");
		}

		$("button.btn-connect", j.l).on("click", onClickConnectBtn);
		$("button.btn-edit", j.l).on("click", onClickEditBtn);
		$("button.btn-delete", j.l).on("click", onClickDeleteBtn);
		$(".close-btn", j.l).on("click", _hideServerList);
		$("div.item .synapse-server-list-info", j.l).on({
			"mouseenter": onEnterListBtns,
			"mouseleave": onLeaveListBtns
		});

		if (isAfterDelete) {
			FileTreeView.updateTreeviewContainerSize(true)
			.done(d.resolve);
		} else {
			$("#synapse-server-list div.list").addClass("quiet-scrollbars");
			d.resolve();
		}

		return new d.promise();
	};



	/**
	 * the panel will fadeout when close main panel then the project files container will shown.
	 */
	_fadeOutMain = function () {
		var d = new $.Deferred();
		var $main = j.m;
		var $ph_pcChild = $("#project-files-header, #project-files-container > *");
		var $ph_pc = $("#project-files-header, #project-files-container");

		$main.animate({
			"opacity": 0,
		}, "slow").promise()
		.done(function () {
			_toggleConnectBtn();
			$(this).addClass("hide");
			$ph_pc.css({
				"display": "block"
			});
			$ph_pcChild.animate({
				"opacity": 1
			}, "slow").promise()
			.done(function () {
				_disableToolbarIcon();
				d.resolve();
			});
		});
		return d.promise();
	};
	/**
	 * Initialize Synapse main UI.
	 *
	 * @returns {$.Promise} a promise never rejected.
	 */
	_initMainUI = function () {
		var source = Mustache.render(main_html, {
			Strings: Strings
		});
		var $main = $(source);
		var $pc = j.pc;
		if ($pc.length) {
			$pc.after($main);
		} else {
			j.sb.append($main);
		}

		if (j.wf.length) {
			$("span.wf-toggle-btn", $main).show().on("click", toggleWorkingfiles);
		}

		$("span.list-btn", $main).on("click", showServerList);
		$("span.close-btn", $main).on("click", hideMain);
		$("span.add-btn", $main).on("click", function (e) {
			if (!Project.STATE.isOpen()) {
				_showServerSetting(e, "insert", null);
			}
		});
		
		return new $.Deferred().resolve().promise();
	};
	/**
	 * Initialize server setting panel and some events;
	 *
	 * @returns {$.Promise} never rejected.
	 */
	_initServerSettingUI = function () {
		var source = Mustache.render(server_setting_html, {
			Strings: Strings
		});
		var $serverSetting = $(source);
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
		$("#synapse-server-port").val("21");
		// show row for ftp
		$(".sftp-row").hide();

		return new $.Deferred().resolve().promise();
	};

	_initServerListUI = function () {
		return _reloadServerSettingList();
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
					j.s.data("state", "update");
					if (setting.protocol === "sftp") {
						$("#currentProtocol").val("sftp");
						$("#currentAuth").val(setting.auth);
						$("button.toggle-ftp").removeClass("active");
						$("button.toggle-sftp").addClass("active");
						$(".sftp-row").show();

						if (setting.auth === "key") {
							$("#synapse-server-privateKey-path").val(setting.privateKeyPath);
							$("#synapse-server-passphrase").val(setting.passphrase);
							$("tr.password-row").hide();
							$("tr.passphrase-row").show();
							$("tr.key-row").show();
							$("button.toggle-password").removeClass("active");
							$("button.toggle-key").addClass("active");
							$("#synapse-server-privateKey-path");
						}
						if (setting.auth === "password") {
							$("tr.password-row").show();
							$("tr.passphrase-row").hide();
							$("tr.key-row").hide();
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
					$("#synapse-server-setting-name").val(setting.name);
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
					j.s.data("state", "insert");

					var port = "21";
					if ($(".btn-group.protocol-group button.active").html() === "SFTP") {
						port = "22";
					}
					$("#synapse-server-port").val(port);

					$("button.btn-add", j.s)
						.html(Strings.SYNAPSE_SETTING_APPEND)
						.css({
							"background-color": "#016dc4"
						});
					resetExcludeFile();
					d.resolve();
				}
				return d.promise();
			})
			.then(function () {
				j.s.removeClass("hide");
				j.tvc.css({
					"border-top": "1px solid rgba(255, 255, 255, 0.05)"
				});
				j.tvc.animate({
						"top": (j.s.outerHeight() + 10) + j.h.outerHeight() + "px",
						"bottom": 0
					}, "fast").promise()
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

		j.tvc.animate({
				"top": j.h.outerHeight() + "px",
				"bottom": 0
			}, "fast").promise()
			.done(function () {
				j.s.addClass("hide");
				j.tvc.css({
					"border-top": "none"
				});
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
		j.tvc.animate({
				"top": j.h.outerHeight() + "px",
				"bottom": 0
			}, "fast").promise()
			.done(function () {
				j.l.addClass("hide");
				j.tvc.css({
					"border-top": "none"
				});
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
		var deferred = new $.Deferred(),
				list = $("div.list > div.item", j.l),
				temp = null;

		_.forEach(list, function (item, idx, ary) {
			if (index === $(item).data("index")) {
				temp = item;
				return false;
			}
		});
		var $elem = $(temp);
		$elem.css({"position": "relative"})
		.animate({
				"left": $elem.outerWidth() + "px",
				"opacity": 0
			}, 400).promise()
			.done(function () {
				$elem.remove();
				deferred.resolve();
			});
		return deferred.promise();
	};

	_enableToolbarIcon = function () {
		$("#synapse-icon").removeClass("disabled").addClass("enabled");
		$("#synapse-icon").css({
			"background-position": "0 -24px"
		});
	};

	_disableToolbarIcon = function () {
		$("#synapse-icon").removeClass("enabled").addClass("disabled");
		$("#synapse-icon").css({
			"background-position": "0 0"
		});
	};

	_toggleConnectBtn = function () {
		var $currentBtn = {},
				$currentGrp = null,
				$btnGrp = $(".synapse-server-list-info .btn-group button"),
				$btnGrps = $(".synapse-server-list-info .btn-group");

		_.forEach($btnGrps, function (grp) {
			var $grp = $(grp);
			if ($grp.data("index") === _currentServerIndex) {
				$currentBtn.connect = $(".connection-btn", $grp);
				$currentBtn.edit = $(".btn-edit", $grp);
				$currentBtn.delete = $(".btn-delete", $grp);
				$currentGrp = $grp;
			}
		});

		if ($currentBtn.connect === null || typeof ($currentBtn.connect) === "undefined") {
			return;
		}

		if (_projectState === Project.CLOSE) {
			$currentBtn.connect.removeClass("btn-disconnect");
			$currentBtn.connect.addClass("btn-connect");
			$currentBtn.connect.html(Strings.SYNAPSE_LIST_CONNECT);
			$currentBtn.edit.prop("disabled", false);
			$currentBtn.delete.prop("disabled", false);
			$currentGrp.animate({"opacity": 0}, 500);
			_currentServerIndex = null;
		} else {
			$currentBtn.connect.removeClass("btn-connect");
			$currentBtn.connect.addClass("btn-disconnect");
			$currentBtn.edit.prop("disabled", true);
			$currentBtn.delete.prop("disabled", true);
			$currentBtn.connect.html(Strings.SYNAPSE_LIST_DISCONNECT);
			$currentGrp.animate({"opacity": 1}, 200);
		}
	};

	_slideTreeviewRow = function (reverse) {
		var	list 			= $("#synapse-tree li"),
				d 				= new $.Deferred(),
				offset 		= (reverse ? 0 : j.m.outerWidth()) + "px",
				promises	= [];
		_.forEach(list, function (li) {
			var $li = $(li);
			if (typeof $li !== "undefined") {
				var p = $li.animate({"margin-left": offset}, 450).promise();
				promises.push(p);
			}
		});
		Async.waitForAll(promises, false, 2000)
		.then(function () {
			d.resolve();
		}, d.reject);
		return d.promise();
	};



	/* LISTENERS */
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
		j.s.removeClass("hide");
		j.tvc.css({
			"border-top": "1px solid rgba(255, 255, 255, 0.05)"
		});
		j.tvc.animate({
			"top": (j.s.outerHeight() + 10) + j.h.outerHeight() + "px",
			"bottom": 0
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
		j.s.removeClass("hide");
		j.tvc.css({
			"border-top": "1px solid rgba(255, 255, 255, 0.05)"
		});
		j.tvc.animate({
			"top": (j.s.outerHeight() + 10) + j.h.outerHeight() + "px",
			"bottom": 0
		}, 100).promise().then(function () {
			$btn.addClass("active");
			SettingManager.validateAll();
		});
	};

	onEdit = function (e) {
		var state = j.s.data("state");
		SettingManager.edit(state);
	};

	onClickConnectBtn = function (e) {

		var $btn = $(e.currentTarget),
				index = $btn.data("index"),
				server = SettingManager.getServerSetting(index);

		if (_projectState === Project.OPEN) {
			if ($btn.data("index") === _currentServerIndex) {
				_slideTreeviewRow(false)
				.then(Project.openFallbackProject)
				.then(Project.close, function () {
					// cancel unsaved document.
					return _slideTreeviewRow(true);
				})
				.then(function () {
					_toggleConnectBtn();
					Log.q("Project closed");
				});
			}
		} else {
			RemoteManager.connect(server)
			.then(function () {
				_currentServerIndex = index;
				window.setTimeout(function () {
					_toggleConnectBtn();
				}, 1500);
				_toggleConnectBtn();
			}, function (err) {
				console.log(err);
			});
		}
	};

	onClickEditBtn = function (e) {
		var idx = $(this).data("index");
		var setting = SettingManager.getServerSetting(idx);
		if (setting === null) {
			console.error("Faild to retrieve to the setting via the index: " + idx);
			return;
		}
		_showServerSetting(null, "update", setting);
	};

	onClickDeleteBtn = function (e) {

		var idx = $(this).data("index");
		var deferred = new $.Deferred();

		if (_projectState === Project.OPEN) {
			Log.q("Failed to the server setting deleted", true);
			return deferred.reject().promise();
		}

		//show confirm dialog
		DialogCollection.showYesNoModal(
				"error-dialog",
				"- Synapse - NOTE",
				"It will remove a server setting that has been selected",
				"OK",
				"CANCEL")
			.then(function (res) {
				if (res === "OK") {
					SettingManager.deleteServerSetting(idx)
					.then(function () {
						return _removeServerSettingListRow(idx);
					})
					.then(function () {
						return _reloadServerSettingList(true);
					})
					.then(function () {
						var list = SettingManager.getServerSettingsCache();
						if (list.length === 0) {
							return _hideServerList();
						} else {
							return new $.Deferred().resolve().promise();
						}
					})
					.then(deferred.resolve, deferred.reject);

				} else {
					deferred.resolve();
				}
			});
		return deferred.promise();
	};

	onEnterListBtns = function (e) {
		if (_projectState === Project.OPEN) return;

		$(this).find(".btn-group").animate({
			"opacity": 1
		}, 200);
	};

	onLeaveListBtns = function (e) {

		if (_projectState === Project.OPEN) return;

		$(this).find(".btn-group").animate({
			"opacity": 0
		}, 200);
	};

	onProjectStateChanged = function (evt, obj) {
		_projectState = obj.state;
		_projectDir = obj.directory;
	};

	openFileSelect = function (e) {
		var d = new $.Deferred();

		FileSystem.showOpenDialog(false, false, "Select to key file", "", null, function (err, paths) {
			if (!err) {
				if (paths.length > 0) {
					$("#synapse-server-privateKey-path").val(paths[0]);
					SettingManager.validateAll();
					d.resolve();
				} else {
					// user just canceled
					d.reject("cancel");
				}
			} else {
				Log.q("Unexpected error", true, err);
				console.log(err);
				throw err;
			}
		});
		return d.promise();
	};

	resetPrivateKey = function (e) {
		$("#synapse-server-privateKey-path").val("");
		SettingManager.validateAll();
	};

	resetExcludeFile = function (e) {
		$("#synapse-server-exclude").val("^\\.$, ^\\.\\.$, ^\\..+$");
	};

	_attachEvents = function () {
		Project.on(Project.PROJECT_STATE_CHANGED, onProjectStateChanged);
		WorkspaceManager.on("workspaceUpdateLayout", function (e, height, hint) {
			_refreshView();
		});
		MainViewManager.on("workingSetAdd workingSetAddList workingSetRemove workingSetRemoveList workingSetUpdate paneCreate PaneDestroy", function (e) {
			_refreshView();
			
			var wfToggleBtn = $("span.wf-toggle-btn");
			if (j.wf.css("display") === "none") {
				wfToggleBtn.addClass("rotate");
				wfToggleBtn.attr({"title": Strings.TWIPSY_EXPAND_WORKINGFILES});
			} else {
				wfToggleBtn.removeClass("rotate");
				wfToggleBtn.attr({"title": Strings.TWIPSY_COLLAPSE_WORKINGFILES});
			}
			
			if (e.hasOwnProperty("type")) {
				if (e.type === "workingSetAdd" && j.wf.css("display") === "none") {
					wfToggleBtn.addClass("rotate");
					wfToggleBtn.attr({"title": Strings.TWIPSY_EXPAND_WORKINGFILES});
				}
			}
		});
	};

	exports.init = init;
	exports.showMain = showMain;
	exports.showSpinner = showSpinner;
	exports.hideSpinner = hideSpinner;
	exports.showServerList = showServerList;
	exports.getModuleName = function () {
		return module.id;
	};
});
