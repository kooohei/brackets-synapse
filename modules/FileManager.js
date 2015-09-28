/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, white: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	/* region Modules */
	var EditorManager = brackets.getModule("editor/EditorManager");
	var CommandManager = brackets.getModule("command/CommandManager");
	var Commands = brackets.getModule("command/Commands");
	var ProjectManager = brackets.getModule("project/ProjectManager");
	var DocumentManager = brackets.getModule("document/DocumentManager");
	var FileUtils = brackets.getModule("file/FileUtils");
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var FileSystem = brackets.getModule("filesystem/FileSystem");
	var PathManager = require("modules/PathManager");
	var FileTreeView = require("modules/FileTreeView");
	var Project = require("modules/Project");
	var RemoteManager = require("modules/RemoteManager");
	/* endregion */

	
	/* region Private Methods */
	var _attachEvent;
	/* endregion */
	
	/* region Public Methods */
	var init,
			openFile;
	/* endregion */

	/* region Handlers */
	var onSaved;
	var onDirtyFlagChange;
	var onBeforeProjectClose;
	var onBeforeAppClose;
	/* endregion */

	/* region Private vars and methods */
	var _domain = null;
	var _projectState = Project.CLOSE;
	var _modulePath = FileUtils.getParentPath(ExtensionUtils.getModulePath(module));
	/* endregion */
	
	init = function (domain) {
		var d = new $.Deferred();
		_domain = domain;
		_attachEvent();
		return d.resolve().promise();
	};

	openFile = function (localPath) {
		var deferred = new $.Deferred();
		if (!EditorManager.canOpenPath(localPath)) {
			console.error("error");
			return;
		}
		CommandManager.execute(Commands.CMD_ADD_TO_WORKINGSET_AND_OPEN, {fullPath: localPath})
		.then(deferred.resolve, deferred.reject);
		return deferred.promise();
	};

	/* Private Methods */
	_attachEvent = function attachEvent() {
		Project.on(Project.PROJECT_STATE_CHANGED, function (evt, obj) {
			_projectState = obj.state;
			ProjectManager.on("beforeAppClose", onBeforeAppClose);
			DocumentManager.on("dirtyFlagChange", onDirtyFlagChange);
			DocumentManager.on("documentSaved", onSaved);
		});
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
			}
		}
	};

	onSaved = function (e, document) {
		if (_projectState === Project.CLOSE) {
			return;
		}
		var localPath = document.file.fullPath;
		var remotePath = PathManager.getLocalRelativePath(localPath);
		
		RemoteManager.uploadFile(Project.getServerSetting(), localPath, remotePath)
		.then(function () {
			
		},
		function (err) {
			var ent = FileTreeView.getEntityWithPath(remotePath);
			ent.downloaded = false;
			FileTreeView.showAlert("ERROR", "Could not save file to server <br>" + err);
			throw new Error("Could not save file to server<br>" + err);
		});
	};

	
	
	exports.init = init;
	exports.openFile = openFile;
	exports.getModuleName = function () {
		return module.id;
	};
});
