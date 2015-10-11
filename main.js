/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50*/
/*global define, location, $, brackets, Mustache, window, appshell*/
define(function (require, exports, module) {
	"use strict";

	// External modules >>
	var ExtensionUtils			= brackets.getModule("utils/ExtensionUtils"),
			AppInit							= brackets.getModule("utils/AppInit"),
			NodeDomain					= brackets.getModule("utils/NodeDomain"),
			FileSystem					= brackets.getModule("filesystem/FileSystem"),
			FileUtils						= brackets.getModule("file/FileUtils"),
			CommandManager			= brackets.getModule("command/CommandManager"),
			Async								= brackets.getModule("utils/Async"),
			PathManager					= require("modules/PathManager"),
			ExtensionDiagnosis	= require("modules/ExtensionDiagnosis"),
			Menu								= require("modules/Menu"),
			Panel								= require("modules/Panel"),
			CryptoManager				= require("modules/CryptoManager"),
			SettingManager			= require("modules/SettingManager"),
			FileTreeView				= require("modules/FileTreeView"),
			RemoteManager				= require("modules/RemoteManager"),
			FileManager					= require("modules/FileManager"),
			PreferenceManager		= require("modules/PreferenceManager"),
			Notify							= require("modules/Notify"),
			Log									= require("modules/Log"),
			Utils								= require("modules/Utils"),
			Shared							= require("modules/Shared");
	// <<
	
	var COMMAND_ID = "kohei.synapse.mainPanel";
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
		return d.resolve().promise();
	};
	AppInit.appReady(function () {
		Shared.domain = new NodeDomain("synapse", ExtensionUtils.getModulePath(module, "node/SynapseDomain"));
		
		var promises = [];
		var p;
		PreferenceManager.init()
		.then(function () {

			p = ExtensionDiagnosis.init();
			promises.push(p);

			p = SettingManager.init();
			promises.push(p);

			p = Panel.init();
			promises.push(p);
			
			p = Notify.init();
			promises.push(p);

			p = PathManager.init();
			promises.push(p);

			p = RemoteManager.init();
			promises.push(p);

			p = FileTreeView.init();
			promises.push(p);

			p = FileManager.init();
			promises.push(p);

			p = setAppIcon();
			promises.push(p);

			p = Menu.setRootMenu();
			promises.push(p);

			Async.waitForAll(promises, true)
			.then(function () {
				Log.q("Initialized completed successfully.");
			}, function (err) {
				throw new Error({message: "Initialized failed", error: err});
			});
		}, function (err) {
			console.error("Initialize PreferenceManager module failed.");
		});
	});
});
