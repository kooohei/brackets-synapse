/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, white: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	// HEADER >>
	var FileUtils = brackets.getModule("file/FileUtils");
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var DocumentManager = brackets.getModule("document/DocumentManager");
	var Async = brackets.getModule("utils/Async");
	var EditorManager = brackets.getModule("editor/EditorManager");
	var FileSystem = brackets.getModule("filesystem/FileSystem");
	var MainViewManager = brackets.getModule("view/MainViewManager");
	var _ = brackets.getModule("thirdparty/lodash");

	var DialogCollection = require("modules/DialogCollection");
	var PathManager = require("modules/PathManager");
	var RemoteManager = require("modules/RemoteManager");
	var Menu = require("modules/Menu");
	var Project = require("modules/Project");
	var FileManager = require("modules/FileManager");
	var Strings = require("strings");

	var _modulePath = FileUtils.getParentPath(ExtensionUtils.getModulePath(module)),
			_domain,
			_remoteRootPath = null,
			_renameValidate,
			_currentServerSetting = null,
			_ctxMenuCurrentEntity = null;

	var rootEntity,
			offset_left = 13; // font-size
	var PROJECT_DIR = "PROJ";

	var _checkPrimitive,
			_getProjectDirectoryPath,
			_setEntity,
			_rename,
			_setElement,
			_projectDir,
			_makeRowElement,
			_makeBaseDirectoryIfIsNotExists,
			_openFile,
			_getEntityWithElement,
			_loadDirectory,
			_deleteEntity,
			_resetElement,
			_rebuildChildrenIndex,
			_attachEvent,
			_detachEvent,
			_getEntityWithId,
			_getPathArray,
			_getElementWithEntity,
			_toggleDir,
			_newFile,

			refresh,
			rename,
			deleteFile,
			removeFile,
			newFile,
			removeDirectory,
			newDirectory,
			init,
			setEntities,
			getEntityWithPath,
			clearCurrentTree,
			open,
			loadTreeView,
			showAlert,
			updateTreeviewContainerSize,
			onClick,
			onDirClicked,
			onFileClicked,
			onTreeViewContextMenu,
			onProjectStateChanged;

	var j = {
				get container() {
					return $("#synapse-tree");
				},
				get root_ul() {
					return $("#synapse-tree > ul");
				},
				get m() {
					return $("#synapse");
				},
				get h() {
					return $("#synapse-header");
				},
				get tvc() {
					return $("#synapse-treeview-container");
				},
				get l() {
					return $("#synapse-server-list");
				},
				get s() {
					return $("#synapse-server-setting");
				}
			};
	var Icon = {
				file: "fa fa-file-o",
				link: "fa fa-link",
				folder: "fa fa-folder",
				folder_open: "fa fa-folder-open",
				folder_disable: "fa fa-folder-o"
			};
	var Entity = function (param) {
				if (param.class === undefined ||
					param.text === undefined ||
					param.parent === undefined) {
					throw new Error("Invalid parameters.");
				}
				this.class = param.class;
				this.type = param.type;
				this.text = param.text;
				this.mode = param.mode || null;
				this.size = param.size || 0;
				this.date = param.date;
				this.parent = param.parent;
				this.opt = param.opt || {};
				this.depth = param.depth;
				this.index = param.index;
				this.id = param.id;
				this.downloaded = false;
				this.children = {};
			};

	//<<



	init = function (domain) {
		var deferred = new $.Deferred();
		_domain = domain;
		_attachEvent();
		Menu.initTreeViewContextMenu();
		Project.on(Project.PROJECT_STATE_CHANGED, onProjectStateChanged);
		return deferred.resolve(domain).promise();
	};

	loadTreeView = function (serverSetting) {
		_currentServerSetting = serverSetting;
		_remoteRootPath = _currentServerSetting.dir;
		PathManager.setRemoteRoot(_remoteRootPath);

		j.root_ul.remove();
		var param = {
			class: "treeview-root",
			type: "directory",
			text: _currentServerSetting.name,
			opt: {},
			parent: null,
			children: {},
			depth: 0,
			index: 0,
			id: "0"
		};
		_setEntity(param)
			.then(function (entity) {
				rootEntity = entity;
				_setElement(null);
			});
		return rootEntity;
	};

	clearCurrentTree = function () {
		var deferred = new $.Deferred();
		_currentServerSetting = null;
		_remoteRootPath = null;
		j.root_ul.remove();
		return deferred.resolve().promise();
	};

	setEntities = function (list, parent) {
		if (parent.type !== "directory") {
			throw new Error("the type property of the parent object must set directory");
		}
		var deferred = new $.Deferred();
		var promises = [];
		var params = [];

		var dirs = _.where(list, {type: "d"});
		var files = _.where(list, {type: "-"});
		var links = _.where(list, {type: "l"});

		_.pluck(_.sortBy(list, "name"), "name");

		list = [];
		list = list
						.concat(dirs)
						.concat(files)
						.concat(links);

		var depth = parent.depth + 1;
		list.forEach(function (item, index) {
			var type = "file";
			switch (item.type) {
				case "d":
					type = "directory";
					break;
				case "l":
					type = "symlink";
					break;
				default:
					type = "file";
					break;
			}
			var param = {
				class: "treeview-" + type,
				type: type,
				text: item.name,
				size: item.size,
				mode: item.rights.user === null ? "": item.rights.user,
				date: item.date,
				depth: depth,
				index: index,
				id: parent.id + "-" + index,
				parent: parent
			};
			promises.push(_setEntity(param, index));
		});

		Async.waitForAll(promises, false, 5000)
			.then(function () {
				return _setElement(parent);
			})
			.then(function () {
				var $parent = _getElementWithEntity(parent);
				$parent.addClass("loaded");
				deferred.resolve();
			})
			.fail(deferred.reject);
		return deferred.promise();
	};

	refresh = function () {
		var deferred = new $.Deferred();
		if (_ctxMenuCurrentEntity === null) {
			return;
		}
		$("#tv-" + _ctxMenuCurrentEntity.id + " > ul.treeview-contents").remove();

		_loadDirectory(_ctxMenuCurrentEntity)
			.then(deferred.resolve, function (err) {
				// TODO: ファイル一覧の更新が失敗しました。。
				deferred.reject();
			});
		return deferred.promise();
	};

	rename = function () {
		var deferred = new $.Deferred();
		if (_ctxMenuCurrentEntity === null) {
			return deferred.reject().promise();
		}

		var oldLocalPath = PathManager.completionLocalPath(_getPathArray(_ctxMenuCurrentEntity));
		var oldRemotePath = PathManager.completionRemotePath(_getPathArray(_ctxMenuCurrentEntity));

		var entry = null;
		if (_ctxMenuCurrentEntity.type === "file") {
			entry = FileSystem.getFileForPath(oldLocalPath);
		} else if (_ctxMenuCurrentEntity.type === "directory") {
			entry = FileSystem.getDirectoryForPath(oldLocalPath);
		}

		_rename(_ctxMenuCurrentEntity, function (entity) {

			var newLocalPath = PathManager.completionLocalPath(_getPathArray(entity));
			var newRemotePath = PathManager.completionRemotePath(_getPathArray(entity));

			if (entity) {
				if (newLocalPath === oldLocalPath) {
					return deferred.resolve().promise();
				} else {
					RemoteManager.rename(_currentServerSetting, oldRemotePath, newRemotePath)
					.then(function (res) {
						return Project.renameLocalEntry(oldLocalPath, newLocalPath, entity.type);
					})
					.then(function () {
						DocumentManager.notifyPathNameChanged(oldLocalPath, newLocalPath);
						deferred.resolve();
					}, function (err) {
						showAlert("Could not rename to remote file<br>" + err);
						deferred.reject(err);
					});
				}
			} else {
				deferred.reject();
			}
		});
		return deferred.promise();
	};

	removeFile = function () {
		var deferred = new $.Deferred();
		if (_ctxMenuCurrentEntity === null) {
			return deferred.reject().promise();
		}

		if (_ctxMenuCurrentEntity.type === "file") {
			deleteFile()
			.then(deferred.resolve, deferred.reject);
		} else {
			removeDirectory()
			.then(deferred.resolve, deferred.reject);
		}
		return deferred.promise();
	};

	removeDirectory = function () {
		var deferred = new $.Deferred();
		if (_ctxMenuCurrentEntity === null) {
			return deferred.reject().promise();
		}
		var remotePath = PathManager.completionRemotePath(_getPathArray(_ctxMenuCurrentEntity));

		DialogCollection.showYesNoModal(
				"removeDirectoryDialog",
				"Confirm",
				"Are you sure you want to delete the selected directory and all child contents ?")
			.done(function (res) {
				if (res === "Yes") {
					RemoteManager.removeDirectory(_currentServerSetting, remotePath)
						.then(function () {
							_deleteEntity(_ctxMenuCurrentEntity);
						}, function (err) {
							showAlert("ERROR", "Could not remove directory from server");
							deferred.reject(err);
						});
				} else {
					deferred.resolve();
				}
			});
		return deferred.promise();
	};

	newDirectory = function () {
		var deferred = new $.Deferred();
		if (_ctxMenuCurrentEntity === null) {
			return deferred.reject().promise();
		}

		if (_ctxMenuCurrentEntity.type === "directory") {
			if (!_getElementWithEntity(_ctxMenuCurrentEntity).hasClass("loaded")) {
				_loadDirectory(_ctxMenuCurrentEntity)
				.then(function () {
					newDirectory();
					return;
				}, function () {
					// TODO: ファイル一覧の取得に失敗しました。
					deferred.reject();
				});
			} else {
				_newFile("directory")
				.then(deferred.resolve, deferred.reject);
			}
		} else {
			deferred.resolve();
		}
		return deferred.promise();
	};

	newFile = function () {
		var deferred = new $.Deferred();
		if (_ctxMenuCurrentEntity === null || _ctxMenuCurrentEntity.type !== "directory") {
			// TODO: 選択されたカレントディレクトリでファイルの作成はできません。
			deferred.reject();
			return deferred.promise();
		}

		var $elem = _getElementWithEntity(_ctxMenuCurrentEntity);

		if (_ctxMenuCurrentEntity.type === "directory") {
			if (!$elem.hasClass("loaded")) {
				_loadDirectory(_ctxMenuCurrentEntity)
				.then(function () {
					newFile();
					return;
				}, function (err) {
					//　ファイル一覧の取得に失敗しました。
					deferred.reject(err);
				});
			} else {
				_newFile("file")
				.then(deferred.resolve, function (err) {
					// TODO: ファイルの作成に失敗しました。
					deferred.reject();
				});
			}
		} else {
			deferred.resolve();
		}
		return deferred.promise();
	};

	deleteFile = function () {
		var deferred = new $.Deferred();
		var remotePath = PathManager.completionRemotePath(_getPathArray(_ctxMenuCurrentEntity));
		if (_ctxMenuCurrentEntity === null) {
			return deferred.reject().promise();
		}
		DialogCollection.showYesNoModal(
				"deleteFileDialog",
				"Confirm",
				"Are you sure you want to delete the selected file ?")
			.done(function (res) {
				if (res === "Yes") {
					RemoteManager.deleteFile(_currentServerSetting, remotePath)
						.then(function () {
							_deleteEntity(_ctxMenuCurrentEntity);
							deferred.resolve();
						}, function (err) {
							// TODO: showAlert is deprecated instead Log.q
							// TODO: サーバファイルの削除に失敗しました。
							showAlert("ERROR", "Could not delete file from server");
							deferred.reject(err);
						});
				} else {
					deferred.resolve();
				}
			});
		return deferred.promise();
	};

	showAlert = function (title, message) {
		var $container = $("<div/>").addClass("synapse-treeview-alert")
			.html($("<p/>").addClass("title").html(title))
			.append($("<p/>").addClass("caption").html(message)).hide();
		var $treeviewcontainer = $("#synapse-treeview-container");
		$treeviewcontainer.append($container);
		var height = $container.outerHeight();
		var left = $treeviewcontainer.outerWidth();
		var treeHeight = $treeviewcontainer.outerHeight();
		var top = ((treeHeight - height) / 2);
		$container.css({
			"top": top + "px",
			"left": "-" + left + "px"
		}).show();

		$("#synapse-tree").animate({
				"opacity": 0.3
		}, 100).promise()
		.done(function () {
			$("#synapse-tree").addClass("disabled");
			$container.animate({
				"left": 0,
					"opacity": 1
				}, 150).promise()
				.done(function () {
					_detachEvent();
					$container.one("click", function () {
						$(this).animate({
								"left": left + "px",
								"opacity": 0
							}, 150).promise()
							.done(function () {
								$container.remove();
								return $("#synapse-tree").animate({
									"opacity": 1
								}, 100).promise();
							})
							.done(function () {
								$("#synapse-tree").removeClass("disabled");
								_attachEvent();
							});
						});
					});
			});
	};

	getEntityWithPath = function (localPath) {
		var split = localPath.split("/");
		var children = rootEntity.children;
		var entity = null;
		split.forEach(function (f) {
			_.forEach(children, function (ent) {
				if (ent.text === f) {
					entity = ent;
				}
			});
			if (entity.type !== "file" && entity.type !== "symlink") {
				children = entity.children;
			}
		});
		return entity;
	};


	/* Private Methods */
	_setElement = function (entity) {
		var deferred = new $.Deferred();
		var $parent = null;
		if (entity === null) {
			$parent = $("#synapse-tree");
		} else {
			$parent = _getElementWithEntity(entity);
		}
		if ($parent === null || $parent === undefined) {
			throw new Error("Unexpected Exception. could not found the element");
		}

		$parent.find("ul.treeview-contents").remove();
		var $ul = $("<ul/>").addClass("treeview-contents quiet-scrollbars");
		$parent.append($ul);

		if (entity === null) {
			$ul.show();
			_makeRowElement(rootEntity, $("#synapse-tree"), $ul);
			if ($parent.hasClass("treeview-close")) {
				_toggleDir(rootEntity);
			} else {
				$ul.css({"display": "block"});
			}
			deferred.resolve();
		} else {
			_.forEach(entity.children, function (ent) {
				_makeRowElement(ent, $parent, $ul);
			});
			if ($parent.hasClass("treeview-close")) {
				_toggleDir(entity);
			} else {
				$ul.css({"display": "block"});
			}
			deferred.resolve();
		}
		return deferred.promise();
	};

	_setEntity = function (param) {
		var deferred = new $.Deferred();
		var entity = new Entity(param);
		if (entity.parent !== null) {
			entity.parent.children[entity.index] = entity;
		}
		return deferred.resolve(entity).promise();
	};

	_attachEvent = function () {
		j.container.on("click", onClick);
	};

	_detachEvent = function () {
		j.container.off("click", onClick);
	};

	_checkPrimitive = function (param) {
		var toStr = Object.prototype.toString;
		var res = toStr.call(param);
		return res.replace(/\[|\]/g, "").split(" ")[1];
	};

	_getProjectDirectoryPath = function () {
		return _modulePath + PROJECT_DIR;
	};

	_getPathArray = function (entity) {
		var target = entity;
		var entities = [];
		while (target.parent !== null) {
			entities.unshift(target.text);
			target = target.parent;
		}
		return entities;
	};

	/**
	 * Return entity from corresponding jQuery object.
	 * @param   {Object} $elem
	 * @returns {[[Type]]} [[Description]]
	 */
	_getEntityWithElement = function ($elem) {
		var id = $elem.attr("id");
		return _getEntityWithId(id);
	};

	_getEntityWithId = function (id) {
		if (id === "tv-0") {
			return rootEntity;
		} else if (id === "synapse-tree") {
			return null;
		}
		var index = id.split("-");
		if (index[0] === "tv") {
			index = index.slice(1);
		}
		index = index.slice(1);
		var depth = index.length;
		var children = rootEntity.children;
		var i = 0;
		var entity = null;

		for (; i < depth; i++) {
			entity = children[index[i]];
			children = entity.children;
		}
		return entity;
	};

	_getElementWithEntity = function (entity) {
		return $("#tv-" + entity.id, j.container);
	};

	_makeRowElement = function (entity, $parent, $ul) {
		var deferred = new $.Deferred();
		var $li = $("<li/>").addClass("treeview-entity").addClass(entity.class).attr({
			"id": "tv-" + entity.id
		});

		var $p = $("<p/>").addClass("treeview-row");
		var $text = $("<span/>").addClass("filename").html(entity.text);
		var $icon = $("<i/>");

		if (entity.type === "directory") {
			$li.addClass("treeview-close");
			$icon.addClass(Icon.folder);
		} else if (entity.type === "file") {
			$icon.addClass(Icon.file);
		} else if (entity.type === "symlink") {
			$icon.addClass(Icon.link);
			$li.addClass("treeview-symlink");
		}
		$p.append($icon)
			.append($text);
		$li.append($p);
		$ul.append($li);
		var paddingLeft = offset_left * entity.depth;
		$p.css({
			"padding-left": paddingLeft + "px"
		});
		return deferred.resolve($ul).promise();
	};

	_toggleDir = function (entity) {
		var $jqElem = _getElementWithEntity(entity);
		var $icon = $("#tv-" + entity.id + " > p.treeview-row > i.fa");
		var $ul = $("#tv-" + entity.id + " > ul.treeview-contents");
		if ($ul.is(":hidden")) {
			$icon.addClass("fa-folder-open");
			$icon.removeClass("fa-folder");
			$jqElem.removeClass("treeview-close");
			$jqElem.addClass("treeview-open");
		} else if ($ul.is(":visible")) {
			$icon.removeClass("fa-folder-open");
			$icon.addClass("fa-folder");
			$jqElem.addClass("treeview-close");
			$jqElem.removeClass("treeview-open");
		}

		$ul.animate({
			"height": "toggle"
		}, "fast");
	};

	_loadDirectory = function (entity) {
		var deferred = new $.Deferred();
		var path = PathManager.completionRemotePath(_getPathArray(entity));
		RemoteManager.getList(entity, _currentServerSetting, path)
			.then(function (list) {
				return setEntities(list, entity);
			})
			.then(deferred.resolve, deferred.reject);
		return deferred.promise();
	};

	_rename = function (entity, cb) {

		var $input = null;
		var showInput = function (entity) {
			var deferred = new $.Deferred();
			var $parent = _getElementWithEntity(entity.parent);
			var $current = _getElementWithEntity(entity);
			var $span = $("p.treeview-row > span", $current).first();
			var $input = $("<input/>").attr({
				type: "text",
				"id": "synapse-treeview-rename-editor"
			}).val(entity.text);
			$("p.treeview-row", $current).first().append($input);
			$span.hide();
			return deferred.resolve().promise();
		};

		var validate = function (entity, cb) {
			var $current = _getElementWithEntity(entity);
			var _$input = $("input", $current).focus().select();
			var parent = entity.parent;
			var $parent = _getElementWithEntity(entity.parent);
			var $span = $("p.treeview-row > span", $current).first();

			_$input.focus().select();

			_$input.on("keypress.synapse", function (e) {
				if (e.which === 13) {
					_$input.off("keypress.synapse");
					_$input.blur();
				}
			});
			var exists = false;
			_$input.one("blur", {
				cb: cb
			}, function () {
				_.forEach(parent.children, function (ent, key) {
					if ((ent.id !== entity.id) && (ent.text === _$input.val())) {
						exists = true;
					}
				});

				if (exists) {
					validate(entity, cb);
				} else {
					$span.show().html(_$input.val());
					entity.text = _$input.val();
					_$input.off("keypress.synapse");
					_$input.remove();
					cb(entity);
				}
			});
		};

		showInput(entity)
		.then(function () {
			validate(entity, cb);
		});
	};

	_newFile = function (type) {
		var deferred = new $.Deferred();
		if (_ctxMenuCurrentEntity === null) {
			return deferred.reject().promise();
		}
		var parent = _ctxMenuCurrentEntity;

		var $elem = _getElementWithEntity(_ctxMenuCurrentEntity);
		var cnt = 0;
		_.forEach(parent.children, function (ent, key) {
			if (type === "file") {
				if (ent.text.match(/^New File(\([0-9]+?\))?$/)) {
					cnt++;
				}
			} else {
				if (ent.text.match(/^New Directory(\([0-9]+?\))?$/)) {
					cnt++;
				}
			}
		});
		var newName = "";
		if (type === "file") {
			newName = (cnt === 0) ? "New File" : "New File(" + cnt + ")";
		} else {
			newName = (cnt === 0) ? "New Directory" : "New Directory(" + cnt + ")";
		}

		var depth = parent.depth + 1;
		var index = Object.keys(parent.children).length;
		var newEntity = null;
		var param = {
			class: "treeview-" + type,
			type: type,
			text: newName,
			size: 0,
			mode: "",
			date: "",
			depth: depth,
			index: index,
			id: parent.id + "-" + index,
			parent: parent
		};

		_setEntity(param)
		.then(function (entity) {
			newEntity = entity;
			return _setElement(entity.parent);
		})
		.then(function () {
			if (type === "file") {
				_rename(newEntity, function (ent) {
					var localPath = _modulePath + "empty.txt";
					var remotePath = PathManager.completionRemotePath(_getPathArray(ent));

					RemoteManager.uploadFile(_currentServerSetting, localPath, remotePath)
					.then(function () {
						deferred.resolve();
					}, function (err) {
						_deleteEntity(ent);
						showAlert("ERROR", "New file could not upload to server.<br>" + err);
						deferred.reject();
					});
				});
			} else {
				_rename(newEntity, function (ent) {
					var remotePath = PathManager.completionRemotePath(_getPathArray(ent));
					RemoteManager.mkdir(_currentServerSetting, remotePath)
					.then(function () {
						//deferred.resolve();
						return Project.createDirectoryIfExists(PathManager.completionLocalPath(_getPathArray(ent)));
					}, function (err) {
						_deleteEntity(ent);
						showAlert("ERROR", "New directory could not upload to server.<br>" + err);
						deferred.reject();
					});
				});
			}
		}, function (err) {
			throw new Error(err);
		});
		return deferred.promise();
	};

	_deleteEntity = function (entity) {
		var deferred = new $.Deferred();
		var $elem = _getElementWithEntity(entity);
		var parent = entity.parent;
		delete parent.children[entity.index];

		_rebuildChildrenIndex(parent)
			.then(_resetElement)
			.then(deferred.resolve, deferred.reject);
		return deferred.promise();
	};

	_rebuildChildrenIndex = function (parent) {
		var deferred = new $.Deferred();
		var entities = parent.children;
		var tmp = {};
		var idx = 0;
		_.forEach(entities, function (ent, key) {
			ent.index = idx;
			ent.id = ent.parent.id + "-" + idx;
			tmp[idx] = ent;
			idx++;
		});
		parent.children = tmp;
		return deferred.resolve(parent).promise();
	};

	_resetElement = function (parent) {
		return _setElement(parent);
	};

	_makeBaseDirectoryIfIsNotExists = function (localPath) {
		var deferred = new $.Deferred();
		var baseDirPath = FileUtils.getDirectoryPath(localPath);
		var baseDir = FileSystem.getDirectoryForPath(baseDirPath);
		baseDir.exists(function (err, exists) {
			if (err) {
				deferred.reject(err);
			} else {
				if (!exists) {
					baseDir.create(function (err, res) {
						if (!err) {
							deferred.resolve(baseDir);
						} else {
							deferred.reject(err);
						}
					});
				} else {
					deferred.resolve(baseDir);
				}
			}
		});
		return deferred.promise();
	};

	_openFile = function (entity) {
		var deferred = new $.Deferred();
		var remotePath = PathManager.completionRemotePath(_getPathArray(entity));
		var localPath = PathManager.completionLocalPath(_getPathArray(entity));
		if (!entity.downloaded) {
			_makeBaseDirectoryIfIsNotExists(localPath)
			.then(function (baseDir) {
				RemoteManager.download(_currentServerSetting, localPath, remotePath)
				.then(function () {
					entity.downloaded = true;
					FileManager.openFile(localPath);
					deferred.resolve();
				}, function (err) {

					if (err.code === 550) {
						showAlert("ERROR", "Permission denied");
					} else {
						showAlert("ERROR", "Error Code: " + err.code);
					}
				});
			}, function(err) {
				throw new Error(err);
			});
		} else {
			FileManager.openFile(localPath);
		}
		return deferred.promise();
	};

	onTreeViewContextMenu = function (e, menu) {
		if ($("#synapse-tree").hasClass("disabled")) {
			return;
		}
		menu.close();
		var $elem = $(e.target);
		var tag = $elem.prop("tagName");
		if (tag === "DIV") {
			if ($("#treeview-root").length) {
				$elem = _getElementWithEntity(rootEntity);
			} else {
				$elem = null;
			}
		} else if (tag === "P") {
			if ($elem.hasClass("treeview-row")) {
				if ($elem.parent().hasClass("treeview-entity")) {
					$elem = $elem.parent();
				}
			}
		} else if ((tag === "SPAN" && $elem.hasClass("filename")) ||
			(tag === "I" && $elem.hasClass("fa"))) {
			if ($elem.parent().parent().hasClass("treeview-entity")) {
				$elem = $elem.parent().parent();
			}
		} else {
			return;
		}
		if ($elem === null) {
			return;
		}
		var entity = _getEntityWithId($elem.attr("id"));
		Menu.treeViewContextMenuState(entity);
		_ctxMenuCurrentEntity = _getEntityWithId($elem.attr("id"));
		menu.open(e);
	};

	onClick = function (e) {
		var $elem = $(e.target);

		if ($elem.hasClass("treeview-contents") || $elem.hasClass("filename") || $elem.hasClass("fa")) {
			$elem = $elem.parent().parent();
		} else if ($elem.hasClass("treeview-row")) {
			$elem = $elem.parent();
		}

		if ($elem.hasClass("treeview-directory") || $elem.hasClass("treeview-root")) {
			onDirClicked($elem);
		}
		if ($elem.hasClass("treeview-file")) {
			onFileClicked($elem);
		}
	};

	onFileClicked = function ($elem) {
		var entity = _getEntityWithElement($elem);
		_openFile(entity);
	};

	onDirClicked = function ($elem) {
		var id = $elem.attr("id");
		var entity = _getEntityWithId(id);

		if ($elem.hasClass("loaded")) {
			_toggleDir(entity);
		} else {
			_loadDirectory(entity)
			.then(function () {
				// success
			}, function (err) {
				throw new Error(err);
			});
		}
	};

	onProjectStateChanged = function (e, obj) {
		if (obj.state === Project.OPEN) {
			_projectDir = obj.directory;
		} else if (obj.state === Project.CLOSE) {

		}
	};

	updateTreeviewContainerSize = function () {
		var top = j.tvc.css("top");
		if (j.l.is(":visible")) {
			top = j.h.outerHeight() + j.l.outerHeight() + 10;
		}
		if (j.s.is(":visible")) {
			top = j.h.outerHeight() + j.s.outerHeight() + 10;
		}
		j.tvc.css({"top": top + "px", bottom: 0});
	};

	exports.init = init;
	exports.setEntities = setEntities;
	exports.rootEntity = rootEntity;
	exports.open = open;
	exports.loadTreeView = loadTreeView;
	exports.refresh = refresh;
	exports.rename = rename;
	exports.showAlert = showAlert;
	exports.removeFile = removeFile;
	exports.newFile = newFile;
	exports.getEntityWithPath = getEntityWithPath;
	exports.deleteFile = deleteFile;
	exports.newDirectory = newDirectory;
	exports.removeDirectory = removeDirectory;
	exports.onTreeViewContextMenu = onTreeViewContextMenu;
	exports.clearCurrentTree = clearCurrentTree;
	exports.updateTreeviewContainerSize = updateTreeviewContainerSize;
	exports.getModuleName = function () {
		return module.id;
	};
});
