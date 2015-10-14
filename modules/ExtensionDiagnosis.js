/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	
	// Modules >>
	var FileSystem 				= brackets.getModule("filesystem/FileSystem"),
			FileUtils 				= brackets.getModule("file/FileUtils"),
			Directory 				= brackets.getModule("filesystem/Directory"),
			ExtensionUtils 		= brackets.getModule("utils/ExtensionUtils"),
			Async 						= brackets.getModule("utils/Async");
	
	var DialogCollection 	= require("modules/DialogCollection"),
			PreferenceManager = require("modules/PreferenceManager"),
			Utils 						= require("modules/Utils"),
			Log 							= require("modules/Log");
	
	var PATH_TO_PACKAGE_JSON = FileUtils.getParentPath(ExtensionUtils.getModulePath(module)) + "package.json";
	var _getVersionFromPackageJson,
			_firstLaunch,
			_chkErrorLog,
			_checkKeysDirectory,
			_getDirectoryContents;
	var init;
	var onClickSecureWarning;
	// <<

	
	/**
	 * Return a string version number from the extension's package.json.
	 * (Real version)
	 * 
	 * @Return {$.Promise} a promise that will be resolved with the version number, and that never rejected.
	 */
	_getVersionFromPackageJson = function () {
		var d							= new $.Deferred(),
				file = FileSystem.getFileForPath(PATH_TO_PACKAGE_JSON);

		FileUtils.readAsText(file)
		.then(function (text, time) {
			var version = JSON.parse(text).version;
			d.resolve(version);
		}, function (err) {
			err =  new Error({message: "Failed to read version number from package.json.", err: err});
			console.log("SYNAPSE ERROR", err);
			d.reject(err);
		});
		return d.promise();
	};

	
	/**
	 * Invoke other function for check to environment for this extension at first launch,
	 * after Synapse  will be updated or installed.
	 * 
	 * @Return {$.Promise} a promise never rejected.
	 */
	_firstLaunch = function () {
		if (PreferenceManager.getVersion() !== _getVersionFromPackageJson()) {
			return _checkKeysDirectory();
		} else {
			return new $.Deferred().resolve().promise();
		}
	};

	/**
	 * Get child contents in the directory
	 * 
	 * @Return {$.Promise} a promise will be resolved with the contents, or rejected if the directory contents fails to load.
	 */
	_getDirectoryContents = function (dir) {
		var d = $.Deferred();
		dir.getContents(function (err, contents, stats, statsErrors) {
			if (err) {
				err = new Error({message: "SYNAPSE Error: Failed to load contents", err: err});
				console.log(err);
				d.reject(err);
			} else {
				d.resolve(contents);
			}
		});
		return d.promise();
	};

	/**
	 * The function checked whether deprecated environment is exists or not.
	 * 
	 * @Return {$.Promise} a promise will be rejected if the could not remove deprecated environment or resolved if the process completed.
	 */
	_checkKeysDirectory = function () {
		var d = new $.Deferred();
		var path = FileUtils.getParentPath(ExtensionUtils.getModulePath(module)) + "__KEYS__";
		var keysdir = FileSystem.getDirectoryForPath(path);
		var message = "Please Re-set to the following account settings<hr>";
		keysdir.exists(function (err, exists) {
			if (err) {
				err = new Error({message: "SYNAPSE Error: Failed to execute FileEntity.exists.", err: err});
				console.log(err);
				d.reject(err);
			} else {
				if (exists) {
					_getDirectoryContents(keysdir)
					.then(function (contents) {
						if (contents.length) {

							contents.forEach(function (entry) {
								var tmp = entry.name.split("@"),
										host = tmp[0],
										user = tmp[1];
								message += "Host @ User : " + host + " @ " + user + "<br>";
							});

							keysdir.moveToTrash(function (err) {
								if (err) {
									err = new Error({message: "SYNAPSE: Failed to remove file for deprecated environment", err: err});
									console.log(err);
									d.reject(err);
								}
							});
							DialogCollection.showAlert("Alert", message);
						} else {
							keysdir.moveToTrash(function (err) {
								err = new Error({message: "SYNAPSE: Failed to remove file for deprecated environment", err: err});
								console.log(err);
								d.reject(err);
							});
						}
						d.resolve();
					}, function (err) {
						err = new Error({message: "Failed to get contents from __KEYS__ directory.", err: err});
						console.log(err);
						d.reject(err);
					});
				} else {
					d.resolve();
				}
			}
		});
		return d.promise();
	};
	
	/**
	 * The function checked whether file for the error log is exists or not.
	 * that will be create if the file is not exists.
	 * 
	 * @Return {$.Promise} a promise will be rejected if the file could not created, or resolved if the process completed
	 */
	_chkErrorLog = function () {
		var d = new $.Deferred();
		var file = FileSystem.getFileForPath(FileUtils.getParentPath(ExtensionUtils.getModulePath(module)) + "error.log");
		file.exists(function (err, isExists) {
			if (err) {
				err = new Error({message: "Failed to execute FileEntity.exists for error.log", err: err});
				console.log(err);
				d.reject(err);
			} else {
				if (!isExists) {
					FileUtils.writeText(file, "", true)
					.then(function () {
						d.resolve();
					}, function (err) {
						err = new Error({message: "SYNAPSE: Failed to create file for error log.", err: err});
						console.log(err);
						d.reject(err);
					});
				} else {
					d.resolve();
				}
			}
		});
		
		return d.promise();
	};

	/**
	 * Invoke function, which is divided into individual functions for initialization.
	 * 
	 * @Return {$.Promise} a promise will be rejected with the error object, or resolved if the all processes completed.
	 */
	init = function () {
		var d = new $.Deferred();
		_firstLaunch()
		.then(_chkErrorLog)
		.then(_getVersionFromPackageJson)
		.then(PreferenceManager.setVersion)
		.then(function () {
			d.resolve();
		})
		.fail(function (err) {
			d.reject(err);
		});
		return d.promise();
	};

	exports.init = init;
	
});
