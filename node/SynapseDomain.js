/*jslint node: true, vars: true, plusplus: true, white: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, brackets: true, $, window, navigator, Mustache, jQuery, console, moment */
(function () {
	"use strict";

	/**
	 * App path policy
	 * 
	 * all paths tailling slash is invalid, if path started character is "." then that is relative path.
	 * however that character is "/" then this is absolute path.
	 */
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
			logout;


	connect = function (server, remoteRoot, cb) {
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
				
			});
		});
		client.connect(server);
	};

	getList = function (server, path, cb) {
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
	};

	rename = function (server, oldPath, newPath, cb) {
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
					var res = true;
					cb(null, res);
				}
				
			});
		});
		client.connect(server);
	};

	mkdir = function (server, path, cb) {
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
					var res = true;
					cb(null, res);
				}
			});
		});
		client.connect(server);
	};

	removeDirectory = function (serverSetting, remotePath, cb) {
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
					stream.once("close", function () {
						client.end();
						logout(client);
						cb(null, true);
					});
					stream.pipe(fs.createWriteStream(localPath));
				}
				
			});
		});
		client.connect(serverSetting);
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
		
		/**
		 * register events
		 */
		domainManager.registerEvent(
			"synapse",
			"Connected",
			null
		);
		domainManager.registerEvent(
			"synapse",
			"Error",
			null
		);
	};

	exports.init = init;

}());
