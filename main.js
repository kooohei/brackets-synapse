/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50*/
/*global define, location, $, brackets, Mustache, window, appshell*/
define(function (require, exports, module) {
	"use strict";
	
	
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
			AppInit = brackets.getModule("utils/AppInit"),
			NodeDomain = brackets.getModule("utils/NodeDomain"),
			CommandManager = brackets.getModule("command/CommandManager"),
			PathManager = require("modules/PathManager"),
			ExtensionDiagnosis = require("modules/ExtensionDiagnosis"),
			Menu = require("modules/Menu"),
			Panel = require("modules/Panel"),
			CryptoManager = require("modules/CryptoManager"),
			SettingManager = require("modules/SettingManager"),
			FileTreeView = require("modules/FileTreeView"),
			RemoteManager = require("modules/RemoteManager"),
			FileManager = require("modules/FileManager"),
			PreferenceManager = require("modules/PreferenceManager"),
			StateManager = require("modules/StateManager");
			
			
			
	var COMMAND_ID = "kohei.synapse.mainPanel";
	
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
		
		
		PreferenceManager.init(domain)
		.then(function (data) {
			return StateManager.appendDoneInitModule(PreferenceManager.getModuleName(), data);
		})
		.then(ExtensionDiagnosis.init)
		.then(function (data) {
			return StateManager.appendDoneInitModule(ExtensionDiagnosis.getModuleName(), data);
		})
		.then(setAppIcon)
		.then(Panel.init)
		.then(function (data) {
			return StateManager.appendDoneInitModule(Panel.getModuleName(), data);
		})
		.then(PathManager.init)
		.then(function (data) {
			return StateManager.appendDoneInitModule(PathManager.getModuleName(), data);
		})
		.then(SettingManager.init)
		.then(function (data) {
			return StateManager.appendDoneInitModule(SettingManager.getModuleName(), data);
		})
		.then(RemoteManager.init)
		.then(function (data) {
			return StateManager.appendDoneInitModule(RemoteManager.getModuleName(), data);
		})
		.then(FileTreeView.init)
		.then(function (data) {
			return StateManager.appendDoneInitModule(FileTreeView.getModuleName(), data);
		})
		.then(FileManager.init)
		.then(function (data) {
			return StateManager.appendDoneInitModule(FileManager.getModuleName(), data);
		})
		.then(Menu.setRootMenu)
		.then(function (data) {
			return StateManager.appendDoneInitModule(Menu.getModuleName(), data);
		})
		.fail(function (err) {
			console.error(err);
			throw new Error(["Could not initialize to Synapse", err]);
		});
	});
});