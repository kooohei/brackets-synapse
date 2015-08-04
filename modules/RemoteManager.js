/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	
	// modules
	var PathManager = require("modules/PathManager");
	var FileTreeView = require("modules/FileTreeView");
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var Panel = require("modules/Panel");
	var Project = require("modules/Project");
	
	
	// private vars
	var _domain,
			_currentServerSetting;
	
	// public methods
	var init,
			clear,
			connect,
			getList,
			uploadFile, 
			rename,
			download,
			mkdir,
			removeDirectory,
			deleteFile;
	
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
		};
	
	// event handler
	var _onProjectModeChanged;
	
	
	var jq = {
		tv : $("#synapse-tree")
	};
	
	init = function (domain) {
		_domain = domain;
		clear();
		return new $.Deferred().resolve(domain).promise();
	};
	
	clear = function () {
		jq.tv.html("");
	};
	
	connect = function (serverSetting) {
		var deferred =  new $.Deferred();
		var _rootEntity = FileTreeView.loadTreeView(serverSetting);
		
		var result = [];
		Panel.showSpinner();
		var remoteRoot = PathManager.getRemoteRoot();
		_domain.exec("Connect", serverSetting, remoteRoot)
		.then(function (list) {
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
			.then(deferred.resolve, deferred.reject);
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
	
	_onProjectModeChanged = function () {
		
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