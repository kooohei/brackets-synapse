/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	var PathManager = require("modules/PathManager");
	var FileSystem = brackets.getModule("filesystem/FileSystem");
	var ProjectManager = brackets.getModule("project/ProjectManager");
	var Async = brackets.getModule("utils/Async");
	var FileUtils = brackets.getModule("file/FileUtils");
	var PreferencesManager = brackets.getModule("preferences/PreferencesManager");
	var ExtentionUtils = brackets.getModule("utils/ExtensionUtils");
	var TreeView = require("modules/TreeView");
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");

	// public methods
	var open,
		close;
	// private methods
	var _initProjectDir,
		_initProjectContext;
	// private vars
	var _currentServer,
		_projectDir,
		_transactionDir,
		_fallbackProjectRoot;
	// wrapper methods for promise
	var _directoryIsExists,
		_getDirectoryContents,
		_removeDirectoryContents,
		_removeContent,
		_removeProjectDirectoryFromRecent;
	// Static vars for State.mode
	var ONLINE = true,
		OFFLINE = false;
	// Static vars for Event name
	var MODE_CHANGED = "mode_changed";
	// Project state
	var State = {
		_mode: OFFLINE,
		task: "",

		get mode() {
			return this._mode;
		},

		set mode(val) {
			this._mode = val;
			exports.trigger(MODE_CHANGED, this._mode);
		}
	};


	// Start function
	open = function (server) {

		if (State.mode === ONLINE) {
			throw new Error("Unexpected exception: Project mode should be OFFLINE before open project.");
		}

		var deferred = new $.Deferred();
		_initProjectContext()
			.then(_directoryIsExists)
			.then(_getDirectoryContents)
			.then(_removeDirectoryContents)
			.then(function () {
				_fallbackProjectRoot = ProjectManager.getProjectRoot().fullPath;
				return ProjectManager.openProject(_projectDir.fullPath)
				.then(function () {
					console.log("promise is done when the called openProject")
					State.mode = ONLINE;
					return new $.Deferred().resolve().promise();
				}, function (err) {
					console.log("promise is fail when the called openProject")
					State.mode = OFFLINE;
					return new $.Deferred().reject(err).promise();
				});
			}).then(deferred.resolve, deferred.reject);
		return deferred.promise();
	};

	close = function () {
		ProjectManager.openProject(_fallbackProjectRoot)
			.then(function () {
				TreeView.clearCurrentTree()
					.then(_removeProjectDirectoryFromRecent)
					.then(function () {
						State.mode = OFFLINE;
					});
			})
			.fail(function (err) {
				console.error(err);
			});
	};

	_initProjectContext = function () {
		var master = new $.Deferred();
		var deferred = new $.Deferred();
		var deferred2 = new $.Deferred();

		_projectDir = FileSystem.getDirectoryForPath(PathManager.getProjectDirectoryPath());
		_projectDir.exists(function (err, res) {
			if (err) {
				return deferred.reject(err).promise();
			} else {
				if (!res) {
					_projectDir.create(function (err, res) {
						if (err) {
							return deferred.reject(err).promise();
						} else {
							deferred.resolve();
						}
					});
				} else {
					deferred.resolve();
				}
			}
		});

		_transactionDir = FileSystem.getDirectoryForPath(PathManager.getTransactionDirectoryPath());
		_transactionDir.exists(function (err, res) {
			if (err) {
				deferred2.reject(err);
			} else {
				if (!res) {
					_transactionDir.create(function (err, res) {
						if (err) {
							return deferred2.reject(err).promise();
						} else {
							deferred2.resolve();
						}
					});
				} else {
					deferred2.resolve();
				}
			}
		});

		if (deferred.state() === "resolved" && deferred2.state() === "resolved") {
			master.resolve();
		} else {
			master.reject();
		}
		return deferred.promise();
	};

	/**
	 * Wrapped brackets api methods for Promise.
	 */
	_directoryIsExists = function () {
		var deferred = new $.Deferred();
		var directory = _projectDir;
		directory.exists(function (err, exists) {
			if (err) {
				deferred.reject(err);
			} else {
				if (exists) {
					deferred.resolve(directory);
				} else {
					deferred.reject(new ReferenceError(directory + " does not exists."));
				}
			}
		});
		return deferred.promise();
	};

	_getDirectoryContents = function (directory) {
		var deferred = new $.Deferred();
		directory.getContents(function (err, contents, stats, obj) {
			if (err) {
				deferred.rejecte(err);
			} else {
				deferred.resolve(contents);
			}
		});
		return deferred.promise();
	};

	_removeDirectoryContents = function (contents) {
		if (contents.length === 0) {
			console.log("4: _removeDirectoryContents");
			return new $.Deferred().resolve().promise();
		}
		var funcs = [];
		contents.forEach(function (entity) {
			funcs.push(_removeContent(entity));
		});

		return Async.WaitForAll(funcs, true);
	};

	_removeContent = function (entity) {
		console.log("current function _removeContent");
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
		function getRecentProject() {
			var recents = PreferencesManager.getViewState("recentProjects") || [],
				i;
			for (i = 0; i < recents.length; i++) {
				recents[i] = FileUtils.stripTrailingSlash(ProjectManager.updateWelcomeProjectPath(recents[i] + "/"));
			}
			return recents;
		}
		var projectPath = PathManager.getProjectDirectoryPath(),
			recentProjects = getRecentProject(),
			newAry = [];

		recentProjects.forEach(function (item, idx) {
			if (item !== projectPath) {
				newAry.push(item);
			}
		});
		PreferencesManager.setViewState("recentProjects", newAry);
		return new $.Deferred().resolve().promise();
	};

	EventDispatcher.makeEventDispatcher(exports);

	exports.open = open;
	exports.close = close;
	exports.ONLINE = ONLINE;
	exports.OFFLINE = OFFLINE;
	exports.MODE_CHANGED = MODE_CHANGED;
});
