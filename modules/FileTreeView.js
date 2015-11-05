
/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, white: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	// HEADER >>
	var FileUtils				= brackets.getModule("file/FileUtils"),
			ExtensionUtils	= brackets.getModule("utils/ExtensionUtils"),
			EventDispatcher	= brackets.getModule("utils/EventDispatcher"),
			ProjectManager	= brackets.getModule("project/ProjectManager"),
			DocumentManager	= brackets.getModule("document/DocumentManager"),
			Async						= brackets.getModule("utils/Async"),
			EditorManager		= brackets.getModule("editor/EditorManager"),
			FileSystem			= brackets.getModule("filesystem/FileSystem"),
			MainViewManager	= brackets.getModule("view/MainViewManager"),
			_								= brackets.getModule("thirdparty/lodash"),
			Log							= require("modules/Log");

	var DialogCollection = require("modules/DialogCollection");
	var PathManager = require("modules/PathManager");
	var RemoteManager = require("modules/RemoteManager");
	var Menu = require("modules/Menu");
	var Project = require("modules/Project");
	var FileManager = require("modules/FileManager");
	var Strings = require("strings");

	var _modulePath = FileUtils.getParentPath(ExtensionUtils.getModulePath(module)),
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
			_localEntryActualDelete,
			_getEntityWithElement,
			_loadDirectory,
			_deleteEntity,
			_resetElement,
			_rebuildChildrenIndex,
			_attachEvent,
			_detachEvent,
			_getEntityWithId,
			_getElementWithEntity,
			_toggleDir,
			_newFile,

			getPathArray,
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
				file: "fa fa-file-text",
				lFile: "fa fa-file-text-o",
				folder: "fa fa-folder",
				folder_open: "fa fa-folder-open",
				lFolder: "fa fa-folder-o",
				lFolder_open: "fa fa-folder_o_open",
				block: "fa fa-unlink"
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
				this.target = param.target || null;
				this.destType = param.destType || null;
				this.children = {};
			};

	//<<



	init = function () {
		var d = new $.Deferred();
		_attachEvent();
		Project.on(Project.PROJECT_STATE_CHANGED, onProjectStateChanged);
		Menu.initTreeViewContextMenu()
		.then(d.resolve);
		return d.promise();
	};

	/**
	 * Load entity to the file tree view with root entity,
	 * root entity created by parameter.
	 * 
	 * @param {object} server setting object.
	 * @return {$.Promise} 	a promise that will be resolved with root entity, that never rejected.
	 */
	loadTreeView = function (serverSetting) {
		var d = new $.Deferred();
		_currentServerSetting = serverSetting;
		_remoteRootPath = _currentServerSetting.dir;

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
			return _setElement(null);
		})
		.then(function () {
			d.resolve(rootEntity);
		});
		return d.promise();
	};

	clearCurrentTree = function () {
		_currentServerSetting = null;
		_remoteRootPath = null;
		j.root_ul.remove();
		return new $.Deferred().resolve().promise();
	};

	setEntities = function (list, parent) {
		if (parent.type !== "directory" && parent.type !== "ldirectory") {
			throw new Error("the type property of the parent object must set directory");
		}
		
//		list = _.pluck(_.sortBy(list, "name"), "name");
		
		var deferred = new $.Deferred(),
				promises = [],
				params = [];

		var dirs = _.where(list, {type: "d"});
		var files = _.where(list, {type: "-"});
		
		var links = _.where(list, {type: "l"}),
				blocks = _.where(links, {destType: "block"}),
				ldirs = _.where(links, {destType: "ldirectory"}),
				lfiles = _.where(links, {destType: "lfile"});
		
		list = [];
		list = list
						.concat(dirs)
						.concat(ldirs)
						.concat(files)
						.concat(lfiles)
						.concat(blocks);

		list=list.sort(function(a,b){
			var typesort = 0;
			if(a['type'] === 'd' && a['type'] !== b['type']){
				typesort = -1;
			} else if(b['type'] === 'd' && a['type'] !== b['type']){
				typesort = 1;
			}
			
			if(typesort !== 0){ 
				return typesort;
			}
			
			if(a['name'].toLowerCase()<b['name'].toLowerCase()){ return -1; }
			if(a['name'].toLowerCase()>b['name'].toLowerCase()){ return 1; }
			return 0;
		});

		var depth = parent.depth + 1;
		list.forEach(function (item, index) {
			var type = "block";
			switch (item.type) {
				case "d":
					type = "directory";
					break;
				case "-":
					type = "file";
					break;
				case "l":
					type = item.destType;
					
					break;
				default:
					type = "block";
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
				target: item.target,
				destType: item.destType,
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
			.then(function () {
				deferred.resolve();
		}, function (err) {
				deferred.reject(err);
			});
		return deferred.promise();
	};

	rename = function () {
		var deferred = new $.Deferred();
		if (_ctxMenuCurrentEntity === null) {
			return deferred.reject().promise();
		}

		var oldLocalPath = PathManager.completionLocalPath(getPathArray(_ctxMenuCurrentEntity));
		var oldRemotePath = PathManager.completionRemotePath(_currentServerSetting, getPathArray(_ctxMenuCurrentEntity));
		
		var entry = null;
		if (_ctxMenuCurrentEntity.type === "file") {
			entry = FileSystem.getFileForPath(oldLocalPath);
		} else if (_ctxMenuCurrentEntity.type === "directory") {
			entry = FileSystem.getDirectoryForPath(oldLocalPath);
		}

		_rename(_ctxMenuCurrentEntity, function (entity) {

			var newLocalPath = PathManager.completionLocalPath(getPathArray(entity));
			var newRemotePath = PathManager.completionRemotePath(_currentServerSetting, getPathArray(entity));
			if (entity.type === "directory") {
				oldLocalPath += "/";
				newLocalPath += "/";
			}
			
			if (entity) {
				if (newLocalPath === oldLocalPath) {
					return deferred.resolve().promise();
				} else {
					
					RemoteManager.rename(_currentServerSetting, oldRemotePath, newRemotePath)
					.then(function (res) {
						return Project.renameLocalEntry(oldLocalPath, newLocalPath, entity.type);
					}, function (err) {
						deferred.reject(err);
					})
					.then(deferred.resolve, deferred.reject);
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
		var remotePath = PathManager.completionRemotePath(_currentServerSetting, getPathArray(_ctxMenuCurrentEntity));

		DialogCollection.showYesNoModal(
				"removeDirectoryDialog",
				"Confirm",
				"Are you sure you want to delete the selected directory and all child contents ?")
			.done(function (res) {
				if (res === "Yes") {
					RemoteManager.removeDirectory(_currentServerSetting, remotePath)
					.then(function (res) {
						if (res) {
							if (_ctxMenuCurrentEntity.downloaded) {
								_localEntryActualDelete(_ctxMenuCurrentEntity);
							}
							_deleteEntity(_ctxMenuCurrentEntity);
						}
					}, function (err) {
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
		if (_ctxMenuCurrentEntity.type === "directory" || _ctxMenuCurrentEntity.type === "ldirectory") {
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
		if (_ctxMenuCurrentEntity === null ||
				(_ctxMenuCurrentEntity.type !== "directory" && _ctxMenuCurrentEntity.type !== "ldirectory")) {
			// TODO: 選択されたカレントディレクトリでファイルの作成はできません。
			deferred.reject();
			return deferred.promise();
		}

		var $elem = _getElementWithEntity(_ctxMenuCurrentEntity);

		if (_ctxMenuCurrentEntity.type === "directory" || _ctxMenuCurrentEntity.type === "ldirectory") {
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
		var remotePath = PathManager.completionRemotePath(_currentServerSetting, getPathArray(_ctxMenuCurrentEntity));
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
							if (_ctxMenuCurrentEntity.downloaded) {
								_localEntryActualDelete(_ctxMenuCurrentEntity);
							}
							_deleteEntity(_ctxMenuCurrentEntity);
							//var f = FileSystem.getFileForPath()
							deferred.resolve();
						}, function (err) {
							// TODO: showAlert is deprecated instead Log.q
							// TODO: サーバファイルの削除に失敗しました。
							deferred.reject(err);
						});
				} else {
					deferred.resolve();
				}
			});
		return deferred.promise();
	};
	
	_localEntryActualDelete = function (entity) {
		var d = new $.Deferred();
		
		if (_currentServerSetting) {
			var absPath = PathManager.completionLocalPath(getPathArray(entity)),
					file = entity.type !== "directory" ? FileSystem.getFileForPath(absPath) : FileSystem.getDirectoryForPath(absPath),
					fullPath = file.fullPath,
					type = file.type;
			ProjectManager.deleteItem(file)
			.then(function () {
				Log.q("The " + type + " was deleted successfully (" + fullPath + ")");
				d.resolve();
			}, function (err) {
				Log.q("Failed to delete to local " + type + " (" + fullPath + ")", true, err);
				d.reject(err);
			});
		} else {
			Log.q("Unexpected function calling", true);
			d.reject();
		}
		return d.promise();
	};

	getEntityWithPath = function (localPath) {
		var split			= localPath.split("/"),
				children	= rootEntity.children,
				entity		= null;
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


	/**
	 * Create UI element from Entity.
	 * 
	 * @param {object} the entity object.
	 * @return {$.Promise} a promise will be resolved when create element, that never rejected.
	 */
	_setElement = function (entity) {
		var d = new $.Deferred(),
				$parent = null;
		
		if (entity === null) {
			$parent = $("#synapse-tree").addClass("quiet-scrollbars");
		} else {
			$parent = _getElementWithEntity(entity);
		}
		if ($parent === null || $parent === undefined || typeof ($parent) === "undefined") {
			return d.reject(new Error("Unexpected Exception. could not found the element")).promise();
		}

		$parent.find("ul.treeview-contents").remove();
		var $ul = $("<ul/>").addClass("treeview-contents");
		$parent.append($ul);

		if (entity === null) {
			$ul.show();
			_makeRowElement(rootEntity, $("#synapse-tree"), $ul);
			if ($parent.hasClass("treeview-close")) {
				_toggleDir(rootEntity);
			} else {
				$ul.css({"display": "block"});
			}
			d.resolve();
		} else {
			_.forEach(entity.children, function (ent) {
				_makeRowElement(ent, $parent, $ul);
			});
			if ($parent.hasClass("treeview-close")) {
				_toggleDir(entity);
			} else {
				$ul.css({"display": "block"});
			}
			d.resolve();
		}
		return d.promise();
	};
	
	/**
	 * Create Entity object with parameter.
	 * 
	 * @param {object} the entity object for the synapse.
	 * @return {$.Promise} a promise that will be resolved if the entity created, that never rejected.
	 */
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

	getPathArray = function (entity) {
		var target = entity;
		var entities = [];
		while (target.parent !== null) {
			entities.unshift(target.text);
			target = target.parent;
		}
		return entities;
	};

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
		
		} else
		if (entity.type === "ldirectory") {
			$li.addClass("treeview-close");
			$icon.addClass(Icon.lFolder);
		} else
		if (entity.type === "file") {
			$icon.addClass(Icon.file);
		} else
		if (entity.type === "lfile") {
			$icon.addClass(Icon.lFile);
		} else
		if (entity.type === "block") {
			$icon.addClass(Icon.block);
			$li.addClass("treeview-block");
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
			if (entity.type === "directory") {
				$icon.addClass("fa-folder-open");
				$icon.removeClass("fa-folder");
			} else
			if (entity.type === "ldirectory") {
				$icon.addClass("fa-folder-open-o");
				$icon.removeClass("fa-folder-o");
			}
			$jqElem.removeClass("treeview-close");
			$jqElem.addClass("treeview-open");
		} else if ($ul.is(":visible")) {
			if (entity.type === "directory") {
				$icon.removeClass("fa-folder-open");
				$icon.addClass("fa-folder");
			} else
			if (entity.type === "ldirectory") {
				$icon.removeClass("fa-folder-open-o");
				$icon.addClass("fa-folder-o");
			}
			$jqElem.addClass("treeview-close");
			$jqElem.removeClass("treeview-open");
		}

		$ul.animate({
			"height": "toggle"
		}, "fast");
	};

	_loadDirectory = function (entity) {
		var deferred = new $.Deferred();
		var path = "";
		if (entity.type === "ldirectory") {
			path = entity.target;
		} else {
			path = PathManager.completionRemotePath(_currentServerSetting, getPathArray(entity));
		}
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
			} else
			if (type === "directory") {
				if (ent.text.match(/^New Directory(\([0-9]+?\))?$/)) {
					cnt++;
				}
			}
		});
		var newName = "";
		if (type === "file") {
			newName = (cnt === 0) ? "New File" : "New File(" + cnt + ")";
		} else
		if (type === "directory") {
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
					var remotePath = PathManager.completionRemotePath(_currentServerSetting, getPathArray(ent));
					RemoteManager.uploadFile(_currentServerSetting, localPath, remotePath)
					.then(function () {
						deferred.resolve();
					}, function (err) {
						_deleteEntity(ent);
						deferred.reject();
					});
				});
			} else
			if (type === "directory") {
				_rename(newEntity, function (ent) {
					var remotePath = PathManager.completionRemotePath(_currentServerSetting, getPathArray(ent));
					RemoteManager.mkdir(_currentServerSetting, remotePath)
					.then(function () {
						return Project.createDirectoryIfExists(PathManager.completionLocalPath(getPathArray(ent)));
					}, function (err) {
						_deleteEntity(ent);
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
		var deferred = new $.Deferred(),
				baseDirPath = FileUtils.getDirectoryPath(localPath),
				baseDir = FileSystem.getDirectoryForPath(baseDirPath);
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
		var remotePath = "";
		var localPath = "";
		if (entity.type === "file") {
			remotePath = PathManager.completionRemotePath(_currentServerSetting, getPathArray(entity));
		} else
		if (entity.type === "lfile") {
			remotePath = entity.target;
		}
		localPath = PathManager.completionLocalPath(getPathArray(entity));
		deferred.resolve();
		
		if (!entity.downloaded) {
			_makeBaseDirectoryIfIsNotExists(localPath)
			.then(function (baseDir) {
				RemoteManager.download(_currentServerSetting, localPath, remotePath)
				.then(function () {
					entity.downloaded = true;
					FileManager.openFile(localPath);
					deferred.resolve();
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
		
		if ($elem.hasClass("treeview-directory") || $elem.hasClass("treeview-ldirectory") || $elem.hasClass("treeview-root")) {
			onDirClicked($elem);
		}
		if ($elem.hasClass("treeview-file") || $elem.hasClass("treeview-lfile")) {
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
		
		var localPath = PathManager.completionLocalPath(getPathArray(entity));
		_makeBaseDirectoryIfIsNotExists(localPath)                   
		
		if ($elem.hasClass("loaded")) {
			_toggleDir(entity);
		} else {
			_loadDirectory(entity)
			.then(function () {
				// success
				entity.downloaded = true;
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

	updateTreeviewContainerSize = function (isAnim) {
		isAnim = isAnim || false;
		var top = j.tvc.css("top");
		if (j.l.is(":visible")) {
			top = j.h.outerHeight() + j.l.outerHeight() + 10;
		}
		if (j.s.is(":visible")) {
			top = j.h.outerHeight() + j.s.outerHeight() + 10;
		}
		if (isAnim) {
			return j.tvc.animate({"top": top + "px", bottom: 0}, "fast").promise();
		} else {
			j.tvc.css({"top": top + "px", bottom: 0});
			return new $.Deferred().resolve().promise();
		}
	};

	exports.init = init;
	exports.setEntities = setEntities;
	exports.rootEntity = rootEntity;
	exports.open = open;
	exports.loadTreeView = loadTreeView;
	exports.refresh = refresh;
	exports.rename = rename;
	exports.removeFile = removeFile;
	exports.getPathArray = getPathArray;
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
