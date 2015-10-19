

/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, white: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	// Modules >>
	var EditorManager 	= brackets.getModule("editor/EditorManager"),
			CommandManager 	= brackets.getModule("command/CommandManager"),
			Commands 				= brackets.getModule("command/Commands"),
			ProjectManager 	= brackets.getModule("project/ProjectManager"),
			DocumentManager = brackets.getModule("document/DocumentManager"),
			FileUtils 			= brackets.getModule("file/FileUtils"),
			ExtensionUtils 	= brackets.getModule("utils/ExtensionUtils"),
			FileSystem 			= brackets.getModule("filesystem/FileSystem"),
			PathManager 		= require("modules/PathManager"),
			FileTreeView 		= require("modules/FileTreeView"),
			Project 				= require("modules/Project"),
			RemoteManager 	= require("modules/RemoteManager"),
			Log 						= require("modules/Log");
	// <<
	
	// Vars & Functions >>
	var _attachEvent,
			_detachEvent;
	var init,
			openFile;
	var onProjectStateChanged,
			onSaved,
			onDirtyFlagChange,
			onBeforeProjectClose,
			onBeforeAppClose,
			_projectState = Project.CLOSE,
			_modulePath = FileUtils.getParentPath(ExtensionUtils.getModulePath(module));
	//<<
	
	onProjectStateChanged = function (e, obj) {
		
		_projectState = obj.state;
		if (obj.state === Project.OPEN) {
			_attachEvent();
		} else {
			_detachEvent();
		}
	};
	
	init = function () {
		var d = new $.Deferred();
		Project.on(Project.PROJECT_STATE_CHANGED, onProjectStateChanged);
		return d.resolve().promise();
	};
	openFile = function (localPath) {
		var deferred = new $.Deferred();
		if (!EditorManager.canOpenPath(localPath)) {
			Log.q("Could not open the path (" + localPath + ")", true);
			return;
		}
		CommandManager.execute(Commands.CMD_ADD_TO_WORKINGSET_AND_OPEN, {fullPath: localPath, silent: true})
		.then(deferred.resolve, deferred.reject);
		return deferred.promise();
	};
	/* Private Methods */
	_attachEvent = function attachEvent() {
		ProjectManager.on("beforeAppClose", onBeforeAppClose);
		DocumentManager.on("dirtyFlagChange", onDirtyFlagChange);
		DocumentManager.on("documentSaved", onSaved);
	};
	_detachEvent = function () {
		ProjectManager.off("beforeAppClose", onBeforeAppClose);
		DocumentManager.off("dirtyFlagChange", onDirtyFlagChange);
		DocumentManager.off("documentSaved", onSaved);
	};
	/* Handlers */
	onBeforeAppClose = function () {
		if (_projectState === Project.OPEN) {
			return Project.close();
		}
	};
	onDirtyFlagChange = function (evt, document) {
		if (_projectState === Project.OPEN) {
			if (document.isDirty && document.file.isFile) {
				var path = PathManager.getLocalRelativePath(document.file.fullPath);
				// Do nothing yet, todo: append change to ui function.
			}
		}
	};
	onSaved = function (e, document) {
		if (_projectState === Project.CLOSE) {
			return;
		}
		
		var	projectRootDir 	= ProjectManager.getProjectRoot(),
				localPath 			= FileUtils.getRelativeFilename(projectRootDir.fullPath, document.file.fullPath),
				entity 					= FileTreeView.getEntityWithPath(localPath),
				pathAry 				= FileTreeView.getPathArray(entity);
		
		localPath = PathManager.completionLocalPath(pathAry);
		var remotePath = PathManager.completionRemotePath(Project.getServerSetting(), pathAry);
		
		RemoteManager.uploadFile(Project.getServerSetting(), localPath, remotePath)
		.then(function () {
			// TODO onsaved complete.
		},
		function (err) {
			var ent = FileTreeView.getEntityWithPath(localPath);
			ent.downloaded = false;
		});
	};
	
	exports.init = init;
	exports.openFile = openFile;
	exports.getModuleName = function () {
		return module.id;
	};
});
