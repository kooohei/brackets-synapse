/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50*/
/*global define, $, brackets, Mustache, window, appshell*/
define(function (require, exports, module) {
	"use strict";
	
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var AppInit = brackets.getModule("utils/AppInit");
	var NodeDomain = brackets.getModule("utils/NodeDomain");
	var CommandManager = brackets.getModule("command/CommandManager");
	var PathManager = require("modules/PathManager");
	var Menu = require("modules/Menu");
	var Panel = require("modules/Panel");
	var SettingManager = require("modules/SettingManager");
	var FileTreeView = require("modules/FileTreeView");
	var RemoteManager = require("modules/RemoteManager");
	var FileManager = require("modules/FileManager");
	var $icon = null;
	var COMMAND_ID = "kohei.synapse.mainPanel";
	
	
	AppInit.appReady(function () {
		var domain = new NodeDomain("synapse", ExtensionUtils.getModulePath(module, "node/SynapseDomain"));
		
		$icon = $("<a/>")
			.attr("id", "synapse-icon")
			.attr("href", "#")
			.attr("title", "Synapse")
			.addClass("disabled")
			.on("click", function () {
				CommandManager.execute(COMMAND_ID);
			})
			.appendTo($("#main-toolbar .buttons"));
		
		Panel.init(domain)
		.then(PathManager.init)
		.then(SettingManager.init)
		.then(RemoteManager.init)
		.then(FileTreeView.init)
		.then(FileManager.init)
		.then(function () {
			Menu.setRootMenu();
		}, function (err) {
			throw new Error("Could not initialize to Synapse main panel");
		});
	});
});