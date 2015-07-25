/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	"use strict";

	/* region Modules				 	*/
	var FileUtils = brackets.getModule("file/FileUtils");
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var Async = brackets.getModule("utils/Async");
	var _ = brackets.getModule("thirdparty/lodash");
	/* endregion */
	/* region Private vars 		*/
	var
		_modulePath = FileUtils.getParentPath(ExtensionUtils.getModulePath(module)),
		_domain,
		_remoteRootPath;
	/* endregion */
	/* region Public vars 		*/
	var rootEntity,
			offset_left = 13; // font-size
	/* endregion */
	/* region Static vars 		*/
	var PROJECT_DIR = "PROJ";
	/* endregion */
	/* region Private methods */
	var
		_checkPrimitive,
		_getProjectDirectoryPath,
		_currentServerSetting,
		_setEntity,
		_remoteRootIsRelative,
		_setElement,
		_getPath,
		_attachEvent,
		_detachEvent,
		_getEntityWithId,
		_getElementWithEntity,
		_toggleDir;
	/* endregion */
	/* region Public methods 	*/
	var
		init,
		setEntities,
		open;
	/* endregion */
	/* region Listener 				*/
	var
		onClick,
		onDirClicked,
		onFileClicked;
	/* endregion */
	/* region jQuery element 	*/
	var jq = {
		get container() {
			return $("#synapse-tree");
		},
		get tv() {
			return $("#synapse-tree > ul");
		}
	};
	/* endregion */
	/* region Icon set Object */
	var Icon = {
		file: "fa fa-file-o",
		folder: "fa fa-folder",
		folder_open: "fa fa-folder-open",
		folder_disable: "fa fa-folder-o"
	};
	/* endregion */
	/* region Entity Object  	*/
	var Entity = function (param) {
		if (param.class === undefined ||
			param.text === undefined ||
			param.parent === undefined) {
			throw new Error("Invalid parameters.");
		}
		this.class = param.class;
		this.type = param.type;
		this.text = param.text;
		this.mode = param.mode || null;
		this.size = param.size || 0;
		this.date = param.date;
		this.parent = param.parent;
		this.opt = param.opt || {};
		this.depth = param.depth;
		this.index = param.index;
		this.id = param.id;
		this.children = {};
	};
	/* endregion */
	
	
	

	init = function (serverSetting) {
		_currentServerSetting = serverSetting;
		_remoteRootPath = _currentServerSetting.dir;
		_remoteRootIsRelative();

		_detachEvent();
		
		jq.tv.remove();
		var param = {
			class: "treeview-root",
			type: "directory",
			text: _currentServerSetting.host + "@" + _currentServerSetting.user,
			opt: {},
			parent: null,
			children: [],
			depth: 0,
			index: 0,
			id: "0"
		};
		
		_setEntity(param, 0)
			.then(function (entity) {
				rootEntity = entity;
				_setElement(null);
			});
		
		_attachEvent();
		
		return rootEntity;
	};

	setEntities = function (list, parent) {
		if (parent.type !== "directory") {
			throw new Error("the type property of the parent object must set directory");
		}
		var deferred = new $.Deferred();
		var promises = [];
		var params = [];

		var depth = parent.depth + 1;
		list.forEach(function (item, index) {
			var type = (item.type === "d") ? "directory" : "file";
			var param = {
				class: "treeview-" + type,
				type: type,
				text: item.name,
				size: item.size,
				mode: item.rights.user,
				date: item.date,
				depth: depth,
				index: index,
				id: parent.id + "-" + index,
				parent: parent
			};
			promises.push(_setEntity(param, index));
		});

		Async.waitForAll(promises, false, 5000)
			.then(function () {
				_setElement(parent)
				.then(function (state) {
					deferred.resolve(state);
					_toggleDir("close", parent, _getElementWithEntity(parent));
				});
				
			}, deferred.reject);
		return deferred.promise();
	};
	
	/**
	 * this function will called by setEntities.
	 * you must use setEntities with [param] instead of this function.
	 * @param   {Object}   param  parameter for constructor of Entity object
	 * @param   {Object}   parent parent entity object.
	 * @returns {$.Promise} the promise. that will be resolved with entity object, whenever
	 */
	_setEntity = function (param) {
		var deferred = new $.Deferred();
		var entity = new Entity(param);
		
//		var $elem = $("<li/>").addClass("treeview-entity").addClass(param.class).attr({"id": "tv-" + entity.id});
//		var $p = $("<p/>").addClass("treeview-row");
//		var $text = $("<span/>").addClass("filename").html(param.text);
//		var $icon = $("<i/>");
//
//		if (param.type === "directory") {
//			$elem.addClass("treeview-close");
//			$icon.addClass(Icon.folder);
//		} else {
//			$icon.addClass(Icon.file);
//		}
//		$p.append($icon);
//		$p.append($text);
//		$elem.append($p);
		// should be set to exeAuth property when ready build path function
		if (entity.parent !== null) {
			entity.parent.children[entity.index] = entity;
		}
		return deferred.resolve(entity).promise();
	};
	
	_attachEvent = function () {
		jq.container.on("click", onClick);
	};
	
	_detachEvent = function () {
		jq.container.off("click", onClick);
	};
	
	onClick = function (e) {
		var $elem = $(e.target);
		/**
		 * Directory Clicked
		 */
		if ($elem.hasClass("treeview-contents") || $elem.hasClass("filename") || $elem.hasClass("fa")) {
			$elem = $elem.parent().parent();
		} else if ($elem.hasClass("treeview-row")) {
			$elem = $elem.parent();
		}
		if ($elem.hasClass("treeview-directory") || $elem.hasClass("treeview-root")) {
			onDirClicked($elem);
		}
		if ($elem.hasClass("treeview-file")) {
			onFileClicked($elem);
		}
	};
	
	onDirClicked = function ($elem) {
		var id = $elem.attr("id");
		var entity = _getEntityWithId(id);
		if ($elem.hasClass("treeview-close")) {
				_toggleDir("close", entity, $elem);
		} else if ($elem.hasClass("treeview-open")) {
				_toggleDir("open", entity, $elem);
		}
	};
	
	onFileClicked = function ($elem) {

	};
	
	_getElementWithEntity = function (entity) {
		return $("#tv-" + entity.id, jq.container);
	};
	 
	_remoteRootIsRelative = function () {
		return _remoteRootPath.charAt(0) !== "/";
	};
	
	_checkPrimitive = function (param) {
		var toStr = Object.prototype.toString;
		var res = toStr.call(param);
		return res.replace(/\[|\]/g, "").split(" ")[1];
	};
	
	_getProjectDirectoryPath = function () {
		return _modulePath + PROJECT_DIR;
	};
	
	_getPath = function (entity) {
		var target = entity;
		var entities = [];
		entities.push(target.text);
		while (target.parent !== null) {
			entities.unshift(target.text);
			target = target.parent;
		}
		return entities.join("/");
	};
	
	_getEntityWithId = function (id) {
		if (id === "tv-0") {
			return rootEntity;
		}
		var index = id.split("-");
		if (index[0] === "tv") {
			index = index.slice(1);
		}
		index = index.slice(1);
		var depth = index.length;
		var children = rootEntity.children;
		var i = 0;
		var entity = null;
		for (; i < depth; i++) {
			entity = children[index[i]];
			if (entity.children.length) {
				children = entity.children;
			}
		}
		return entity;
	};
	
	_setElement = function (entity) {
		var deferred = new $.Deferred();
		var $elem = null;
		var $ul = $("<ul/>").addClass("treeview-contents");
		
		if (entity === null) {
			$elem = $("#synapse-tree");
			$elem.html($ul);
		} else {
			$elem = $("#tv-" + entity.id);
			$elem.append($ul);
		}
		if ($elem === null || $elem === undefined) {
			throw new Error("Unexpected Exception. could not specified element");
		}
		
		function makeElem(ent, $ul) {
			var $li = $("<li/>").addClass("treeview-entity").addClass(ent.class).attr({"id": "tv-" + ent.id});
			var $p = $("<p/>").addClass("treeview-row");
			var $text = $("<span/>").addClass("filename").html(ent.text);
			var $icon = $("<i/>");
			if (ent.type === "directory") {
				if (entity === null) {
					$ul.css({"display": "block"});
					$li.addClass("treeview-open");
					$icon.addClass(Icon.folder_open);
				} else {
					$li.addClass("treeview-close");
					$icon.addClass(Icon.folder);
				}
			} else {
				$icon.addClass(Icon.file);
			}
			$p.append($icon);
			$p.append($text);
			$li.append($p);
			$ul.append($li);
			var paddingLeft = (offset_left * ent.depth);
			$("p.treeview-row", $li).css({
				"padding-left": paddingLeft + "px",
			});
		}
		if (entity !== null) {
			_.forIn(entity.children, function (val, key) {
				var ent = entity.children[key];
				makeElem(ent, $ul);
			});
			deferred.resolve("children");
		} else {
			makeElem(rootEntity, $ul);
			deferred.resolve("root");
		}
		return deferred.promise();
	};
	
	_toggleDir = function (state, entity, $jqElem) {
		
		var $icon = $("#tv-" + entity.id + " > p.treeview-row > i.fa");
		if (state === "close") {
			$icon.addClass("fa-folder-open");
			$icon.removeClass("fa-folder");
			$jqElem.removeClass("treeview-close");
			$jqElem.addClass("treeview-open");
			
		} else {
			$icon.removeClass("fa-folder-open");
			$icon.addClass("fa-folder");
			$jqElem.addClass("treeview-close");
			$jqElem.removeClass("treeview-open");
		}
		var $ul = $("#tv-" + entity.id + " > ul.treeview-contents");
		$ul.animate({"height": "toggle"}, "fast", function () {
			if (state === "close") {
				
			} else {
				
			}
		});
	};

	exports.init = init;
	exports.setEntities = setEntities;
	exports.rootEntity = rootEntity;
	exports.open = open;
});
