/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50*/
/*global define, $, brackets, Mustache, window, appshell*/
define(function (require, exports, module) {
	"use strict";
	
	
	// HEADER >>
	var NodeConnection 			= brackets.getModule("utils/NodeConnection"),
			Menus 							= brackets.getModule("command/Menus"),
			CommandManager 			= brackets.getModule("command/CommandManager"),
			Commands 						= brackets.getModule("command/Commands"),
			PreferencesManager 	= brackets.getModule("preferences/PreferencesManager"),
			_										= brackets.getModule("thirdparty/lodash"),
			KeyBindingManager 	= brackets.getModule("command/KeyBindingManager");
	
	var ExtensionDiagnosis 	= require("modules/ExtensionDiagnosis"),
			Log 								= require("modules/Log"),
			Panel 							= require("modules/Panel"),
			FileTreeView 				= require("modules/FileTreeView"),
			Strings 						= require("strings");
	
	var treeViewContextMenu = null;
	var _nodeConnection 		= null;

	var showMainPanel,
			initTreeViewContextMenu,
			setRootMenu,
			setDebugMenu,
			reloadBrackets,
			treeViewContextMenuState;
	
	var _disableTreeViewContextMenuAllItem;
	
	//<<
	
	var ContextMenuIds 				= {
			TREEVIEW_CTX_MENU: "kohei-synapse-treeview-context-menu"
	};
	var ContextMenuCommandIds = {
			SYNAPSE_FILE_NEW: "kohei.synapse.file_new",
			SYNAPSE_DIRECTORY_NEW: "kohei.synapse.directory_new",
			SYNAPSE_FILE_REFRESH: "kohei.synapse.file_refresh",
			SYNAPSE_FILE_RENAME: "kohei.synapse.file_rename",
			SYNAPSE_DELETE: "kohei.synapse.delete"
	};
	var MenuText 							= {
			SYNAPSE_CTX_FILE_NEW: Strings.SYNAPSE_CTX_FILE_NEW,
			SYNAPSE_CTX_DIRECTORY_NEW: Strings.SYNAPSE_CTX_DIRECTORY_NEW,
			SYNAPSE_CTX_FILE_REFRESH: Strings.SYNAPSE_CTX_FILE_REFRESH,
			SYNAPSE_CTX_FILE_RENAME: Strings.SYNAPSE_CTX_FILE_RENAME,
			SYNAPSE_CTX_DELETE: Strings.SYNAPSE_CTX_DELETE
	};
	
	var Open_TreeView_Context_Menu_On_Directory_State = [
				ContextMenuCommandIds.SYNAPSE_FILE_NEW,
				ContextMenuCommandIds.SYNAPSE_DIRECTORY_NEW,
				ContextMenuCommandIds.SYNAPSE_DELETE,
				ContextMenuCommandIds.SYNAPSE_FILE_REFRESH,
				ContextMenuCommandIds.SYNAPSE_FILE_RENAME
			];
	var Open_TreeView_Context_Menu_On_Linked_Directory_State = [
				ContextMenuCommandIds.SYNAPSE_FILE_NEW,
				ContextMenuCommandIds.SYNAPSE_DIRECTORY_NEW,
				ContextMenuCommandIds.SYNAPSE_DELETE,
				ContextMenuCommandIds.SYNAPSE_FILE_REFRESH
			];
	var Open_TreeView_Context_Menu_On_File_State = [
				ContextMenuCommandIds.SYNAPSE_FILE_RENAME,
				ContextMenuCommandIds.SYNAPSE_DELETE
			];
	var Open_TreeView_Context_Menu_On_Linked_File_State = [
				ContextMenuCommandIds.SYNAPSE_FILE_RENAME,
				ContextMenuCommandIds.SYNAPSE_DELETE
			];
	var Open_TreeView_Context_Menu_On_Root_State = [
				ContextMenuCommandIds.SYNAPSE_FILE_NEW,
				ContextMenuCommandIds.SYNAPSE_DIRECTORY_NEW,
				ContextMenuCommandIds.SYNAPSE_FILE_REFRESH
			];
	
	showMainPanel 	= function () {
		CommandManager.execute("kohei.synapse.mainPanel");
	};
	
	treeViewContextMenuState = function (entity) {
		_disableTreeViewContextMenuAllItem();

		if (entity.class === "treeview-root") {
			Open_TreeView_Context_Menu_On_Root_State.forEach(function (id) {
				CommandManager.get(id).setEnabled(true);
			});
			return;
		}
		if (entity.class === "treeview-directory") {
			Open_TreeView_Context_Menu_On_Directory_State.forEach(function (id) {
				CommandManager.get(id).setEnabled(true);
			});
			return;
		} else
		if (entity.class === "treeview-ldirectory") {
			Open_TreeView_Context_Menu_On_Linked_Directory_State.forEach(function (id) {
				CommandManager.get(id).setEnabled(true);
			});
			return;
			
		} else
		if (entity.class === "treeview-file") {
			Open_TreeView_Context_Menu_On_File_State.forEach(function (id) {
				CommandManager.get(id).setEnabled(true);
			});
			return;
		}
	};
	
	setRootMenu 		= function (domain) {
		var menu = CommandManager.register(
			"Synapse",
			"kohei.synapse.mainPanel",
			Panel.showMain);
		var topMenu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
		topMenu.addMenuDivider();
		topMenu.addMenuItem(menu, {
			key: "Ctrl-Shift-Alt-Enter",
			displayKey: "Ctrl-Shift-Alt-Enter"
		});
		//For Debug >
		//Panel.showMain();
		setDebugMenu();
		return new $.Deferred().resolve(domain).promise();
	};
	
	setDebugMenu 		= function () {
		var menu = CommandManager.register(
			"Reload App wiz Node",
			"kohei.syanpse.reloadBrackets",
			reloadBrackets);
		
		var topMenu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
		topMenu.addMenuDivider();
		topMenu.addMenuItem(menu, {
			key: "Ctrl-Shift-F6",
			displeyKey: "Ctrl-Shift-F6"
		});
	};
	
	reloadBrackets 	= function () {
		try {
			_nodeConnection.domains.base.restartNode();
			CommandManager.execute(Commands.APP_RELOAD);
		} catch (e) {
			console.log("SYNAPSE ERROR - Failed trying to restart Node", e);
		}
	};
	
	initTreeViewContextMenu = function () {
		var d = new $.Deferred();
		CommandManager
			.register(MenuText.SYNAPSE_CTX_FILE_REFRESH, 	ContextMenuCommandIds.SYNAPSE_FILE_REFRESH, 	FileTreeView.refresh);
		CommandManager
			.register(MenuText.SYNAPSE_CTX_FILE_RENAME, 	ContextMenuCommandIds.SYNAPSE_FILE_RENAME, 		FileTreeView.rename);
		CommandManager
			.register(MenuText.SYNAPSE_CTX_FILE_NEW, 			ContextMenuCommandIds.SYNAPSE_FILE_NEW, 			FileTreeView.newFile);
		CommandManager
			.register(MenuText.SYNAPSE_CTX_DIRECTORY_NEW, ContextMenuCommandIds.SYNAPSE_DIRECTORY_NEW, 	FileTreeView.newDirectory);
		CommandManager
			.register(MenuText.SYNAPSE_CTX_DELETE, 				ContextMenuCommandIds.SYNAPSE_DELETE, 				FileTreeView.removeFile);

		treeViewContextMenu = Menus.registerContextMenu(ContextMenuIds.TREEVIEW_CTX_MENU);
		
		treeViewContextMenu
			.addMenuItem(ContextMenuCommandIds.SYNAPSE_FILE_REFRESH);
		treeViewContextMenu
			.addMenuItem(ContextMenuCommandIds.SYNAPSE_FILE_RENAME, null, Menus.LAST, null);
		treeViewContextMenu
			.addMenuDivider();
		treeViewContextMenu
			.addMenuItem(ContextMenuCommandIds.SYNAPSE_FILE_NEW, null, Menus.LAST, null);
		treeViewContextMenu
			.addMenuItem(ContextMenuCommandIds.SYNAPSE_DIRECTORY_NEW, null, Menus.LAST, null);
		treeViewContextMenu
			.addMenuDivider();
		treeViewContextMenu
			.addMenuItem(ContextMenuCommandIds.SYNAPSE_DELETE, null, Menus.LAST, null);
		
		$("#synapse-treeview-container").contextmenu(function (e) {
			FileTreeView.onTreeViewContextMenu(e, treeViewContextMenu);
		});
		return d.resolve().promise();
	};
	
	/* Private Methods */
	_disableTreeViewContextMenuAllItem = function () {
		if (treeViewContextMenu === null) {
			return;
		}
		_.forIn(ContextMenuCommandIds, function (val, key) {
			CommandManager.get(val).setEnabled(false);
		});
	};
	
	/* for Debug */
	_nodeConnection = new NodeConnection();
	_nodeConnection.connect(true);
	
	exports.showMainPanel 						= showMainPanel;
	exports.setRootMenu 							= setRootMenu;
	exports.initTreeViewContextMenu 	= initTreeViewContextMenu;
	exports.ContextMenuCommandIds 		= ContextMenuCommandIds;
	exports.ContextMenuIds 						= ContextMenuIds;
	exports.treeViewContextMenuState	= treeViewContextMenuState;
	exports.getModuleName 						= function () {
		return module.id;
	};

});
