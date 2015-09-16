/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, white: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	/* region Modules */
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var FileTreeView = require("modules/FileTreeView");
	var PathManager = require("modules/PathManager");
	var Panel = require("modules/Panel");
	var Project = require("modules/Project");
	var _ = brackets.getModule("thirdparty/lodash");
	/* endregion */

	/* region Private vars */
	var _domain,
			_currentServerSetting;
	/* endregion */

	/* region Public methods */
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


	/* region Private method */
	var _convObjectLikeFTP;
	/* endretion */


	init = function (domain) {
		_domain = domain;
		clear();
		return new $.Deferred().resolve(domain).promise();
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

	connect = function (serverSetting) {
		var deferred =  new $.Deferred();
		var _rootEntity = FileTreeView.loadTreeView(serverSetting);

		var result = [];
		Panel.showSpinner();
		var remoteRoot = PathManager.getRemoteRoot();
		_domain.exec("Connect", serverSetting, remoteRoot)
		.then(function (list) {
			if (serverSetting.protocol === "sftp") {
				list = _convObjectLikeFTP(list);
			}
			list = getListIgnoreExclude(serverSetting, list);
			return FileTreeView.setEntities(list, _rootEntity);
		}, function (err) {
			console.error(err);
			//throw new Error(err);
		})
		.then(function (list) {
			return Project.open(serverSetting);
		}, function (err) {
			console.error(err);
			//throw new Error(err);
		})
		.then(function () {
			_currentServerSetting = serverSetting;
			State.mode = ONLINE;
			deferred.resolve(result);
		}, function (err) {
			console.error(err);
			//throw new Error(err);
		})
		.always(function () {
			Panel.hideSpinner();
		});
		return deferred.promise();
	};

	getList = function (entity, serverSetting, remotePath) {
		var deferred = new $.Deferred();
		Panel.showSpinner();
		_domain.exec("List", serverSetting, remotePath)
		.then(function (list) {
			if (serverSetting.protocol === "sftp") {
				list = _convObjectLikeFTP(list);
			}
			list = getListIgnoreExclude(serverSetting, list);
			deferred.resolve(list);
		}, function (err) {
			console.error(err);
		}).always(function () {
			Panel.hideSpinner();
		});
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


	_convObjectLikeFTP = function (ents) {
		var list = [];
		_.forEach(ents, function (ent) {
			var obj = {},
			octMode = ent.attrs.mode.toString(8),
			owner = "";

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

			var tmp = "";
			if (octMode.charAt(0) === "1") {
				tmp = octMode.substr(3);
				obj.type = "-";
			} else {
				tmp = octMode.substr(2);
				obj.type = "d";
			}

			if (ent.stat !== null) {
				// is symlink files.
				obj.type = ent.stat.mode.toString(8).charAt(0) === "1" ? "" : "d";
			}

			var rights = {};
			rights.user = digitToString(tmp.charAt(0));
			rights.group = digitToString(tmp.charAt(1));
			rights.other = digitToString(tmp.charAt(2));

			obj.acl = false;
			obj.owner = ent.attrs.uid;
			obj.group = ent.attrs.gid;
			obj.rights = rights;
			obj.name = ent.filename;
			obj.size = ent.attrs.size;
			obj.date = getTime(ent.attrs.mtime);
			obj.sticky = false;
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
