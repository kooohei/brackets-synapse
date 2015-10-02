/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
(function () {
	"use strict";
	
	// HEADER >>
	var FTP = require("ftp");
	var SFTP = require("ssh2").Client;
	var fs = require("fs");
	var path = require("path");
	var Q = require("q");
	var _domainManager = null;
	
	var init;
	
	var	resolveSetting,
			ftpClose,
			ftpResolveEntity,
			sftpResolveEntity;
	
	var connectTest,
			sftpConnectTest;
	
	var	connect,
			sftpConnect;
	
	var getList,
			sftpGetList;
	
	var rename,
			sftpRename,
			removeDirectory,
			sftpRemoveDirectory,
			removeFile,
			sftpRemoveFile;
	
	var createDirectory,
			sftpCreateDirectory;
	
	var upload,
			sftpUpload,
			download,
			sftpDownload;
	var ENV = {
		//milseconds.
		ConnectionTimeout: 5000,
		CommandTimeout: 5000
	};
	// <<
	
	
	resolveSetting = function (setting) {
		if (setting.protocol === "ftp") {
			setting.conTimeout = ENV.ConnectionTimeout;
			setting.pasvTimeout = ENV.CommandTimeout;
		}
		
		if (setting.protocol === "sftp") {
			setting.username = setting.user;
			setting.readyTimeout = ENV.ConnectionTimeou;
			
			if (setting.auth === "key") {
				setting.privateKey = fs.readFileSync(setting.privateKeyPath);
			}
		}
		return setting;
	};
	
	
	/**
	 * Utility functions.
	 * 
	 * octet (100: file) (40: directory) (120: link)
	 */
	ftpResolveEntity = function (list, remotePath, setting) {
		var links = [],
				result = [],
				promises = [],
				masterQ = Q.defer(),
				setType = null;
		if (list.length === 0) {
			masterQ.resolve();
			return masterQ.promise;
		}
		
		/*
		setType = function (entity, setting) {
			var q = Q.defer(),
					parentPath = path.dirname(entity.target),
					destName = path.basename(entity.target);
			
			getList(setting, parentPath, function (err, ents) {
				if (err) {
					console.error(err);
					q.reject(err);
				} else {
					if (typeof (ents) === "undefined") {
						entity.destType = "out of priority";
						q.resolve(entity);
					} else {
						ents.forEach(function (ent) {
							if (err) {
								q.reject(err);
							} else {
								if (ent.name === destName) {
									entity.destName = ent.type;
									q.resolve(entity);
								}
							}
						});
					}
				}
			});

			
			return q.promise;
		};
		
		list.forEach(function (entity) {
			if (entity.type === "l") {
				links.push(entity);
			} else {
				result.push(entity);
			}
		});
		
		if (links.length === 0) {
			masterQ.resolve(result);
		} else {
			var i = 0;
			for (; i < links.length; i++) {
				var promise = setType(links[i], setting);
				promise.timeout(5000);
				promises.push(promise);
			}
			Q.all(promises)
			.then(function (values) {
				values.forEach(function (val) {
					result.push(val);
					masterQ.resolve(result);
				});
			}, function (err) {
				masterQ.reject(err);
			});
		}
		*/
		masterQ.resolve(result);
		return masterQ.promise;
	};
	sftpResolveEntity = function (list, remotePath, sftp) {
		if (list.length === 0) {
			var q = Q.defer();
			return q.resolve().promise;
		}
		var setType = function (entity) {
			var mode = parseInt(entity.attrs.mode);
			var octal = mode.toString(8);
			if (octal.match(/^120[0-9]+?/)) {
				entity.type = "l";
			} else 
			if (octal.match(/^100[0-9]+?/)) {
				entity.type = "-";
			} else 
			if (octal.match(/^40[0-9]?/)) {
				entity.type = "d";
			} else {
				entity.type = "unknonw";
			}
			return entity;
		};
		var getRealPath = function (symlinkPath) {
			var q = Q.defer();
			sftp.realpath(symlinkPath, function (err, realPath) {
				if (err) {
					q.reject(err);
				} else {
					q.resolve(realPath);
				}
			});
			return q.promise;
		};
		var getDestType = function (entity) {
			var q = Q.defer();
			sftp.stat(entity.target, function (err, stat) {
				if (err) {
					q.reject(err);
				} else {
					var octal = stat.mode.toString(8);
					if (octal.match(/^40[0-9]+?/)) {
						entity.destType = "d";
					} else
					if (octal.match(/^100[0-9]+?/)) {
						entity.destType = "-";
					} else {
						q.reject(new Error("File mode unknown."));
					}
					q.resolve(entity);
				}
			});
			return q.promise;
		};
		var links = [],
				result = [],
				promises = [],
				masterQ = Q.defer();
		
		list.forEach(function (entity) {
			entity = setType(entity);
			if (entity.type === "l") {
				links.push(entity);
			} else {
				result.push(entity);
			}
		});
		if (links.length === 0) {
			masterQ.resolve(result);
		} else {
			links.forEach(function (entity) {
				var destPath = path.join(remotePath, entity.filename);
				var promise = (function () {
					var q = Q.defer();
					getRealPath(destPath)
					.then(function (realPath) {
						entity.target = realPath;
						return getDestType(entity);
					})
					.then(function () {
						q.resolve(entity);
					})
					.fail(function (err) {
						q.reject(err);
					});
					return q.promise;
				}(entity));
				promises.push(promise);
			});
			Q.all(promises)
			.then(function (values) {
				values.forEach(function (val) {
					result.push(val);
					masterQ.resolve(result);
				});
			}, function (err) {
				masterQ.reject(err);
			});
		}
		return masterQ.promise;
	};
	ftpClose = function (con) {
		con.once("close", function () {});
		con.once("end", function () {});
		
		con.logout(function (err, res) {
			if (err) {
				console.error(err);
			} else {
				con = null;
			}
		});
	};
	
	/**
	 * Auth Connect
	 */
	connectTest = function (setting, cb) {
		setting = resolveSetting(setting);
		var remotePath = setting.dir === "" ? "./" : setting.dir;
		var con = new FTP();
		con.once("error", function (err) {
			console.error(err);
			cb(err);
			ftpClose(con);
		});
		con.once("ready", function () {
			con.list(remotePath, function (err, list) {
				if (err) {
					cb(err);
					ftpClose(con);
				} else {
					cb(null, true);
					ftpClose(con);
				}
			});
		}).connect(setting);
	};
	sftpConnectTest = function (setting, cb) {
		
		setting = resolveSetting(setting);
		
		var con = new SFTP();
		con.on("error", function (err) {
			cb(err);
			con.end();
		});
		con.on("ready", function () {
			con.sftp(function (err, sftp) {
				if (err) {
					cb(err);
					con.end();
				} else {
					cb(null, true);
					con.end();
				}
			});
		}).connect(setting);
	};
	
	connect = function (setting, remotePath, cb) {
		setting = resolveSetting(setting);
		
		var con = new FTP();
		con.once("error", function (err) {
			cb(err);
			ftpClose(con);
		});
		
		con.once("ready", function () {
			con.list(remotePath, function (err, items) {
				if (err) {
					console.error(err);
					cb(err);
					ftpClose(con);
				} else {
					ftpResolveEntity(items, remotePath, setting)
					.then(function (result) {
						cb(null, result);
					}, function (err) {
						console.error(err);
						cb(err);
					})
					.finally(function () {
						ftpClose(con);
					});
				}
			});
		});
		con.connect(setting);
	};
	sftpConnect = function (setting, remotePath, cb) {
		setting = resolveSetting(setting);
		
		var con = new SFTP();
		con.on("error", function (err) {
			cb(err);
			con.end();
		});
		if (setting.auth === "key") {
			setting.privateKey = fs.readFileSync(setting.privateKeyPath);
		}
		con.on("ready", function () {
			con.sftp(function (err, sftp) {
				if (err) {
					cb(err);
					con.end();
				} else {
					sftp.readdir(remotePath, function (err, list) {
						if (err) {
							cb(err);
							con.end();
						} else {
							sftpResolveEntity(list, remotePath, sftp)
							.then(function (result) {
								cb(null, result);
							}, function (err) {
								cb(err);
							})
							.finally(function () {
								con.end();
							});
						}
					});
				}
			});
		}).connect(setting);
	};
	
	/**
	 * Get files list.
	 */
	getList = function (setting, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new FTP();
		con.once("error", function (err) {
			if (err) {
				cb(err);
			}
			ftpClose(con);
		});
		con.once("ready", function () {
			con.list(remotePath, function (err, list) {
				if (err) {
					cb(err);
					ftpClose(con);
				} else {
					ftpResolveEntity(list, remotePath, con)
					.then(function (result) {
						cb(null, result);
					}, function (err) {
						cb(err);
					})
					.finally(function () {
						ftpClose(con);
					});
				}
			});
		});
		con.connect(setting);
	};
	sftpGetList = function (setting, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new SFTP();
		con.on("error", function (err) {
			cb(err);
			con.end();
		});
		if (setting.auth === "key") {
			setting.privateKey = fs.readFileSync(setting.privateKeyPath);
		}
		con.on("ready", function () {
			con.sftp(function (err, sftp) {
				if (err) {
					cb(err);
					con.end();
				} else {
					sftp.readdir(remotePath, function (err, list) {
						if (err) {
							cb(err);
							con.end();
						} else {
							sftpResolveEntity(list, remotePath, sftp)
							.then(function (result) {
								cb(null, result);
							}, function (err) {
								cb(err);
							})
							.finally(function () {
								con.end();
							});
						}
					});
				}
			});
		}).connect(setting);
	};
	
	/**
	 * Mod files.
	 */
	rename = function (setting, oldPath, newPath, cb) {
		setting = resolveSetting(setting);
		var con = new FTP();
		con.once("error", function (err) {
			if (err) {
				cb(err);
			}
			ftpClose(con);
		});
		con.once("ready", function () {
			con.rename(oldPath, newPath, function (err) {
				if (err) {
					cb(err);
					ftpClose(con);
				} else {
					cb(null, true);	
					ftpClose(con);
				}
			});
		});
		con.connect(setting);
	};
	sftpRename = function (setting, oldPath, newPath, cb) {
		setting = resolveSetting(setting);
		var con = new SFTP();
		con.on("error", function (err) {
			cb(err);
			con.end();
		});
		if (setting.auth === "key") {
			setting.privateKey = fs.readFileSync(setting.privateKeyPath);
		}
		con.on("ready", function () {
			con.sftp(function (err, sftp) {
				if (err) {
					cb(err);
					con.end();
				} else {
					sftp.rename(oldPath, newPath, function (err) {
						if (err) {
							cb(err);
						} else {
							cb(null, true);
						}
						con.end();
					});
				}
			});
		}).connect(setting);
	};
	
	removeDirectory = function (setting, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new FTP();
		con.on("error", function (err) {
			if (err) {
				cb(err);
			}
			ftpClose(con);
		});
		con.on("ready", function () {
			con.rmdir(remotePath, true, function (err) {
				if (err) {
					cb(err);
				} else {
					cb(null, true);
				}
				ftpClose(con);
			});
		});
		con.connect(setting);
	};
	sftpRemoveDirectory = function (setting, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new SFTP();
		con.on("error", function (err) {
			cb(err);
			con.end();
		});
		if (setting.auth === "key") {
			setting.privateKey = fs.readFileSync(setting.privateKeyPath);
		}
		con.on("ready", function () {
			con.sftp(function (err, sftp) {
				if (err) {
					cb(err);
					cb.end();
				} else {
					con.rmdir(remotePath, true, function (err) {
						if (err) {
							cb(err);
						} else {
							cb(null, true);
						}
						con.end();
					});
				}
			});
		}).connect(setting);
	};
	removeFile = function (setting, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new FTP();
		con.on("error", function (err) {
			if (err) {
				cb(err);
			} else {
				cb({});
			}
			ftpClose(con);
		});
		con.on("ready", function () {
			con.delete(remotePath, function (err) {
				if (err) {
					cb(err);
				} else {
					cb(null, true);
				}
				ftpClose(con);
			});
		});
		con.connect(setting);
	};
	sftpRemoveFile = function (setting, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new SFTP();
		con.on("error", function (err) {
			cb(err);
			cb.end();
		});
		if (setting.auth === "key") {
			setting.privateKey = fs.readFileSync(setting.privateKeyPath);
		}
		con.on("ready", function () {
			con.sftp(function (err, sftp) {
				if (err) {
					cb(err);
					cb.end();
				} else {
					sftp.unlink(remotePath, function (err) {
						if (err) {
							cb(err);
						} else {
							cb(null, true);
						}
						con.end();
					});
				}
			});
		}).connect(setting);
	};
	
	/**
	 * Create Entity.
	 */
	createDirectory = function (setting, path, cb) {
		setting = resolveSetting(setting);
		var con = new FTP();
		con.once("error", function (err) {
			if (err) {
				cb(err);
			}
			ftpClose(con);
		});
		con.on("ready", function () {
			con.mkdir(path, false, function (err) {
				if (err) {
					cb(err);
					ftpClose(con);
				} else {
					cb(null, true);
					ftpClose(con);
				}
			});
		});
		con.connect(setting);
	};
	sftpCreateDirectory = function (setting, path, cb) {
		setting = resolveSetting(setting);
		var con = new SFTP();
		con.once("error", function (err) {
			if (err) {
				cb(err);
			}
			con.end();
		});
		if (setting.auth === "key") {
			setting.privateKey = fs.readFileSync(setting.privateKeyPath);
		}
		con.once("ready", function () {
			con.sftp(function (err, sftp) {
				if (err) {
					cb(err);
				} else {
					sftp.mkdir(path, function (err) {
						if (err) {
							cb(err);
						} else {
							cb(null, true);
						}
						con.end();
					});
				}
			});
		}).connect(setting);
	};
	/**
	 * Transfer
	 */
	upload = function (setting, localPath, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new FTP();
		con.once("error", function (err) {
			if (err) {
				cb(err);
			}
			ftpClose(con);
		});
		con.once("ready", function () {
			con.put(localPath, remotePath, function (err) {
				if (err) {
					cb(err);
					ftpClose(con);
				} else {
					cb(null, true);
					ftpClose(con);
				}
			});
		});
		con.connect(setting);
	};
	sftpUpload = function (setting, localPath, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new SFTP();
		con.once("error", function (err) {
			cb(err);
			con.end();
		});
		if (setting.auth === "key") {
			setting.privateKey = fs.readFileSync(setting.privateKeyPath);
		}
		con.on("ready", function () {
			con.sftp(function (err, sftp) {
				if (err) {
					cb(err);
					cb.end();
				} else {
					sftp.fastPut(localPath, remotePath, function (err) {
						if (err) {
							cb(err);
						} else {
							cb(null, true);
						}
						cb.end();
					});
				}
			});
		}).connect(setting);
	};
	
	download = function (setting, localPath, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new FTP();
		con.on("error", function (err) {
			if (err) {
				cb(err);
			}
			ftpClose();
		});
		con.on("ready", function () {
			con.get(remotePath, function (err, stream) {
				if (err) {
					cb(err);
					ftpClose(con);
				} else {
					stream.pipe(fs.createWriteStream(localPath));
					stream.once("close", function () {
						con.end();
						ftpClose(con);
						con(null, true);
					});
				}
			});
		});
		con.connect(setting);
	};
	sftpDownload = function (setting, localPath, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new SFTP();
		con.on("error", function (err) {
			cb(err);
			con.end();
		});
		if (setting.auth === "key") {
			setting.privateKey = fs.readFileSync(setting.privateKeyPath);
		}
		con.on("ready", function () {
			con.sftp(function (err, sftp) {
				if (err) {
					cb(err);
					con.end();
				} else {
					sftp.fastGet(remotePath, localPath, function (err, nb, data) {
						if (err) {
							cb(err);
							con.end();
						} else {
							cb(null, true);
							con.end();
						}
					});
				}
			});
		}).connect(setting);
	};
	
	/**
	 * Initialize DomainManager.
	 */
	init = function (domainManager, _domainPath) {
		if (!domainManager.hasDomain("synapse")) {
			domainManager.registerDomain("synapse", {
				major: 0,
				minor: 1
			});
		}
		_domainManager = domainManager;
		
		_domainManager.registerCommand(
			"synapse",
			"connectTest",
			connectTest,
			true,
			"", [{
				name: "setting",
				type: "object",
			}, {
				name: "remotePath",
				type: "string"
			}], [{
				name: "err",
				type: "object"
			}, {
				name: "res", 
				type: "boolean"
			}]
		);
		
		_domainManager.registerCommand(
			"synapse",
			"sftpConnectTest",
			sftpConnectTest,
			true,
			"", [{
				name: "setting",
				type: "object",
			}], [{
				name: "res", 
				type: "boolean"
			}]
		);
		
		_domainManager.registerCommand(
			"synapse", 
			"connect", 
			connect,
			true,
			"", [{
				name: "setting",
				type: "object"
			}, {
				name: "remotePath",
				type: "string"
			}],[{
				name: "list", 
				type: "object"
			}]
		);
		domainManager.registerCommand(
			"synapse", 
			"sftpConnect", 
			sftpConnect,
			true,
			"", [{
				name: "setting",
				type: "object"
			}, {
				name: "remotePath",
				type: "string"
			}],[{
				name: "list",
				type: "object"
			}]
		);
		
		domainManager.registerCommand(
			"synapse",
			"List",
			getList,
			true,
			"", 
			[{
				name: "setting",
				type: "string"
			}, {
				name: "remotePath",
				type: "string"
			}], [{
				name: "list",
				type: "object"
			}]
		);
		
		domainManager.registerCommand(
			"synapse",
			"sftpGetList",
			sftpGetList,
			true,
			"", 
			[{
				name: "setting",
				type: "string"
			}, {
				name: "remotePath",
				type: "string"
			}], [{
				name: "list",
				type: "object"
			}]
		);
		
		domainManager.registerCommand(
			"synapse",
			"rename",
			rename,
			true,
			"", 
			[{
				name: "setting",
				type: "string"
			}, {
				name: "oldPath",
				type: "string"
			}, {
				name: "newPath",
				type: "string"
			}], [{
				name: "res",
				type: "boolean"
			}]
		);
		domainManager.registerCommand(
			"synapse",
			"sftpRename",
			sftpRename,
			true,
			"", 
			[{
				name: "setting",
				type: "string"
			}, {
				name: "oldPath",
				type: "string"
			}, {
				name: "newPath",
				type: "string"
			}], [{
				name: "res",
				type: "boolean"
			}]
		);
		domainManager.registerCommand(
			"synapse",
			"removeDirectory",
			removeDirectory,
			true,
			"", 
			[{
				name: "setting",
				type: "string"
			}, {
				name: "remotePath",
				type: "string"
			}], [{
			}]
		);
		domainManager.registerCommand(
			"synapse", 
			"sftpRemoveDirectory",
			sftpRemoveDirectory,
			true,
			"", 
			[{
				name: "setting",
				type: "object",
			}, {
				name: "remotePath",
				type: "string"
			}], 
			[{
				name: "res",
				type: "boolean"
			}]
		);
		domainManager.registerCommand(
			"synapse",
			"removeFile",
			removeFile,
			true,
			"", 
			[{
				name: "setting",
				type: "object",
			}, {
				name: "remotePath",
				type: "string"
			}], [{
				name: "res",
				type: "boolean"
			}]
		);
		domainManager.registerCommand(
			"synapse",
			"sftpRemoveFile",
			sftpRemoveFile,
			true,
			"", 
			[{
				name: "setting",
				type: "object"
			}, {
				name: "remotePath",
				type: "string"
			}], [{
				name: "res",
				type: "boolean"
			}]
		);
		
		domainManager.registerCommand(
			"synapse",
			"upload",
			upload,
			true,
			"", 
			[{
				name: "setting",
				type: "object"
			}, {
				name: "localPath",
				type: "string"
			}, {
				name: "remotePath",
				type: "string"
			}], [{
				name: "res",
				type: "boolean"
			}]
		);
		
		domainManager.registerCommand(
			"synapse",
			"sftpUpload",
			sftpUpload,
			true,
			"",
			[{
				name: "setting",
				type: "object"
			}, {
				name: "setting",
				type: "object"
			}, {
				name: "localPath",
				type: "string"
			}, {
				name: "remotePath",
				type: "string"
			}], [{
				name: "res",
				type: "boolean"
			}]
		);
		
		domainManager.registerCommand(
			"synapse",
			"download",
			download,
			true,
			"",
			[{
				name: "setting",
				type: "object"
			}, {
				name: "localPath",
				type: "string"
			}, {
				name: "remotePath",
				type: "string"
			}], [{
				name: "res", 
				type: "boolean"
			}]
		);
		
		domainManager.registerCommand(
			"synapse",
			"sftpDownload",
			sftpDownload, 
			true,
			"",
			[{
				name: "setting",
				type: "object"
			}, {
				name: "localPath",
				type: "string"
			}, {
				name: "remotePath",
				type: "string"
			}], [{
				name: "res",
				type: "boolean"
			}]
		);
			
	};
	exports.init = init;
}());