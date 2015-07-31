/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	"use strict";
	
	var EditorManager = brackets.getModule("editor/EditorManager");
	var DocumentManager = brackets.getModule("document/DocumentManager");
	var MainViewManager = brackets.getModule("view/MainViewManager");
	
	var openFile;
	
	
	
	openFile = function (localPath) {
		var deferred = new $.Deferred();
		if (!EditorManager.canOpenPath(localPath)) {
			console.log("could not open this file for path");
			return;
		}
		console.log("openFile");
		DocumentManager.getDocumentForPath(localPath)
		.then(function (document) {
			console.log(document);
			if (EditorManager.openDocument(document, MainViewManager.ACTIVE_PANE)) {
				deferred.resolve(true);
			} else {
				console.error("EdirotManager.openDocument failed");
				deferred.reject();
			}
		}, function (err) {
			console.log(err);
		});
		
		return deferred.promise();
	};
	
	
	
	exports.openFile = openFile;
	
	
});