/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	
	// modules
	var PathManager = require("modules/PathManager");
	var FileTreeView = require("modules/FileTreeView");
	var Panel = require("modules/Panel");
	var Project = require("modules/Project");
	
	
	// private vars
	var _domain,
			_currentServerSetting;
	
	// public methods
	var init,
			clear,
			connect;
	
	// event handler
	var _onProjectModeChanged;
	
	
	var jq = {
		tv : $("#synapse-tree")
	};
	
	init = function (domain) {
		_domain = domain;
		clear();
		return new $.Deferred().resolve().promise();
	};
	
	clear = function () {
		jq.tv.html("");
	};
	
	connect = function (serverSetting) {
		var deferred =  new $.Deferred();
		PathManager.setRemoteRoot(serverSetting.dir);
		var _rootEntity = FileTreeView.init(serverSetting);
		
		
		Panel.showSpinner();
		var remoteRoot = PathManager.getRemoteRoot();
		_domain.exec("Connect", serverSetting, remoteRoot)
		.then(function (list) {
			return FileTreeView.setEntities(list, _rootEntity);
		})
		.then(function () {
//			try {
//				Project.open(_currentServerSetting)
//				.then(function () {
//					_currentServerSetting = serverSetting;
//				})
//				.always(function () {
//					Project.on(Project.MODE_CHANGED, _onProjectModeChanged);
//				});
//			} catch (e) {
//				throw e;
//			}
		}, function (err) {
			throw new Error(err);
		})
		.always(function () {
			Panel.hideSpinner();
		});
		
	};
	
	exports.init = init;
	exports.connect = connect;
});