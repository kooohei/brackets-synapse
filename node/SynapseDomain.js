/*jslint node:true, esnext: true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
(function () {
	"use strict";
	
	// HEADER >>
	var fs			= require("fs"),
			path		= require("path"),
			FTP			= require("ftp"),
			SFTP		= require("ssh2").Client,
			Q				= require("q");
			
	var modules = {};
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
	
	
	var _domainManager	= null;
	
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
			setting.readyTimeout = ENV.ConnectionTimeout;
			setting.keepaliveCountMax = 5;
//			setting.debug = function (arg) {
//				console.log({SSH2_DEBUG: arg});
//			};
			if (setting.auth === "key") {
				setting.privateKey = fs.readFileSync(setting.privateKeyPath);
			}
		}
		return setting;
	};
	ftpResolveEntity = function (setting, remotePath) {
		var	promises = [],
				masterQ = Q.defer(),
				con = new FTP();
		
		function setType (con, entity) {
			var q = Q.defer();
			con.cwd(entity.target, function (err, cwd) {
				if (err) {
					entity.destType = "block";
				} else {
					entity.destType = "ldirectory";
				}
				q.resolve(entity);
			});
			return q.promise;
		}
		con.on("error", function (err) {
			masterQ.reject(err);
			ftpClose(con);
			return masterQ.promise;
		});
		con.on("ready", function () {
			con.list(remotePath, function (err, list) {
				if (err) {
					masterQ.reject(err);
					ftpClose(con);
					return masterQ.promise;
				}
				
				if (list.length === 0) {
					masterQ.resolve([]);
					ftpClose(con);
					return masterQ.promise;
				}
				
				list = list.filter(function (elem, idx, ary) {
					return elem.name !== "." && elem.name !== "..";
				});
				
				var links = list.filter(function (elem, idx, ary) {
							return elem.type === "l";
						}),
						result = list.filter(function (elem, idx, ary) {
							return elem.type !== "l";
						});
				
				if (links.length === 0) {
					masterQ.resolve(list);
					ftpClose(con);
					return masterQ.promise;
				}
				Q.all(links.map(function (link) {
					return setType(con, link);
				}))
				.then(function (values) {
					values.forEach(function (val) {
						result.push(val);
					});
					masterQ.resolve(result);
					ftpClose(con);
				}, function (err) {
					masterQ.reject(err);
				});
			});
		});
		con.connect(setting);
		return masterQ.promise;
	};
	sftpResolveEntity = function (setting, remotePath) {
			var	con = new SFTP();
			var masterQ = Q.defer();
		
			function stat(sftp, ent) {
				var q = Q.defer(),
						stats = ent.attrs;
				
				if (stats.isDirectory()) {
					ent.type = "d";
					q.resolve(ent);
				} else
				if (stats.isFile()) {
					ent.type = "-";
					q.resolve(ent);
				} else
				if (stats.isSymbolicLink()) {
					ent.type = "l";
					//------------------------------------------------
					var p = path.join(remotePath, ent.filename);
					var pAry = p.split("\\");
					p = pAry.join("/");
					sftp.readlink(p, function (err, target) {
						if (err) {
							//console.log({ERROR_1: err});
							ent.destType = "block";
						} else {
							//console.log({TARGET_1: target});
							ent.target = target;
							//------------------------------------------------
							sftp.lstat(ent.target, function (err, stat) {
								if (err) {
									//console.log({ERROR_2: err});
									ent.destType = "block";
									q.resolve(ent);
								} else {
									if (stat.isDirectory()) {
										ent.destType = "ldirectory";
									} else
									if (stat.isFile()) {
										ent.destType = "lFile";
									} else {
										ent.destType = "block";
									}
									q.resolve(ent);
								}
							});
							
							//------------------------------------------------
						}
					});
					//------------------------------------------------
				}
				return q.promise;
			}
		
			con.once("error", function (err) {
				//console.log({sftpListError_0: err});
				masterQ.reject(err);
			});
			con.once("ready", function () {
				con.sftp(function (err, sftp) {
					if (err) {
						//console.log({sftpListError_1: err});
						con.end();
						masterQ.reject(err);
						
					} else {
						sftp.readdir(remotePath, function (err, list) {
							if (err) {
								//console.log({sftpListError_2: err});
								con.end();
								masterQ.reject(err);
							} else {
								
								Q.all(list.map(function (ent) {
									return stat(sftp, ent);
								}))
								.then(function (ents) {
									masterQ.resolve(ents);
									con.end();
								});
							}
						});
					}
				});
		}).connect(setting);
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
					cb(null, list);
					ftpClose(con);
				}
			});
		}).connect(setting);
	};
	sftpConnectTest = function (setting, cb) {
		
		setting = resolveSetting(setting);
		var con = new SFTP();
		con.once("error", function (err) {
			cb(err);
			con.end();
		});
		con.once("ready", function () {
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
		ftpResolveEntity(setting, remotePath)
		.then(function (res) {
			cb(null, res);
		}, function (err) {
			cb(err);
		});
	};
	sftpConnect = function (setting, remotePath, cb) {
		setting = resolveSetting(setting);
		sftpResolveEntity(setting, remotePath)
		.then(function (list) {
			cb(null, list);
		})
		.fail(function (err) {
			cb(err);
		});
	};
	
	/**
	 * Get files list.
	 */
	getList = function (setting, remotePath, cb) {
		setting = resolveSetting(setting);
		
		ftpResolveEntity(setting, remotePath)
		.then(function (res) {
			cb(null, res);
		}, function (err) {
			cb(err);
		});
	};
	sftpGetList = function (setting, remotePath, cb) {
		setting = resolveSetting(setting);
		sftpResolveEntity(setting, remotePath)
		.then(function (list) {
			cb(null, list);
		})
		.fail(function (err) {
			cb(err);
		});
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
		con.once("error", function (err) {
			if (err) {
				cb(err);
			}
			ftpClose(con);
		});
		con.once("ready", function () {
			con.rmdir(remotePath, true, function (err) {
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
	sftpRemoveDirectory = function (setting, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new SFTP();
		con.once("error", function (err) {
			cb(err);
			con.end();
		});
		con.once("ready", function () {
			con.exec("rm -rf " + '"' + remotePath + '"', function (err, stream) {
				if (err) {
					cb(err);
				} else {
					stream.on("close", function (code, signal) {
						if (code === 0) {
							cb(null, true);
							con.end();
						} else
						if (code === 1) {
							cb(null, false);
							con.end();
						}
					}).on("data", function (data) {
						// console.log(1, data);
					}).stderr.on("data", function (data) {
						// console.log(2, data);
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
		con.once("ready", function () {
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
		con.once("ready", function () {
			con.sftp(function (err, sftp) {
				if (err) {
					cb(err);
				} else {
					sftp.mkdir(path, function (err) {
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
		con.once("ready", function () {
			con.sftp(function (err, sftp) {
				if (err) {
					cb(err);
					con.end();
				} else {
					sftp.fastPut(localPath, remotePath, function (err) {
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
	
	download = function (setting, localPath, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new FTP();
		con.on("error", function (err) {
			if (err) {
				cb(err);
			}
			ftpClose();
		});
		con.once("ready", function () {
			con.get(remotePath, function (err, stream) {
				if (err) {
					cb(err);
					ftpClose(con);
				} else {
					stream.pipe(fs.createWriteStream(localPath));
					stream.once("close", function () {
						cb(null, true);
						ftpClose(con);
					});
				}
			});
		});
		con.connect(setting);
	};
	sftpDownload = function (setting, localPath, remotePath, cb) {
		setting = resolveSetting(setting);
		var con = new SFTP();
		
		con.once("error", function (err) {
			cb(err);
			con.end();
		});
		con.once("ready", function () {
			con.sftp(function (err, sftp) {
				if (err) {
					cb(err);
					con.end();
				} else {
					sftp.fastGet(remotePath, localPath, function (err) {
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
				name: "list", 
				type: "object"
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
			"getList",
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
				name: "res",
				type: "boolean"
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
		
		domainManager.registerCommand(
			"synapse",
			"createDirectory",
			createDirectory, 
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
			"sftpCreateDirectory",
			sftpCreateDirectory, 
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
	};
	exports.init = init;
}());