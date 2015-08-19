/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {

	/* region Modules */
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var FileTreeView = require("modules/FileTreeView");
	var PathManager = require("modules/PathManager");
	var Panel = require("modules/Panel");
	var Project = require("modules/Project");
	/* endregion */

	/* region Private vars */
	var _domain,
			_currentServerSetting;
	/* endregion */

	/* region Public vars */
	var init,
			clear,
			connect,
			getListIgnoreExclude,
			getList,
			uploadFile,
			rename,
			download,
			mkdir,
			removeDirectory,
			deleteFile;
	/* endregion */

	/* region Static vars */
	var ONLINE = true,
			OFFLINE = false,
			CONNECTION_CHANGED = "CONNECTION_CHAGNED",
			State = {
				_mode: OFFLINE,
				task: "",

				get mode() {
					return this._mode;
				},

				set mode(val) {
					this._mode = val;
					exports.trigger(CONNECTION_CHANGED, this._mode);
				}
			},
			jq = {
				tv : $("#synapse-tree")
			};
	/* endregion */


	/* Public Methods */

	init = function (domain) {
		_domain = domain;
		clear();
		return new $.Deferred().resolve(domain).promise();
	};

	clear = function () {
		jq.tv.html("");
	};

	getListIgnoreExclude = function (serverSetting, list) {
		var ary = serverSetting.exclude.split(",");
		var tmp = [];
		if (ary.length > 0) {
			_.forEach(list, function (file) {
				var flag = false;
				_.forEach(ary, function (ex) {
					if (ex === file.name) {
						flag = true;
						return false;
					}
				});
				if (!flag) {
					tmp.push(file);
				}
			});
			return tmp;
		} else {
			return list;
		}
	};

	connect = function (serverSetting) {
		var deferred =  new $.Deferred();
		var _rootEntity = FileTreeView.loadTreeView(serverSetting);

		var result = [];
		Panel.showSpinner();
		var remoteRoot = PathManager.getRemoteRoot();
		_domain.exec("Connect", serverSetting, remoteRoot)
		.then(function (list) {
			list = getListIgnoreExclude(serverSetting, list);
			return FileTreeView.setEntities(list, _rootEntity);
		}, function (err) {
			console.error(err);
			throw new Error(err);
		})
		.then(function (list) {
			return Project.open(serverSetting);
		}, function (err) {
			console.error(err);
			throw new Error(err);
		})
		.then(function () {
			_currentServerSetting = serverSetting;
			State.mode = ONLINE;
			deferred.resolve(result);
		}, function (err) {
			console.error(err);
			throw new Error(err);
		})
		.always(function () {
			Panel.hideSpinner();
		});
		return deferred.promise();
	};

	getList = function (entity, serverSetting, remotePath) {

		var deferred = new $.Deferred();
		_domain.exec("List", serverSetting, remotePath)
			.then(function (list) {
				list = getListIgnoreExclude(serverSetting, list);
				deferred.resolve(list);
			}, deferred.reject);
		return deferred.promise();
	};

	uploadFile = function (serverSetting, localPath, remotePath) {
		var deferred = new $.Deferred();
		_domain.exec("UploadFile", serverSetting, localPath, remotePath)
		.then(deferred.resolve, function (err) {
			if (err.code === 553) {
				err = "Permission denied";
			} else {
				err = "";
			}
			deferred.reject(err);
		});
		return deferred.promise();
	};

	mkdir = function (serverSetting, remotePath) {
		var deferred =new $.Deferred();
		_domain.exec("Mkdir", serverSetting, remotePath)
		.then(function () {
			deferred.resolve(true);
		}, deferred.reject);
		return deferred.promise();
	};

	removeDirectory = function (serverSetting, remotePath) {
		var deferred = new $.Deferred();
		_domain.exec("RemoveDirectory", serverSetting, remotePath)
		.then(function () {
			console.log("ok");
			deferred.resolve(true);
		}, function (err) {
			console.error(err);
			deferred.reject(err);
		});
		return deferred.promise();
	};

	deleteFile = function (serverSetting, remotePath) {
		var deferred = new $.Deferred();
		_domain.exec("DeleteFile", serverSetting, remotePath)
		.then(function () {
			deferred.resolve(true);
		}, deferred.reject);
		return deferred.promise();
	};

	rename = function (serverSetting, oldPath, newPath) {
		var deferred = new $.Deferred();
		_domain.exec("Rename", serverSetting, oldPath, newPath)
			.then(function () {
				deferred.resolve(true);
			}, deferred.reject);
		return deferred.promise();
	};

	download = function (serverSetting, localPath, remotePath) {
		var deferred = new $.Deferred();
		_domain.exec("Download", serverSetting, localPath, remotePath)
			.then(function () {
				deferred.resolve(true);
			}, deferred.reject);
		return deferred.promise();
	};


	EventDispatcher.makeEventDispatcher(exports);

	exports.init = init;
	exports.connect = connect;
	exports.getList = getList;
	exports.rename = rename;
	exports.uploadFile = uploadFile;
	exports.mkdir = mkdir;
	exports.download = download;
	exports.removeDirectory = removeDirectory;
	exports.deleteFile = deleteFile;
});
