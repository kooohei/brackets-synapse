/*jslint node: true, vars: true, plusplus: true, white: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, brackets: true, $, window, navigator, Mustache, jQuery, console, moment */
(function () {
	"use strict";

	var SSH = require("ssh2").Client;
	var Client = require("ftp");
	var fs = require("fs");
	var _domainManager = null;
	var client = null,
			init,
			test,
			connect,
			getList,
			rename,
			upload,
			mkdir,
			removeDirectory,
			deleteFile,
			download,
			logout,
			readLocalFile,
			
			_getSftpOption;

	_getSftpOption = function (setting) {
		var settingObj = {
					host: setting.host,
					port: parseInt(setting.port),
					username: setting.user
				};
		
		if (setting.auth === "key") {
			settingObj.privateKey = fs.readFileSync(setting.privateKey);
			settingObj.passphrase = setting.passphrase;
		} else
		if (setting.auth === "password") {
			settingObj.password = setting.password;
		}
		return settingObj;
	};

	connect = function (server, remoteRoot, cb) {
		if (server.protocol === "ftp") {
			// FTP
			client = new Client();
			client.once("error", function (err) {
				if (err) {
					cb(err);
				}
			});
			client.once("ready", function () {
				client.list(remoteRoot, function (err, list) {
					logout(client);
					if (err) {
						cb(err);
					} else {
						cb(null, list);
					}
				});
			});
			server.debug = true;
			client.connect(server);

		} else if (server.protocol === "sftp") {
			// SFTP
			var setting = _getSftpOption(server);
			client = new SSH();
			client.on("error", function (err) {
				console.error(err);
			});
			client.on("ready", function () {
				client.sftp(function (err, sftp) {
					if (err) {
						cb(err);
						console.error(err);
					} else {
						
						sftp.readdir((remoteRoot === "" ? "./" : remoteRoot), function (err, list) {
							if (err) {
								cb(err);
								console.log(["error from synapse domain", err]);
							} else {
								cb(null, list);
							}
							client.end();
						});
					}
				});
			}).connect(setting);
		}
	};

	logout = function (client) {
		client.once("close", function () {});
		client.once("end", function () {});

		client.logout(function (err, res) {
			if (err) {
				console.log("unexpected error lv.666");
			} else {
				client = null;
			}
		});
	};

	upload = function (server, localPath, remotePath, cb) {
		if (server.protocol === "ftp") {
			client = new Client();
			client.once("error", function (err) {
				if (err) {
					cb(err);
				}
				logout(client);
			});

			client.once("ready", function () {
				client.put(localPath, remotePath, function (err) {
					logout(client);
					if (err) {
						cb(err);
					} else {
						cb(null, true);
					}
					client.connect(server);
				});
			});
			
		} else 
		if (server.protocol === "sftp") {
			var setting = _getSftpOption(server);
			client = new SSH();
			client.on("ready", function () {
				client.sftp(function (err, sftp) {
					if (err) {
						cb(err);
					} else {
						sftp.fastPut(localPath, remotePath, function (err) {
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

	getList = function (server, path, cb) {
		if (server.protocol === "ftp") {
			client = new Client();
			client.once("error", function (err) {
				if (err) {
					cb(err);
				}
				logout(client);
			});

			client.once("ready", function () {
				client.list(path, function (err, list) {
					logout(client);
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
						sftp.readdir((path === "" ? "./" : path), function (err, list) {
							if (err) {
								cb(err);
							} else {
								cb(null, list);
							}
							client.end();
						});
					}
				});
			}).connect(_getSftpOption(server));
		}
	};

	rename = function (server, oldPath, newPath, cb) {
		if (server.protocol === "ftp") {
			client = new Client();
			client.once("error", function (err) {
				if (err) {
					cb(err);
				}
				logout(client);
			});

			client.once("ready", function () {
				client.rename(oldPath, newPath, function (err) {
					logout(client);
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
						console.log(err);
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

	mkdir = function (server, path, cb) {
		
		if (server.protocol === "ftp") {
		
			client = new Client();
			client.once("error", function (err) {
				if (err) {
					logout(client);
					cb(err);
				}
			});
			client.once("ready", function () {
				client.mkdir(path, false, function (err) {
					logout(client);
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
						console.log(err);
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

	removeDirectory = function (serverSetting, remotePath, cb) {
		
		if (serverSetting.protocol === "ftp") {
			
			client = new Client();
			client.once("error", function (err) {
				if (err) {
					logout(client);
					cb(err);
				}
			});

			client.once("ready", function () {
				client.rmdir(remotePath, true, function (err) {
					logout(client);
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

	deleteFile = function (serverSetting, remotePath, cb) {
		client = new Client();
		client.once("error", function (err) {
			console.log("error", err);
			logout(client);
			if (err) {

				cb(err);
			}
		});
		client.once("ready", function () {
			client.delete(remotePath, function (err) {
				logout(client);
				if (err) {
					cb(err);
				} else {
					cb(null, true);
				}
			});
		});
		client.connect(serverSetting);
	};

	download = function (serverSetting, localPath, remotePath, cb) {
		
		if (serverSetting.protocol === "ftp") {
			client = new Client();
			client.once("error", function (err) {
				if (err) {
					logout(client);
					cb(err);
				}
			});
			client.once("ready", function () {
				client.get(remotePath, function (err, stream) {
					if (err) {
						cb(err);
						logout(client);
					} else {
						stream.pipe(fs.createWriteStream(localPath));
						stream.once("close", function () {
							client.end();
							logout(client);
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
	
	readLocalFile = function (path, cb) {
		fs.readFile(path, "utf8", function (err, text) {
			if (err) {
				cb(err);
			}
			cb(null, text);
		});
	};

	/**
	 * initialize
	 */
	init = function (domainManager, domainPath) {

		if (!domainManager.hasDomain("synapse")) {
			domainManager.registerDomain("synapse", {
				major: 0,
				minor: 1
			});
		}
		_domainManager = domainManager;

		/**
		 * register commands
		 */

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
		
		domainManager.registerCommand(
			"synapse",
			"ReadLocalFile",
			readLocalFile,
			true,
			"", [{
				name: "path",
				type: "string"
			}]
		);

		/**
		 * register events
		 */
//		
//		domainManager.registerEvent(
//			"synapse",
//			"Connected",
//			null
//		);
//		domainManager.registerEvent(
//			"synapse",
//			"Error",
//			null
//		);
	};

	exports.init = init;

}());
