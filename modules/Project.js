/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	// HEADER >>
	var FileSystem					= brackets.getModule("filesystem/FileSystem"),
			ProjectManager			= brackets.getModule("project/ProjectManager"),
			Async								= brackets.getModule("utils/Async"),
			FileUtils						= brackets.getModule("file/FileUtils"),
			PreferencesManager	= brackets.getModule("preferences/PreferencesManager"),
			ExtentionUtils			= brackets.getModule("utils/ExtensionUtils"),
			MainViewManager			= brackets.getModule("view/MainViewManager"),
			EventDispatcher			= brackets.getModule("utils/EventDispatcher"),
			_										= brackets.getModule("thirdparty/lodash"),
			PathManager					= require("modules/PathManager"),
			Log									= require("modules/Log"),
			Utils								= require("modules/Utils"),
			FileTreeView				= require("modules/FileTreeView");

	var open,
			close,
			openFallbackProject,
			isOpen,
			getServerSetting,
			createDirectoryIfExists,
			renameLocalEntry,
			maxProjectHistory = 10;

	var
			_initProjectContext,
			_createSettingDirIfIsNotExists,
			_createDirectory;

	var _currentServer,
			_hostDir,
			_projectDir,
			_projectBaseDir,
			_fallbackProjectRoot,
			_getDirectoryContents,
			_removeDirectoryContents,
			_removeContent,
			_removeProjectDirectoryFromRecent;

	var OPEN = true,
			CLOSE = false,
			PROJECT_STATE_CHANGED = "PROJECT_STATE_CHANGED",
			STATE = {
				_state: CLOSE,
				isOpen: function () {
					return this._state === OPEN;
				},
				setOpen: function () {
					this._state = OPEN;
					exports.trigger(PROJECT_STATE_CHANGED, {state: OPEN, directory: _projectDir});
				},
				setClose: function () {
					this._state = CLOSE;
					exports.trigger(PROJECT_STATE_CHANGED, {state: CLOSE, directory: _projectDir});
				}
			};
	//<<


	/**
	 * Open the project when the success connected to server.
	 *
	 * * and this function, that will checked. is that exists tmporary diredtory and make.
	 * * and this function will checked backup number via maxProjectHistory.
	 *
	 * @param   {Object}   server setting object
	 * @returns {$.Promise}
	 */
	open = function (server) {
		_currentServer = server;
		var deferred = new $.Deferred();

		/**
		 * The function will be confirm whether __PROJ__ directory is exists or not.
		 */
		_initProjectContext()
		.then(function () {
			return _createSettingDirIfIsNotExists(_currentServer);
		}, function (err) {
			deferred.reject(err);
		})
		.then(_getDirectoryContents, function (err) {
			deferred.reject(err);
		})
		.then(function (contents) {
			var d = new $.Deferred();
			var now = Utils.now("YYYYMMDDhhmmss");
			_projectDir =
				FileSystem.getDirectoryForPath(
					PathManager.getProjectDirectoryPath(server.name + "_" + server.host + "_" + server.user + "/" + now));
			_projectDir.create(function (err, stats) {
				if (err) {
					Log.q("Failed to create the current project directory", true, err);
					d.reject(err).promise();
				} else {
					var tmp = [];
					if ((contents.length + 1) > maxProjectHistory) {
						_.forEach(contents, function (content) {
							tmp.push(content.name);
						});
						var dirs = _.sortBy(tmp, function (num) {
							return num;
						});
						var offset = (contents.length + 1) - maxProjectHistory;
						var i = 0;

						var _moveToTrash = function (server, dirNames) {
							var dd = new $.Deferred();
							var item = FileSystem.getDirectoryForPath(PathManager.getProjectDirectoryPath(server.name + "_" + server.host + "_" + server.user + "/" + dirNames));

							ProjectManager.deleteItem(item)
							.then(dd.resolve, function (err) {
								Log.q("Failed to delete the old project.", true, err);
								dd.reject(err);
							});
							return dd.promise();
						};

						var promises = [];
						for (; i < offset; i++) {
							var dirNames = dirs.shift();
							promises.push(_moveToTrash(server, dirNames));
						}

						Async.waitForAll(promises, true, 3000)
						.then(d.resolve, function (err) {
							err = new Error({message: "Error occured at the _Project.open function", err: err});
							console.log("SYNAPSE ERROR", err);
							d.reject(err);
						});
					} else {
						d.resolve();
					}
				}
			});
			return d.promise();
		}, deferred.reject)
		.then(function () {
			if (!STATE.isOpen()) {
				_fallbackProjectRoot = ProjectManager.getProjectRoot().fullPath;
			}
			return ProjectManager.openProject(_projectDir.fullPath);
		})
		.then(function () {
			STATE.setOpen();
			deferred.resolve();
		}, function (err) {
			STATE.setClose();
			Log.q("Failed to open the project", true, err);
			deferred.reject(err);
		});

		return deferred.promise();
	};
	/**
	 * Erase files in the tree view then remove recent project (backup temporary directory) from preference.
	 *
	 * @returns {$.Promise}
	 */
	close = function () {
		var deferred = new $.Deferred();
		if (STATE.isOpen()) {
			FileTreeView.clearCurrentTree()
			.then(_removeProjectDirectoryFromRecent)
			.then(function () {
				STATE.setClose();
				deferred.resolve();
			});
		} else {
			deferred.resolve();
		}
		return deferred.promise();
	};
	/**
	 * Open stored project, that is stored at before connection established
	 *
	 * @returns {$.Promise}
	 */
	openFallbackProject = function () {
		var d = new $.Deferred();
		ProjectManager.openProject(_fallbackProjectRoot)
		.then(d.resolve, d.reject);
		return d.promise();
	};
	/**
	 * it will back boolean to caller, if it is true when opened Synapse project
	 *
	 * @returns {$.Promise}
	 */
	isOpen = function () {
		return STATE.isOpen();
	};
	/**
	 * It will be back current server setting object.
	 *
	 * @returns {MIX}
	 */
	getServerSetting = function () {
		if (STATE.isOpen()) {
			return _currentServer;
		} else {
			return false;
		}
	};

	createDirectoryIfExists = function (path) {
		var d = new $.Deferred();
		var dir = FileSystem.getDirectoryForPath(path);
		dir.exists(function (err, exists) {
			if (exists) {
				d.resolve();
			} else {
				dir.create(function (err) {
					if (err) {
						// TODO: ディレクトリの作成に失敗しました。
						d.reject(err);
					} else {
						d.resolve();
					}
				});
			}
		});
		return d.promise();
	};

	renameLocalEntry = function (oldPath, newPath, type) {
		var d = new $.Deferred();
		var oldEntry = null,
				newEntry = null;
		if (type === "file") {
			oldEntry = FileSystem.getFileForPath(oldPath);
		} else {
			oldEntry = FileSystem.getDirectoryForPath(oldPath);
		}
		oldEntry.exists(function (err, exists) {
			if (exists) {
				oldEntry.rename(newPath, function (err) {
					if (err) {
						// TODO: ファイル名の変更に失敗しました。
						Log.q("Failed to rename to the file (" + oldEntry.fullPath + ")", true, err);
						d.reject(err);
					} else {
						d.resolve();
					}
				});
			}
			d.resolve();
		});
		return d.promise();
	};
	/**
	 * This function will be confirm whether the individual server setting directory is exists of not,
	 * create that if is not exists.
	 */
	_createSettingDirIfIsNotExists = function (server) {
		var deferred = new $.Deferred(),
				_settingDir = FileSystem.getDirectoryForPath(PathManager.getProjectDirectoryPath(server.name + "_" + server.host + "_" + server.user));

		(function () {
			var d = new $.Deferred();
			_settingDir.exists(function (err, exists) {
				if (err) {
					Log.q("Failed to confirm whether the individual server setting directory is exists or not.", true, err);
					console.log("SYNAPSE ERROR", err);
					d.reject(err);
				} else {
					d.resolve(_settingDir, exists);
				}
			});
			return d.promise();
		}())
		.then(function (_settingDir, exists) {
			var d = new $.Deferred();
			if (!exists) {
				_settingDir.create(function (err, res) {
					if (err) {
						Log.q("Failed to create the individual server setting directory.", true, err);
						console.log("SYNAPSE ERROR", err);
						d.reject(err);
					} else {
						d.resolve(_settingDir);
					}
				});
			} else {
				d.resolve(_settingDir);
			}
			return d.promise();
		}, function (err) {
			// anonymous function rejected.
			err = new Error({message: "Error occured at Project._createSettingDirIfIsNotExists.", err: err});
			console.log(err);
			deferred.reject(err);
		})
		.then(deferred.resolve, deferred.reject);
		return deferred.promise();
	};
	/**
	 * This function will be confirm whether the directory for the remote project (__PROJ__ directory) for project is exists or not.
	 *
	 * @return {$.Promise} a promise, that will be resolved when the base directory is exists
	 * 																or that created if is not exists, or rejected.
	 */
	_initProjectContext = function () {
		var deferred = new $.Deferred();
		_projectBaseDir = FileSystem.getDirectoryForPath(PathManager.getProjectDirectoryPath());
		(function () {
			var d = new $.Deferred();
			_projectBaseDir.exists(function (err, res) {
				if (err) {
					Log.q("Failed to confirm function whether __PROJ__ directory is not exists or not.", true, err);
					d.reject(err);
				} else {
					d.resolve(res);
				}
			});
			return d.promise();
		}())
		.then(function (res) {
			if (!res) {
				_projectBaseDir.create(function (err, res) {
					if (err) {
						return deferred.reject(err).promise();
					} else {
						deferred.resolve();
					}
				});
			} else {
				deferred.resolve();
			}
		}, function (err) {
			// _projectBaseDir.exists is rejected
			Log.q("Failed to confirm whether the directory for the remote project is exists or not.", true, err);
			deferred.reject(err);
		});
		return deferred.promise();
	};

	_getDirectoryContents = function (directory) {
		var deferred = new $.Deferred();
		directory.getContents(function (err, contents, stats, obj) {
			if (err) {
				Log.q("Failed to read the directory contents", true, err);
				deferred.rejecte(err);
			} else {
				deferred.resolve(contents);
			}
		});
		return deferred.promise();
	};

	_removeDirectoryContents = function (contents) {
		if (contents.length === 0) {
			return new $.Deferred().resolve().promise();
		}
		var funcs = [];
		contents.forEach(function (entity) {
			funcs.push(_removeContent(entity));
		});

		return Async.WaitForAll(funcs, true);
	};

	_removeContent = function (entity) {
		var deferred = new $.Deferred();
		entity.moveToTrash(function (err) {
			if (err) {
				deferred.reject(err);
			} else {
				deferred.resolve();
			}
		});
		return deferred.promise();
	};

	_removeProjectDirectoryFromRecent = function () {
		function getRecentProjectPath(path, projectDirPath) {
			var d = new $.Deferred(),
					item = FileUtils.stripTrailingSlash(ProjectManager.updateWelcomeProjectPath(path + "/"));
			if (item !== projectDirPath) {
				d.resolve(item);
			} else {
				d.resolve(null);
			}
			return d.promise();
		}
		var masterD = new $.Deferred(),
				projectDirPath = FileUtils.stripTrailingSlash(_projectDir.fullPath),
				recentProjectPaths = PreferencesManager.getViewState("recentProjects") || [],
				promises = [];
		
		if (recentProjectPaths.length === 0 ) {
			return masterD.resolve().promise();
		}
		_.forEach(recentProjectPaths, function (path) {
			promises.push(getRecentProjectPath(path, projectDirPath));
		});
		Async.waitForAll(promises, false, 3000)
		.then(function (res) {
			var resAry = res.filter(function (item) { return item !== null; });
			if (resAry.length > 0) {
				PreferencesManager.setViewState("recentProjects", resAry);
			}
			masterD.resolve();
		}, function (err) {
			masterD.reject(err);
		});
		return masterD.promise();
	};



	EventDispatcher.makeEventDispatcher(exports);

	exports.open = open;
	exports.close = close;
	exports.isOpen = isOpen;
	exports.openFallbackProject = openFallbackProject;
	exports.OPEN = OPEN;
	exports.CLOSE = CLOSE;
	exports.STATE = STATE;
	exports.PROJECT_STATE_CHANGED = PROJECT_STATE_CHANGED;
	exports.getServerSetting = getServerSetting;
	exports.createDirectoryIfExists = createDirectoryIfExists;
	exports.renameLocalEntry = renameLocalEntry;
});
