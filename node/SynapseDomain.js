/*jslint node: true, vars: true, plusplus: true, white: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
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
	var _domainManager = null;
	var client = null,
		init,
		connect,
		getList,
		rename,
		mkdir,
		removeDirectory,
		logout;
	
	connect = function (server, remoteRoot, cb) {
		client = new Client();
		client.on("ready", function () {
			client.list(remoteRoot, function (err, list) {
				if (err) {
					cb(err);
				} else {
					cb(null, list);
				}
				logout(client);
			});
		});
		client.connect(server);
	};
	
	logout = function (client) {
		client.on("close", function () {
		});
		client.on("end", function () {
		});

		client.logout(function (err, res) {
			if (err) {
				console.log("unexpected error lv.666");
			} else {
				console.log(res);
			}
		});
	};
	
	getList = function (server, path, cb) {
		client = new Client();
		client.on("ready", function () {
			client.list(path, function (err, list) {
				if (err) {
					cb(err);
				} else {
					cb(null, list);
				}
				logout(client);
			});
		});
		client.connect(server);
	};
	
	rename = function (server, oldPath, newPath, cb) {
		
		client = new Client();
		client.on("ready", function () {
			client.rename(oldPath , newPath , function (err) {
				if (err) {
					cb(err);
				} else {
					var res = true;
					cb(null, res);
				}
				logout(client);
			});
		});
		client.connect(server);
	};
	
	
	mkdir = function (server, path, cb) {
		
		client = new Client();
		client.on("ready", function () {
			
			
			client.mkdir(path, false, function (err) {
				
				if (err) {
					cb(err);
				} else {
					var res = true;
					cb(null, res);
				}
				logout(client);
			});
			
		});
		client.connect(server);
	};
	
	removeDirectory = function (server, path, cb) {
		
		client = new Client();
		client.on("ready", function () {
			client.rmdir(path, true, function (err) {
				if (err) {
					cb(err);
				} else {
					cb(null, true);
				}
				logout(client);
			});
		});
		client.connect(server);
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
			"",
			[{
				name: "server",
				type: "object"
			}, {
				name: "remoteRoot",
				type: "string"
			}],
			[{
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
				name: "server",
				type: "object"
			}, {
				name: "path",
				type: "string"
			}],
			[{
				name: "list",
				type: "object"
			}]
		);
		
		domainManager.registerCommand(
			"synapse",
			"Rename",
			rename,
			true,
			"",
			[{
				name: "server",
				type: "object"
			}, {
				name: "oldPath",
				type: "string"
			}, {
				name: "newPath",
				type: "string"
			}],
			[{
				name: "res",
				type: "boolean"
			}]
		);
		
		domainManager.registerCommand(
			"synapse",
			"Mkdir",
			mkdir,
			true,
			"",
			[{
				name: "server",
				type: "object"
			}, {
				name: "path",
				type: "string"
			}],
			[{
				name: "res",
				type: "boolean"
			}]
		);
		
		domainManager.registerCommand(
			"synapse",
			"RemoveDirectory",
			removeDirectory,
			true,
			"",
			[{
				name: "server",
				type: "object",
			}, {
				name: "path",
				type: "string"
			}],
			[{
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