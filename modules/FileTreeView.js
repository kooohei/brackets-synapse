/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	"use strict";

	/* region header */
	var FileUtils = brackets.getModule("file/FileUtils");
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var Async = brackets.getModule("utils/Async");
	var _ = brackets.getModule("thirdparty/lodash");
	var DialogCollection = require("modules/DialogCollection");
	var EditorManager = brackets.getModule("editor/EditorManager");
	var PathManager = require("modules/PathManager");
	var RemoteManager = require("modules/RemoteManager");
	var FileSystem = brackets.getModule("filesystem/FileSystem");
	var Menu = require("modules/Menu");
	var Strings = require("strings");
	var MainViewManager = brackets.getModule("view/MainViewManager");
	var Project = require("modules/Project");
	var FileManager = require("modules/FileManager");

	var _modulePath = FileUtils.getParentPath(ExtensionUtils.getModulePath(module)),
			_domain,
			_remoteRootPath = null,
			_renameValidate,
			_ctxMenuCurrentEntity = null;
	var rootEntity,
			offset_left = 13; // font-size
	var PROJECT_DIR = "PROJ";
	var _checkPrimitive,
			_getProjectDirectoryPath,
			_currentServerSetting = null,
			_setEntity,
			_rename,
			_flipContainer,
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
			_onProjectStateChanged,
			_showAlert;
	var refresh,
			rename,
			deleteFile,
			_newFile,
			newFile,
			newDirectory,
			removeDirectory,
			onTreeViewContextMenu;
	var init,
			setEntities,
			clearCurrentTree,
			open,
			loadTreeView;
	var onClick,
			onDirClicked,
			onFileClicked;
	var jq = {
				get container() {
					return $("#synapse-tree");
				},
				get root_ul() {
					return $("#synapse-tree > ul");
				}
			};
	var Icon = {
				file: "fa fa-file-o",
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
	/* endregion */
	init = function (domain) {
		var deferred = new $.Deferred();
		_domain = domain;
		_attachEvent();
		Menu.initTreeViewContextMenu();
		Project.on(Project.PROJECT_STATE_CHANGED, _onProjectStateChanged);
		deferred.resolve(domain);
		return deferred.promise();
	};
	loadTreeView = function (serverSetting) {
		_currentServerSetting = serverSetting;
		_remoteRootPath = _currentServerSetting.dir;
		PathManager.setRemoteRoot(_remoteRootPath);

		jq.root_ul.remove();
		var param = {
			class: "treeview-root",
			type: "directory",
			text: _currentServerSetting.host + "@" + _currentServerSetting.user,
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
		jq.root_ul.remove();
		return deferred.resolve().promise();
	};
	setEntities = function (list, parent) {
		if (parent.type !== "directory") {
			throw new Error("the type property of the parent object must set directory");
		}
		var deferred = new $.Deferred();
		var promises = [];
		var params = [];

		var depth = parent.depth + 1;
		list.forEach(function (item, index) {
			var type = (item.type === "d") ? "directory" : "file";
			var param = {
				class: "treeview-" + type,
				type: type,
				text: item.name,
				size: item.size,
				mode: item.rights.user,
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
	_setElement = function (entity, initState) {
		var _initState = initState || "THEN_OPEN";
		var deferred = new $.Deferred();
		var $parent = null;
		if (entity === null) {
			$parent = $("#synapse-tree");
		} else {
			$parent = _getElementWithEntity(entity);
		}
		if ($parent === null || $parent === undefined) {
			throw new Error("Unexpected Exception. could not specified element");
		}

		$parent.find("ul.treeview-contents").remove();
		var $ul = $("<ul/>").addClass("treeview-contents");
		$parent.append($ul);

		if (entity === null) {
			$ul.show();
			_makeRowElement(rootEntity, $("#synapse-tree"), $ul, _initState);
			if (_initState === "THEN_OPEN") {
				_toggleDir(rootEntity);
			}
			deferred.resolve();
		} else {
			_.forEach(entity.children, function (ent) {
				_makeRowElement(ent, $parent, $ul, _initState);
			});
			if (_initState === "THEN_OPEN") {
				_toggleDir(entity);
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
		jq.container.on("click", onClick);
	};
	_detachEvent = function () {
		jq.container.off("click", onClick);
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
		return $("#tv-" + entity.id, jq.container);
	};
	_makeRowElement = function (entity, $parent, $ul, initState) {
		var deferred = new $.Deferred();
		var $li = $("<li/>").addClass("treeview-entity").addClass(entity.class).attr({
			"id": "tv-" + entity.id
		});
		var $p = $("<p/>").addClass("treeview-row");
		var $text = $("<span/>").addClass("filename").html(entity.text);
		var $icon = $("<i/>");

		if (entity.type === "directory") {
			if (initState === "THEN_OPEN") {
				$li.addClass("treeview-close");
				$icon.addClass(Icon.folder);
			} else if (initState === "INSERT_ITEM") {
				$li.addClass("treeview-open");
				$icon.addClass(Icon.folder_open);
				$ul.css({
					"display": "block"
				});
			}

		} else {
			$icon.addClass(Icon.file);
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
		/**
		 * Directory Clicked
		 */
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
				});
		}
	};
	
	refresh = function () {
		var deferred = new $.Deferred();
		if (_ctxMenuCurrentEntity === null) {
			return;
		}
		$("#tv-" + _ctxMenuCurrentEntity.id + " > ul.treeview-contents").remove();

		_loadDirectory(_ctxMenuCurrentEntity)
			.then(deferred.resolve, deferred.reject);
		return deferred.promise();
	};
	rename = function () {
		var deferred = new $.Deferred();
		if (_ctxMenuCurrentEntity === null) {
			return deferred.reject().promise();
		}
		
		var oldName = _ctxMenuCurrentEntity.text;
		_rename(_ctxMenuCurrentEntity, function (entity) {
			if (entity) {
				if (entity.text === oldName) {
					return;
				} else {
					RemoteManager.rename(_currentServerSetting, oldName, entity.text)
						.then(function (res) {
							deferred.resolve();
						}, function (err) {
							_showAlert("Could not rename to remote file");
							deferred.reject(err);
						});
				}
			}
			return deferred.promise();
		});
	};
	newFile = function () {
		var deferred = new $.Deferred();
		if (_ctxMenuCurrentEntity === null) {
			deferred.reject();
			return;
		}
		if (_ctxMenuCurrentEntity.type === "directory") {
			if (!_getElementWithEntity(_ctxMenuCurrentEntity).hasClass("loaded")) {
				_loadDirectory(_ctxMenuCurrentEntity)
					.then(function () {
						newFile();
						return;
					});
			}
		}
		_newFile("file")
			.then(deferred.resolve, deferred.reject);
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
					});
			}
		}
		_newFile("directory")
			.then(deferred.resolve, deferred.reject);
		return deferred.promise();
	};
	_newFile = function (type) {
		var deferred = new $.Deferred();
		if (_ctxMenuCurrentEntity === null) {
			return deferred.reject().promise();
		}
		var parent = _ctxMenuCurrentEntity;
		var $elem = _getElementWithEntity(parent);
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
				return _setElement(entity.parent, "INSERT_ITEM");
			})
			.then(function () {
				if (type === "file") {
					_rename(newEntity, function (ent) {
						var localPath = _modulePath + "empty.txt";
						var remotePath = PathManager.completionRemotePath(_getPathArray(ent));
						RemoteManager.uploadFile(_currentServerSetting, localPath, remotePath)
							.then(function () {
								deferred.resolve();
							}, function () {
								_deleteEntity(ent);
								_showAlert("ERROR", "New file could not upload to server.");
								deferred.reject();
							});
					});
				} else {
					_rename(newEntity, function (ent) {
						var remotePath = PathManager.completionRemotePath(_getPathArray(ent));
						RemoteManager.mkdir(_currentServerSetting, remotePath)
							.then(function () {
								deferred.resolve();
							}, function () {
								_deleteEntity(ent);
								_showAlert("ERROR", "New Directory could not upload to server.");
								deferred.reject();
							});
					});
				}
			});
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
							_showAlert("ERROR", "Could not delete file from server");
							deferred.reject(err);
						});
				} else {
					deferred.resolve();
				}
			});
		return deferred.promise();
	};
	_rename = function (entity, cb) {
		var $input = null;
		var showInput = function (entity) {
			var deferred = new $.Deferred();
			var $parent = _getElementWithEntity(entity.parent);
			var $current = _getElementWithEntity(entity);
			var $span = $("p.treeview-row > span", $current);
			var $input = $("<input/>").attr({
				type: "text",
				"id": "synapse-treeview-rename-editor"
			}).val(entity.text);
			$("p.treeview-row", $current).append($input);
			$span.hide();
			return deferred.resolve().promise();
		};
		var validate = function (entity, cb) {
			var $current = _getElementWithEntity(entity);
			var _$input = $("input", $current).focus().select();
			var parent = entity.parent;
			var $parent = _getElementWithEntity(entity.parent);
			var $span = $("p.treeview-row > span", $current);

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
					if (ent.id !== entity.id && ent.text === _$input.val()) {
						exists = true;
					}
				});
				if (exists) {
					validate(entity, cb);
				} else {
					$span.show().html(_$input.val());
					entity.text = _$input.val();
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
							_showAlert("ERROR", "Could not remove directory from server");
							deferred.reject(err);
						});
				} else {
					deferred.resolve();
				}
			});
		return deferred.promise();
	};
	_showAlert = function (title, message) {
		var $container = $("<div/>").addClass("synapse-treeview-alert")
			.html($("<p/>").addClass("title").html(title))
			.append($("<p/>").addClass("caption").html(message)).hide();
		var $treeviewcontainer = $("#synapse-treeview-container");
		$treeviewcontainer.append($container);
		var height = $container.outerHeight();
		var left = $treeviewcontainer.outerWidth();
		var treeHeight = $treeviewcontainer.outerHeight();
		var top = ((treeHeight - height) / 2) - $treeviewcontainer.offset().top;
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
	_flipContainer = function () {
		
	};
	_onProjectStateChanged = function (e, obj) {
		console.log("Project is " + obj.state);
		
		if (obj.state === Project.OPEN) { 
			_projectDir = obj.directory;
		
		} else {
			
		}
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
						deferred.resolve(baseDir);
					}, function (err) {
						deferred.reject(err);
					});
				} else {
					deferred.resolve(baseDir);
				}
			}
		});
		return deferred.promise();
	};
	
	_openFile = function (entity) {
		console.log(entity);
		var deferred = new $.Deferred();
		var remotePath = PathManager.completionRemotePath(_getPathArray(entity));
		var localPath = PathManager.completionLocalPath(_getPathArray(entity));
		if (!entity.downloaded) {
			_makeBaseDirectoryIfIsNotExists(localPath)
			.then(function (baseDir) {
				RemoteManager.download(_currentServerSetting, localPath, remotePath)
				.then(function () {
					console.log("download done");
					entity.downloaded = true;
					FileManager.openFile(localPath);
					deferred.resolve();
				}, function (err) {
					console.log(err);
				});
			}, function(err) {
				console.log(err);
			});
		} else {
			FileManager.openFile(localPath);
		}
		return deferred.promise();
	};
	
	
	/* region exports */
	exports.init = init;
	exports.setEntities = setEntities;
	exports.rootEntity = rootEntity;
	exports.open = open;
	exports.loadTreeView = loadTreeView;
	exports.refresh = refresh;
	exports.rename = rename;
	exports.newFile = newFile;
	exports.deleteFile = deleteFile;
	exports.newDirectory = newDirectory;
	exports.removeDirectory = removeDirectory;
	exports.onTreeViewContextMenu = onTreeViewContextMenu;
	exports.clearCurrentTree = clearCurrentTree;
	/* endregion */
});
