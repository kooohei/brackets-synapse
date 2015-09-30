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
	
	var init,
			ftpClose,
			ftpResolveEntity,
			sftpResolveEntity,
			connect,
			secureConnect;
	// <<
	//octet (100: file) (40: directory) (120: link)
	
	
	ftpResolveEntity = function (list, remotePath, con) {
		var links = [],
				result = [],
				promises = [],
				masterQ = Q.defer(),
				setType = null;
		if (list.length === 0) {
			return Q.defer().resolve().promise();
		}
		
		setType = function (entity) {
			var q = Q.defer(),
			parentPath = path.dirname(links[i].target),
			destName = path.basename(links[i].target);
			
			con.list(parentPath, function (err, entities) {
				entities.forEach(function (ent) {
					if (ent.name === destName) {
						entity.destType = ent.type;
						q.resolve(entity);
					}
				});
				if (q.state !== "fullfilled") {
					q.reject(new Error("The destination of symlink could not found"));
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
				promises.push(setType(links[i]));
			}
			Q.all(promises)
			.then(function (values) {
				values.forEach(function (val) {
					result.push(val);
					console.log(result);
					masterQ.resolve(result);
				});
			}, function (err) {
				masterQ.reject(err);
			});
		}
		return masterQ.promise;
	};
	
	sftpResolveEntity = function (list, remotePath, sftp) {
		if (list.length === 0) {
			return Q.defer().resolve().promise();
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
					console.log(result);
					masterQ.resolve(result);
				});
			}, function (err) {
				masterQ.reject(err);
			});
		}
		return masterQ.promise;
	};
	
	connect = function (setting, remotePath, cb) {
		var con = new FTP();
		con.once("error", function (err) {
			cb(err);
		});
		
		con.once("ready", function () {
			con.list(remotePath, function (err, items) {
				if (err) {
					cb(err);
					ftpClose(con);
				} else {
					ftpResolveEntity(items, remotePath, con)
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
	
	secureConnect = function (setting, remotePath, cb) {
		var con = new SFTP();
		con.on("error", function (err) {
			cb(err);
			con.end();
		});
		setting.privateKey = fs.readFileSync(setting.privateKeyPath);
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
				
			}]
		);
		domainManager.registerCommand(
			"synapse", 
			"secureConnect", 
			secureConnect,
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
	};
	
	exports.init = init;
}());