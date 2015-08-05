/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	
	/* region Modules */
	var PathManager = require("modules/PathManager");
	var FileSystem = brackets.getModule("filesystem/FileSystem");
	var ProjectManager = brackets.getModule("project/ProjectManager");
	var Async = brackets.getModule("utils/Async");
	var FileUtils = brackets.getModule("file/FileUtils");
	var PreferencesManager = brackets.getModule("preferences/PreferencesManager");
	var ExtentionUtils = brackets.getModule("utils/ExtensionUtils");
	var FileTreeView = require("modules/FileTreeView");
	var MainViewManager = brackets.getModule("view/MainViewManager");
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var moment = require("node_modules/moment/moment");
	var _ = brackets.getModule("thirdparty/lodash");
	var DocumentManager = brackets.getModule("document/DocumentManager");
	/* endregion */
	
	
	/* region Public vars */
	var open,
			close,
			closeProject,
			isOpen,
			getOpenProjectDocuments,
			getServerSetting,
			maxProjectHistory = 3;
	/* endregion */
	
	/* region Private vars */
	var
			_initProjectContext,
			_makeProjectDirIfIsNotExists,
			_createDirectory;
	/* endregion */
	
	/* region Private Methods */
	var _currentServer,
			_hostDir,
			_projectDir,
			_projectBaseDir,
			_fallbackProjectRoot,
			_directoryIsExists,
			_getDirectoryContents,
			_removeDirectoryContents,
			_removeContent,
			_removeProjectDirectoryFromRecent;
	/* endregionn */

	/* region Static vars */
	var OPEN = true,
			CLOSE = false,
			PROJECT_STATE_CHANGED = "PROJECT_STATE_CHANGED",
			Connection = {
				_state: CLOSE,
				get state() {
					return this._state;
				},
				set state(val) {
					this._state = val;
					exports.trigger(PROJECT_STATE_CHANGED, {state: this._state, directory: _projectDir});
				}
			};
	/* endregion */

	
	/* Public Methods */
	
	/**
	 * Open the project when the success connected to server, then get files list.
	 *
	 * * and this function, that will checked. is that exists tmporary diredtory and make.
	 * * and this function will checked backup number via maxProjectHistory.
	 *
	 * @param   {Object}   server setting object
	 * @returns {$.Promise} 
	 */
	open = function (server) {
		/*
		if (Connection.state === OPEN) {
			throw new Error("Unexpected exception: Project mode should be OFFLINE before open project.");
		}
		*/
		_currentServer = server;
		var deferred = new $.Deferred();
		_initProjectContext()
			.then(_directoryIsExists)
			.then(function () {
				return _makeProjectDirIfIsNotExists(_currentServer);
			})
			.then(_getDirectoryContents)
			.then(function (contents) {
				var d = new $.Deferred();
				var m = moment();
				var now = m.format("YYYYMMDDHHmmss");
				_projectDir =
					FileSystem.getDirectoryForPath(
						PathManager.getProjectDirectoryPath(server.host + "-" + server.user + "/" + now));

				_projectDir.create(function (err, res) {
					if (err) {
						d.reject("could not create current time directory");
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
							var _moveToTrash = function (server, dir) {
								var dd = new $.Deferred();
								FileSystem.getDirectoryForPath(PathManager.getProjectDirectoryPath(server.host + "-" + server.user + "/" + dir))
									.moveToTrash(function (err) {
										if (err) {
											dd.reject(err);
											throw new Error("could not remove old project directries", err);
											
										} else {
											dd.resolve();
										}
									});
								return dd.promise();
							};
							var promises = [];
							for (; i < offset; i++) {
								var dir = dirs.shift();
								promises.push(_moveToTrash(server, dir));
							}
							Async.waitForAll(promises, true, 3000)
							.then(d.resolve, d.reject);
						} else {
							d.resolve();
						}
					}
				});
				return d.promise();
			})
			.then(function () {
				_fallbackProjectRoot = ProjectManager.getProjectRoot().fullPath;
				return ProjectManager.openProject(_projectDir.fullPath)
					.then(function () {
						//console.log("promise is done when the called openProject");
						Connection.state = OPEN;
						return new $.Deferred().resolve().promise();
					}, function (err) {
						//console.log("promise is fail when the called openProject");
						Connection.state = CLOSE;
						return new $.Deferred().reject(err).promise();
					});
			})
			.then(deferred.resolve, deferred.reject);
		return deferred.promise();
	};

	/**
	 * Erase files in the tree view then remove recent project (backup temporary directory) from preference.
	 *
	 * @returns {$.Promise} 
	 */
	close = function () {
		var deferred = new $.Deferred();
		FileTreeView.clearCurrentTree()
		.then(_removeProjectDirectoryFromRecent)
		.then(function () {
			Connection.state = CLOSE;
			deferred.resolve();
		});
		return deferred.promise();
	};

	/**
	 * Close brackets projects then opened project, that is opend when before the connected remove
	 * 
	 * @returns {$.Promise}
	 */
	closeProject = function () {
		if (Connection.state === OPEN) {
			return ProjectManager.openProject(_fallbackProjectRoot);
		}
	};

	/**
	 * it will back boolean to caller, if it is true when opened Synapse project
	 *
	 * @returns {$.Promise} 
	 */
	isOpen = function () {
		return Connection.state;
	};
	
	/**
	 * It open file to current editor
	 *
	 * @returns {Array} array of Document object.
	 */
	getOpenProjectDocuments = function () {
		var deferred = new $.Deferred();
		var tmp = [];
		if (Connection.state) {
			var files = MainViewManager.getAllOpenFiles();
			_.forEach(files, function (file) {
				tmp.push(DocumentManager.getOpenDocumentForPath(file.fullPath));
			});
		}
		return deferred.resolve(tmp).promise();
	};
	
	/**
	 * It will be back current server setting object.
	 *
	 * @returns {MIX} 
	 */
	getServerSetting = function () {
		if (Connection.state === OPEN) {
			return _currentServer;
		} else {
			return false;
		}
	};
	
	/* Private Methods */
	
	_makeProjectDirIfIsNotExists = function (server) {
		var deferred = new $.Deferred();
		_hostDir = FileSystem.getDirectoryForPath(PathManager.getProjectDirectoryPath(server.host + "-" + server.user));
		_hostDir.exists(function (err, exists) {
			if (err) {
				return deferred.reject(err).promise();
			} else {
				if (!exists) {
					_hostDir.create(function (err, res) {
						if (err) {
							return deferred.reject(err).promise();
						} else {
							deferred.resolve(_hostDir);
						}
					});
				} else {
					deferred.resolve(_hostDir);
				}
			}
		});
		return deferred.promise();
	};

	_initProjectContext = function () {
		var deferred = new $.Deferred();
		_projectBaseDir = FileSystem.getDirectoryForPath(PathManager.getProjectDirectoryPath());
		_projectBaseDir.exists(function (err, res) {
			if (err) {
				return deferred.reject(err).promise();
			} else {
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
			}
		});
		return deferred.promise();
	};
	
	_directoryIsExists = function () {
		var deferred = new $.Deferred();
		var directory = _projectBaseDir;
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
		var recentProjects = getRecentProject(),
				newAry = [];
		recentProjects.forEach(function (item, idx) {
			if (item !== FileUtils.stripTrailingSlash(_projectDir.fullPath)) {
				newAry.push(item);
			}
		});
		PreferencesManager.setViewState("recentProjects", newAry);
		return new $.Deferred().resolve().promise();
	};

	
	
	EventDispatcher.makeEventDispatcher(exports);

	exports.open = open;
	exports.close = close;
	exports.closeProject = closeProject;
	exports.OPEN = OPEN;
	exports.CLOSE = CLOSE;
	exports.PROJECT_STATE_CHANGED = PROJECT_STATE_CHANGED;
	exports.getOpenProjectDocuments = getOpenProjectDocuments;
	exports.getServerSetting = getServerSetting;
});
