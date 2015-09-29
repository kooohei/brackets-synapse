/*jslint node: true, vars: true, plusplus: true, white: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, brackets: true, $, window, navigator, Mustache, jQuery, console, moment */
(function () {
	"use strict";

	/**
	 * MODULE CODE: 2 for ERROR CODE.
	 */
	
	
	// HEADER >>
	var _domainManager = null,
			homedir = require("homedir"),
			Client = require("ftp"),
			SSH = require("ssh2").Client,
			Q = require("q"),
			fs = require("fs");
	
	var client = null,
			homeDir,
			init,
			test,
			connect,
			securePrivateKeyConnect,
			getList,
			rename,
			upload,
			mkdir,
			removeDirectory,
			deleteFile,
			download,
			_logout,
			
			_getSftpOption,
			_sftpReadDir,
			_sftpCheckSymLink,
			_sftpCheckSymLinks,
			_sftpStat,

			_ftpReadDir,
			_ftpCheckSymLink,
			_ftpCheckSymLinks;
	//<<
	
	// priority : passowrd -> private key -> hostbased -> none.
	var param = {
		// string
		host: "localhost",
		// integer
		port: 22, 
		// boolean
		forceIPv4: false,
		// boolean
		forceIPv6: false,
		
		/* *
		 * [for Host Base Authentication]
		 * hostHash,
		 * hostVerifier, 
		 * * Synapse is not support host verification.
		 */
		
		// string
		username: "",
		// string
		password: "",
		
		/* *
		 * [for SSH Agent based user authentication]
		 * agent
		 * * Synapse is not support SSH Agent based user auth.
		 */
		
		// mixed "buffer" of "string", OpenSSH formated.
		privateKey: null,
		// string for decrypt to privateKey
		passphrase: "",
		
		
		
		/* *
		 * [for Hostbased user authentication]
		 * localHostname 
		 * localusername
		 */
		
		/**
		 * tryKeyboard if we use intaractive authentication. but Synapse is not support
		 */
		
		// integer
		keepAliveInterval: 0,
		// integer
		keepAliveCountMax: 3,
		// integer (millseconds) default: 20sec -> 8sec
		readyTimeout: 8000
	};
	
	securePrivateKeyConnect = function (server, remoteRoot, cb) {
		var con = new SSH();
		con.on("ready", function (err) {
			if (err) {
				cb(err);
				console.error(err);
			}
			
		}).connect({
			host: server.host,
			port: server.port,
			username: server.username,
			privateKey: ""
		});
		
	};
	
	
	
	
	
	
	
	_getSftpOption = function (setting) {
		var settingObj = {
					host: setting.host,
					port: parseInt(setting.port),
					username: setting.user
				};

		if (setting.auth === "key") {
			settingObj.privateKey = setting.privateKey;
			settingObj.passphrase = setting.passphrase;
		} else
		if (setting.auth === "password") {
			settingObj.password = setting.password;
		}
		return settingObj;
	};
	_sftpReadDir = function (sftp, remoteRoot) {
		var q = Q.defer();
		sftp.readdir(remoteRoot, function (err, list) {
			if (err) {
				q.reject(err);
			} else {
				q.resolve(list);
			}
		});
		return q.promise;
	};
	_sftpCheckSymLink = function (sftp, row, basePath) {
		var q = Q.defer();
		if (row.longname.charAt(0) === "l") {
			var filePath = basePath === "./" ? basePath + row.filename : basePath + "/" + row.filename;
			sftp.stat(filePath, function (err, stat) {
				if (err) {
					q.reject(err);
				} else {
					row.stat = stat;
					q.resolve(row);
				}
			});
		} else {
			row.stat = null;
			q.resolve(row);
		}
		return q.promise;
	};
	_sftpCheckSymLinks = function (sftp, basePath, list) {
		var q = Q.defer();
		var files = [];
		var promises = [];
		list.forEach(function (row) {
			var promise = _sftpCheckSymLink(sftp, row, basePath);
			promises.push(promise);

		});
		Q.all(promises)
		.then(function (values) {
			q.resolve(values);
		}, q.reject);

		return q.promise;
	};
	_ftpReadDir = function (client, path) {
		var q = Q.defer();
		client.list(path, function (err, list) {
			if (err) {
				q.reject(err);
			} else {
				q.resolve(list);
			}
		});
		return q.promise;
	};
	
	
	/**
	 * called by [RemoteManager.connect, SettingManager.connectTest]
	 * METHOD CODE: 1 for ERROR CODE.
	 */
	connect = function (server, remoteRoot, cb) {
		/* FTP */
		if (server.protocol === "ftp") {
			client = new Client();
			client.once("error", cb);
			client.once("ready", function () {
				_ftpReadDir(client, remoteRoot)
				.then(function (list) {
					cb(null, list);
				}, cb)
				.finally(function () {
					_logout(client);
				});
			});
			client.connect(server);
		}

		/* SFTP */
		if (server.protocol === "sftp") {
			var setting = _getSftpOption(server);

			client = new SSH();
			client.on("error", function (err) {
				var param = {
					method: "SynapseDomain.connect:SFTP",
					message: "",
					code: "2-1"
				};
				if (typeof (err) === "object") {
					param.message = JSON.stringify(err);
				} else {
					param.message = err;
				}
				console.error(err);
			});
			client.on("ready", function () {
				client.sftp(function (err, sftp) {
					if (err) {
						cb(err);
					} else {
						remoteRoot = remoteRoot === "" ? "./" : remoteRoot;
						_sftpReadDir(sftp, remoteRoot)
						.then(function (list) {
							return _sftpCheckSymLinks(sftp, remoteRoot, list);
						})
						.then(function (files) {
							cb(null, files);
							client.end();
						}, function (err) {
							cb(err);
							client.end();
						});
					}
				});
			}).connect(setting);
		}
	};
	
	/**
	 * called by just self.
	 */
	_logout = function (client) {
		client.once("close", function () {});
		client.once("end", function () {});

		client.logout(function (err, res) {
			if (err) {
				console.error(err);
			} else {
				client = null;
			}
		});
	};
	
	/**
	 * called by [RemoteManager.uploadFile]
	 */
	upload = function (server, localPath, remotePath, cb) {
		if (server.protocol === "ftp") {
			client = new Client();
			client.once("error", function (err) {
				if (err) {
					cb(err);
				}
				_logout(client);
			});

			client.once("ready", function () {
				client.put(localPath, remotePath, function (err) {
					_logout(client);
					if (err) {
						cb(err);
					} else {
						cb(null, true);
					}

				});
			});
			client.connect(server);
		} else
		if (server.protocol === "sftp") {
			var setting = _getSftpOption(server);
			client = new SSH();
			client.on("ready", function () {
				client.sftp(function (err, sftp) {
					if (err) {
						console.error(err);
						cb(err);
					} else {
						sftp.fastPut(localPath, remotePath, function (err) {
							if (err) {
								console.error(err);
								cb(err);
							} else {
								cb(null, true);
							}
							client.end();
						});
					}
				});
			}).connect(setting);
		}
	};
	
	/**
	 * called by [RemoteManager.getList]
	 */
	getList = function (server, path, cb) {

		if (server.protocol === "ftp") {
			client = new Client();
			client.once("error", function (err) {
				if (err) {
					cb(err);
				}
				_logout(client);
			});

			client.once("ready", function () {
				client.list(path, function (err, list) {
					_logout(client);
					if (err) {
						cb(err);
					} else {
						cb(null, list);
					}
				});
			});
			client.connect(server);
		} else if (server.protocol === "sftp") {
			client = new SSH();
			client.on("ready", function () {
				client.sftp(function(err, sftp) {
					if (err) {
						cb(err);
					} else {
						path = path === "" ? "./" : path;
						_sftpReadDir(sftp, path)
						.then(function (list) {
							return _sftpCheckSymLinks(sftp, path, list);
						})
						.then(function (files) {
							cb(null, files);
							client.end();
						}, function (err) {
							cb(err);
							client.end();
						});
					}
				});
			}).connect(_getSftpOption(server));
		}
	};
	
	/**
	 * called by [RemoteManager.rename]
	 */
	rename = function (server, oldPath, newPath, cb) {
		if (server.protocol === "ftp") {
			client = new Client();
			client.once("error", function (err) {
				if (err) {
					cb(err);
				}
				_logout(client);
			});

			client.once("ready", function () {
				client.rename(oldPath, newPath, function (err) {
					_logout(client);
					if (err) {
						cb(err);
					} else {
						cb(null, true);
					}
					client.end();
				});
			});
			client.connect(server);
		} else
		if (server.protocol === "sftp") {
			var setting = _getSftpOption(server);
			client = new SSH();
			client.on("ready", function () {
				client.sftp(function (err, sftp) {
					if (err) {
						cb(err);
						console.error(err);
					} else {
						sftp.rename(oldPath, newPath, function (err) {
							if (err) {
								cb(err);
							} else {
								cb(null, true);
							}
						});
					}
				});
			}).connect(setting);
		}
	};
	
	/**
	 * called by [RemoteManager.mkdir]
	 */
	mkdir = function (server, path, cb) {

		if (server.protocol === "ftp") {

			client = new Client();
			client.once("error", function (err) {
				if (err) {
					_logout(client);
					cb(err);
				}
			});
			client.once("ready", function () {
				client.mkdir(path, false, function (err) {
					_logout(client);
					if (err) {
						cb(err);
					} else {
						cb(null, true);
					}
				});
			});
			client.connect(server);
		} else
		if (server.protocol === "sftp") {
			var setting = _getSftpOption(server);
			client = new SSH();
			client.on("ready", function () {
				client.sftp(function (err, sftp) {
					if (err) {
						cb(err);
					} else {
						sftp.mkdir(path, function (err) {
							if (err) {
								cb(err);
							} else {
								cb(null, true);
							}
							client.end();
						});
					}
				});
			}).connect(setting);
		}
	};
	
	/**
	 * called by [RemoteManager.removeDirectory]
	 */
	removeDirectory = function (serverSetting, remotePath, cb) {

		if (serverSetting.protocol === "ftp") {
			client = new Client();
			client.once("error", function (err) {
				if (err) {
					_logout(client);
					cb(err);
				}
			});
			client.once("ready", function () {
				client.rmdir(remotePath, true, function (err) {
					_logout(client);
					if (err) {
						cb(err);
					} else {
						cb(null, true);
					}
				});
			});
			client.connect(serverSetting);
		}

		if (serverSetting.protocol === "sftp") {
			var setting = _getSftpOption(serverSetting);
			client = new SSH();
			client.on("ready", function () {
				client.sftp(function (err, sftp) {
					if (err) {
						cb(err);
					} else {
						sftp.rmdir(remotePath, function (err) {
							if (err) {
								cb(err);
							} else {
								cb(null, true);
							}
							client.end();
						});
					}
				});
			}).connect(setting);
		}
	};
	
	/**
	 * called by [RemoteManager.deleteFile]
	 */
	deleteFile = function (serverSetting, remotePath, cb) {
		if (serverSetting.protocol === "ftp") {
			client = new Client();
			client.once("error", function (err) {
				_logout(client);
				if (err) {
					cb(err);
				}
			});
			client.once("ready", function () {
				client.delete(remotePath, function (err) {
					_logout(client);
					if (err) {
						cb(err);
					} else {
						cb(null, true);
					}
				});
			});
			client.connect(serverSetting);
		} else
		if (serverSetting.protocol === "sftp") {
			var setting = _getSftpOption(serverSetting);
			client = new SSH();
			client.on("ready", function () {
				client.sftp(function (err, sftp) {
					if (err) {
						cb(err);
					} else {

						sftp.unlink(remotePath, function (err) {
							if (err) {
								cb(err);
							} else {
								cb(null, true);
							}
							client.end();
						});
					}
				});
			}).connect(setting);
		}
	};
	
	/**
	 * called by [RemoteManager.download]
	 */
	download = function (serverSetting, localPath, remotePath, cb) {

		if (serverSetting.protocol === "ftp") {
			client = new Client();
			client.once("error", function (err) {
				if (err) {
					_logout(client);
					cb(err);
				}
			});
			client.once("ready", function () {
				client.get(remotePath, function (err, stream) {
					if (err) {
						cb(err);
						_logout(client);
					} else {
						stream.pipe(fs.createWriteStream(localPath));
						stream.once("close", function () {
							client.end();
							_logout(client);
							cb(null, true);
						});
					}
				});
			});
			client.connect(serverSetting);

		} else if (serverSetting.protocol === "sftp") {
			var setting = _getSftpOption(serverSetting);
			client = new SSH();
			client.on("ready", function () {
				client.sftp(function (err, sftp) {
					if (err) {
						cb(err);
					} else {
						sftp.fastGet(remotePath, localPath, function (err, nb, data) {
							if (err) {
								cb(err);
							} else {
								cb(null, true);
							}
							client.end();
						});
					}
				});
			}).connect(setting);
		}
	};
	
	/**
	 * called by [Panel.openFileSelect]
	 */
	homeDir = function () {
		return homedir();
	};
	init = function (domainManager, domainPath) {

		if (!domainManager.hasDomain("synapse")) {
			domainManager.registerDomain("synapse", {
				major: 0,
				minor: 1
			});
		}
		_domainManager = domainManager;

		domainManager.registerCommand(
			"synapse",
			"homeDir",
			homeDir,
			false,
			"", [{
			}],
			[{
				name: "path",
				type: "string"
			}]
		);
		
		// FTP and SFTP functions >>
		domainManager.registerCommand(
			"synapse",
			"Connect",
			connect,
			true,
			"", [{
				name: "serverSetting",
				type: "object"
			}, {
				name: "remoteRoot",
				type: "string"
			}], [{
				name: "list",
				type: "object"
			}]
		);
		domainManager.registerCommand(
			"synapse",
			"List",
			getList,
			true,
			"", [{
				name: "serverSetting",
				type: "object"
			}, {
				name: "path",
				type: "string"
			}], [{
				name: "list",
				type: "object"
			}]
		);
		domainManager.registerCommand(
			"synapse",
			"Rename",
			rename,
			true,
			"", [{
				name: "serverSetting",
				type: "object"
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
			"Mkdir",
			mkdir,
			true,
			"", [{
				name: "serverSetting",
				type: "object"
			}, {
				name: "path",
				type: "string"
			}], [{
				name: "res",
				type: "boolean"
			}]
		);
		domainManager.registerCommand(
			"synapse",
			"UploadFile",
			upload,
			true,
			"", [{
				name: "serverSetting",
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
			"RemoveDirectory",
			removeDirectory,
			true,
			"", [{
				name: "serverSetting",
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
			"DeleteFile",
			deleteFile,
			true,
			"", [{
				name: "serverSetting",
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
			"Download",
			download,
			true,
			"", [{
				name: "serverSetting",
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
		
		/**
		 * usage _domainManager.emitEvent("synapse", "error", {method: string, message: string});
		 * message made by library the ftp of ssh2, that must parse to json if it type is object.
		 */
		domainManager.registerEvent(
			"synapse",
			"error",
			{
				method: "",
				message: ""
			}
		);
		
		// <<
	};

	exports.init = init;
}());
