/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, white: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	
	// HEADER >>
	var _ = brackets.getModule("thirdparty/lodash");
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var FileTreeView = require("modules/FileTreeView");
	var Panel = require("modules/Panel");
	var PathManager = require("modules/PathManager");
	var Project = require("modules/Project");
	var Shared = require("modules/Shared");
	var Log = require("modules/Log");

	var _currentServerSetting;

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
			deleteFile
			;

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

	var _convObjectLikeFTP;
	//<<

	init = function () {
		clear();
		return new $.Deferred().resolve().promise();
	};

	clear = function () {
		jq.tv.html("");
	};

	getListIgnoreExclude = function (serverSetting, list) {
		if (serverSetting.exclude === undefined || serverSetting.exclude  === "") {
			serverSetting.exclude = "^\.$, ^\.\.$, ^\..+$";
			return list;
		}
		
		function isExclude (ptnAry, filename) {
			var _isExclude = false;
			_.forEach(ptnAry, function (ptn) {
				ptn = ptn.trim();
				ptn = ptn.replace(/\\/g, "\\");
				
				var regexp = new RegExp(ptn);
				
				_isExclude = filename.match(regexp);
				if (_isExclude) return false;
			});
			return _isExclude;
		}

		var ary = serverSetting.exclude.split(",");
		var tmp = [];
		var match;
		if (ary.length > 0) {
			_.forEach(list, function (ent) {
				match = isExclude(ary, ent.name);
				if (!match) {
					tmp.push(ent);
				}
			});
			return tmp;
		} else {
			return list;
		}
	};

	/**
	 * called by [Panel.onClickConnectBtn]
	 */
	connect = function (setting) {
		var method 			= "",
				result 			= [],
				deferred 		=  new $.Deferred(),
				_rootEntity = FileTreeView.loadTreeView(setting);
		
		Panel.showSpinner();
		
		var remoteRoot = PathManager.getRemoteRoot();
		
		if (setting.protocol === "ftp") {
			method = "connect";
		} else {
			method = "sftpConnect";
		}
		
		Shared.domain.exec(method, setting, remoteRoot)
		.then(function (list) {
			if (setting.protocol === "sftp") {
				list = _convObjectLikeFTP(list);
			}
			list = getListIgnoreExclude(setting, list);
			return FileTreeView.setEntities(list, _rootEntity);
		}, function (err) {
			console.error(err);
		})
		.then(function (list) {
			return Project.open(setting);
		}, function (err) {
			console.error(err);
		})
		.then(function () {
			_currentServerSetting = setting;
			State.mode = ONLINE;
			deferred.resolve(result);
		})
		.fail(function (err) {
			console.error(err);
		})
		.always(function () {
			Panel.hideSpinner();
		});
		return deferred.promise();
	};

	getList = function (entity, setting, remotePath) {
		var deferred = new $.Deferred(),
				method = "";
		
		Panel.showSpinner();
		
		if (setting.protocol === "ftp") {
			method = "getList";
		} else
		if (setting.protocol === "sftp") {
			method = "sftpGetList";
		}
		
		Shared.domain.exec(method, setting, remotePath)
		.then(function (list) {
			if (setting.protocol === "sftp") {
				list = _convObjectLikeFTP(list);
			}
			list = getListIgnoreExclude(setting, list);
			deferred.resolve(list);
		}, function (err) {
			console.error(err);
		}).always(function () {
			Panel.hideSpinner();
		});
		return deferred.promise();
	};

	uploadFile = function (setting, localPath, remotePath) {
		var deferred = new $.Deferred();
		var method = "";
		if (setting.protocol === "ftp") {
			method = "upload";
		} else
		if (setting.protocol === "sftp") {
			method = "sftpUpload";
		}
		Shared.domain.exec(method, setting, localPath, remotePath)
		.then(function () {
			console.log("upload completed");
			deferred.resolve();
		}, function (err) {
			if (err.code === 553) {
				err = "Permission denied";
			} else {
				err = "";
			}
			deferred.reject(err);
		});
		return deferred.promise();
	};

	mkdir = function (setting, remotePath) {
		var deferred =new $.Deferred();
		var method = "";
		if (setting.protocol === "ftp") {
			method = "createDirectory";
		} else
		if (setting.protocol === "sftp") {
			method = "sftpCreateDirectory";
		}
		Shared.domain.exec(method, setting, remotePath)
		.then(function () {
			deferred.resolve(true);
		}, deferred.reject);
		return deferred.promise();
	};

	removeDirectory = function (setting, remotePath) {
		var deferred = new $.Deferred();
		var method = "";
		if (setting.protocol === "ftp") {
			method = "removeDirectory";
		} else
		if (setting.protocol === "sftp") {
			method = "sftpRemoveDirectory";
		}
		Shared.domain.exec(method, setting, remotePath)
		.then(function (res) {
			if (res) {
				deferred.resolve(true);
				// TODO: DELETED
				Log.q("The directory was deleted.");
			} else {
				deferred.resolve(false);
				// TODO: FAILED
				Log.q("The directory was not deleted.", true);
			}
		}, function (err) {
			deferred.reject(err);
			// TODO: FAILED
		});
		return deferred.promise();
	};

	deleteFile = function (setting, remotePath) {
		var deferred = new $.Deferred();
		var method = "";
		if (setting.protocol === "ftp") {
			method = "removeFile";
		} else {
			method = "sftpRemoveFile";
		}
		Shared.domain.exec(method, setting, remotePath)
		.then(function () {
			deferred.resolve(true);
		}, deferred.reject);
		return deferred.promise();
	};

	rename = function (serverSetting, oldPath, newPath) {
		var deferred = new $.Deferred();
		Shared.domain.exec("Rename", serverSetting, oldPath, newPath)
			.then(function () {
				deferred.resolve(true);
			}, deferred.reject);
		return deferred.promise();
	};

	download = function (setting, localPath, remotePath) {
		var deferred = new $.Deferred();
		var method = "";
		if (setting.protocol === "ftp") {
			method = "download";
		} else
		if (setting.protocol === "sftp") {
			method = "sftpDownload";
		}
		Shared.domain.exec(method, setting, localPath, remotePath)
			.then(function () {
				deferred.resolve(true);
			}, deferred.reject);
		return deferred.promise();
	};

	_convObjectLikeFTP = function (ents) {
		var list = [];
		_.forEach(ents, function (ent) {
			var obj = {},
			octMode = ent.attrs.mode.toString(8);
			
			function getTime(ts) {
				var timestamp = ts;
				var date = new Date(timestamp * 1000);
				return date.toISOString();
			}
			function digitToString(digit) {
				var res = "";
				switch (digit) {
					case '7':
						res = "rwx";
						break;
					case '6':
						res = "rw";
						break;
					case '5':
						res = "rx";
						break;
					case '4':
						res = "r";
						break;
					case '3':
						res = "wx";
						break;
					case '2':
						res = "w";
						break;
					case '1':
						res = "x";
						break;
					case '0':
						res = "";
						break;
				}
				return res;
			}

			var rights = {};
			rights.other = digitToString(octMode.substr(-1, 1));
			rights.group = digitToString(octMode.substr(-2, 1));
			rights.user = digitToString(octMode.substr(-3, 1));

			obj.acl = false;
			obj.owner = ent.attrs.uid;
			obj.group = ent.attrs.gid;
			obj.rights = rights;
			obj.name = ent.filename;
			obj.size = ent.attrs.size;
			obj.date = getTime(ent.attrs.mtime);
			obj.sticky = false;
			obj.type = ent.type;
			obj.destType = ent.destType;
			obj.target = ent.target;
			obj.destType = ent.destType;
			list.push(obj);
		});
		return list;
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
	exports.getModuleName = function () {
		return module.id;
	};
});
