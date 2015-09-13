/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50*/
/*global define, $, brackets, Mustache, window, appshell*/
define(function (require, exports, module) {
	"use strict";
	
	var VERSION = "1.1.1";
	
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
			AppInit = brackets.getModule("utils/AppInit"),
			NodeDomain = brackets.getModule("utils/NodeDomain"),
			CommandManager = brackets.getModule("command/CommandManager"),
			
			PathManager = require("modules/PathManager"),
			ExtensionDiagnosis = require("modules/ExtensionDiagnosis"),
			Menu = require("modules/Menu"),
			Panel = require("modules/Panel"),
			SettingManager = require("modules/SettingManager"),
			FileTreeView = require("modules/FileTreeView"),
			RemoteManager = require("modules/RemoteManager"),
			FileManager = require("modules/FileManager"),
			COMMAND_ID = "kohei.synapse.mainPanel";
	
	var _domain = null;
			
	var $brackets = {
				get toolbar() {
					return $("#main-toolbar .buttons");
				},
				get projectFilesContainer() {
					return $("#project-files-container");
				},
				get sidebar() {
					return $("#sidebar");
				}
			};
	
	
	var setAppIcon = function () {
		var d = new $.Deferred(),
				icon = $("<a>")
				.attr({
					id:"synapse-icon",
					"href": "#", 
					"title": "Synapse"
				})
				.addClass("diabled")
				.on("click", Menu.showMainPanel)
				.appendTo($brackets.toolbar);
		return d.resolve(_domain).promise();
	};
	
	
	
	AppInit.appReady(function () {
		var domain = new NodeDomain("synapse", ExtensionUtils.getModulePath(module, "node/SynapseDomain"));
		_domain = domain;
		
		ExtensionDiagnosis.start(_domain)
		.then(setAppIcon)
		.then(Panel.init)
		.then(PathManager.init)
		.then(SettingManager.init)
		.then(RemoteManager.init)
		.then(FileTreeView.init)
		.then(FileManager.init)
		.then(Menu.setRootMenu)
		.fail(function (err) {
			console.error(err);
			throw new Error(["Could not initialize to Synapse", err]);
		});
	});
});