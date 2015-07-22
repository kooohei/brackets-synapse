/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, white: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, brackets: true, window, navigator, Mustache, jQuery, console, moment */
define(function (require, exports, module) {
	"use strict";
	
console.log(module);	
	/* jstree plugin need berow 2 lines and jquery.js must be there on root directory. */
	//var $ = jQuery.noConflict(true);
	var jstree = require("node_modules/jstree/dist/jstree.min");
	
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var FileUtils = brackets.getModule("file/FileUtils");
	var treeview = require("text!ui/treeview.html");
	var PathManager = require("modules/PathManager");
	var Strings = require("strings");
	var DialogCollection = require("modules/DialogCollection");
	var Project = require("modules/Project");
	var _ = brackets.getModule("lodash");
	var Menu = require("modules/Menu");
	var $treeview = null;
	var Panel = require("modules/Panel");
	var icon = {
		folder: "fa fa-folder",
		folder_open: "fa fa-folder-open",
		folder_disable: "fa fa-folder-o",
		file: "fa fa-file-o"
	};


	var _domain,
		currentServer = null;

	var init,
		clearCurrentTree,
		getTreeNodes,
		connect,
		createNode,
		setRootNodes,
		readDirectory,
		beforeTreeViewContextMenuOpen,
		openDir,
		removeDirectory,
		closeDir,
		attachEvent,
		detachEvent,
		initTreeView,
		ctxMenu,
		showRemoveConfirm,
		rename,
		refresh,
		addFile,
		addDirectory,
		State = null,
		Node = null;

	var onSelect,
		onRename,
		onTreeViewContextMenu,
		onProjectModeChanged,
		afterOpenDirectory,
		afterCloseDirectory;

	var contextMenuCurrentNode = null;




	init = function (domain) {
		_domain = domain;
		var $container = $("#synapse-treeview-container");
		var tree = Mustache.render(treeview, {});
		var $html = $(tree);
		$container.append($html);
		Menu.initTreeViewContextMenu();
		Project.on(Project.MODE_CHANGED, onProjectModeChanged);
	};

	clearCurrentTree = function () {
		detachEvent();
		var obj = $("#synapse-tree").jstree(true);
		obj.destroy();
		return new $.Deferred().resolve().promise();
	};

	initTreeView = function () {

		if ($("#synapse-tree ul").length) {
			$("#synapse-tree").jstree("destroy");
		}

		$("#synapse-tree").jstree({
			"core": {
				"check_callback": true,
				"dblclick_toggle": false,
				"worker": false,
				"multiple": false,
				"error": function (err) {
					console.error(err);
				}
			},
			"plugins": ["wholerow"]
		});

		attachEvent();
	};
	afterOpenDirectory = function (e, data) {
		var obj = $("#synapse-tree").jstree(true);
		var node = data.node;
		obj.set_icon(node, "fa fa-folder-open");
		node.state.opened = true;
		obj.enable_node(node);
	};
	afterCloseDirectory = function (e, data) {
		var obj = $("#synapse-tree").jstree(true);
		var node = data.node;
		obj.set_icon(node, "fa fa-folder");
		node.state.opened = false;
		obj.enable_node(node);
	};
	attachEvent = function () {
		var $elem = $("#synapse-tree");
		$elem.on("after_open.jstree", afterOpenDirectory);
		$elem.on("after_close.jstree", afterCloseDirectory);
		$elem.on("select_node.jstree", onSelect);
		$elem.on("rename_node.jstree", onRename);
	};
	detachEvent = function () {
		var $elem = $("#synapse-tree");
		$elem.off("after_open.jstree", afterOpenDirectory);
		$elem.off("after_close.jstree", afterCloseDirectory);
		$elem.off("select_node.jstree", onSelect);
		$elem.off("rename_node.jstree", onRename);
	};
	setRootNodes = function (list) {
		var deferred = new $.Deferred();
		var obj = $("#synapse-tree").jstree(true);

		createNode("#", list).then(deferred.resolve, deferred.reject);
		return deferred.promise();
	};

	connect = function (server) {

		/* online state property, that will be move to "Project" module. */
		/* please use that instead of following code. */
		// if (online) return;
		currentServer = server;
		PathManager.setRemoteRoot(server.dir);

		initTreeView();

		var obj = $("#synapse-tree").jstree(true);

		Panel.showSpinner();
		var remoteRoot = PathManager.getRemoteRoot();

		var res = _domain.exec("Connect", currentServer, remoteRoot)
			.then(setRootNodes)
			.then(function () {
				try {
					Project.open(currentServer)
						.then(function (str) {
							console.log(str);
						}, function () {
							console.log("error");
						});
				} catch (e) {
					console.error(e);
				}

			}, function (err) {
				console.error(err);
			})
			.always(function () {
				Panel.hideSpinner();
			});
	};

	onSelect = function (e, data) {

		var node = data.node;
		var obj = $("#synapse-tree").jstree(true);
		if (data.event.button === 0) {
			var isDirectory = (node.original.type === "d");
			if (isDirectory) {

				if (node.original.isFirst) {
					obj.disable_node(node);
					readDirectory(node)
						.done(function () {
							openDir(node);
						}).fail(function (err) {
							obj.enable_node(node);
							console.error(err);
						});
				} else {
					if (node.state.opened) {
						closeDir(node);
					} else {
						openDir(node);
					}
				}
			}
		}
	};

	readDirectory = function (node) {
		var deferred = new $.Deferred();
		var obj = $("#synapse-tree").jstree(true);
		var pathAry = obj.get_path(node);
		var requestPath = PathManager.completion(pathAry);
		var res = _domain.exec("List", currentServer, requestPath)
			.done(function (list) {

				if (list.length > 0) {
					createNode(node, list, obj);
				} else {
					obj.set_icon(node, "fa fa-folder-o");
					obj.disable_node(node);
				}
				// root node has not property "oritginal.isfirst"
				if (_.has(node, "original")) {
					// node is child directory of root node.
					node.original.isFirst = false;
				}
				deferred.resolve();
			}).fail(function (err) {
				deferred.reject(err);
			});
		return deferred.promise();
	};

	onRename = function (e, data) {
		if (data.text === data.old) {
			return;
		}
		$("#synapse-tree").off("rename_node.jstree", onRename);

		var obj = $("#synapse-tree").jstree(true);
		var parent = obj.get_parent(data.node);
		var parentDirectory = PathManager.completion(obj.get_path(parent));

		if (parentDirectory !== "/" && parentDirectory !== "./") {
			parentDirectory += "/";
		}

		var newPath = parentDirectory + data.text;
		var oldPath = parentDirectory + data.old;

		_domain.exec("Rename", currentServer, oldPath, newPath)
			.done(function (res) {
				console.log(res);
			}).fail(function (err) {
				console.log(err);
				obj.rename_node(data.node, data.old);
			}).always(function () {
				$("#synapse-tree").on("rename_node.jstree", onRename);
			});
	};

	State = function (opened, disabled, selected) {

		this.opened = opened;
		this.disabled = disabled;
		this.selected = selected;
		return this;
	};

	Node = function (parent, text, type, opened, disabled, selected, isFirst) {
		var i = (type === "d") ? "fa fa-folder" : "fa fa-file-o";
		this.parent = parent;
		this.text = text;
		this.icon = i;
		this.type = type;
		this.isFirst = isFirst;
		this.state = new State(opened, disabled, selected);
		return this;
	};

	openDir = function (node) {
		var obj = $("#synapse-tree").jstree(true);
		obj.open_node(node);
	};

	closeDir = function (node) {
		var obj = $("#synapse-tree").jstree(true);
		obj.close_node(node);
	};

	createNode = function (node, list) {
		var obj = $("#synapse-tree").jstree(true);
		list.forEach(function (elem, idx) {
			var text = elem.name;
			var type = elem.type;
			var newNode = new Node(node, text, type, false, false, false, true);
			obj.create_node(node, newNode, "last");
		});
		return new $.Deferred().resolve().promise();
	};

	onTreeViewContextMenu = function (e, menu) {
		if (!$("#synapse-tree ul").length) {
			return;
		}
		var elem = e.target;
		var obj = $("#synapse-tree").jstree(true);

		// set false when contextMenuCurrentNode.
		contextMenuCurrentNode = obj.get_node(elem);


		Menu.treeViewContextMenuState(contextMenuCurrentNode);

		menu.open(e);
	};

	refresh = function () {
		var deferred = new $.Deferred();

		if (!$("#synapse-tree ul").length) {
			return;
		}

		var obj = $("#synapse-tree").jstree(true);
		if (contextMenuCurrentNode === false) {
			contextMenuCurrentNode = obj.get_node("#");
		}

		obj.delete_node(contextMenuCurrentNode.children);
		readDirectory(contextMenuCurrentNode)
			.then(function () {
				deferred.resolve();
			}, function (err) {
				deferred.reject(err);
			});

		return deferred.promise();
	};

	addFile = function () {
		console.log("add new file");
	};

	addDirectory = function () {
		if (!$("#synapse-tree ul").length) {
			return;
		}
		var deferred = new $.Deferred();
		var obj = $("#synapse-tree").jstree(true);

		var placeholder = Strings.PLACEHOLDER_DIR;

		contextMenuCurrentNode = contextMenuCurrentNode === false ? obj.get_node("#") : contextMenuCurrentNode;

		var childNodes = contextMenuCurrentNode.children;
		console.log(childNodes);
		var prefix = 0;
		var regex = new RegExp(placeholder + '.*');
		childNodes.forEach(function (id, idx) {
			var childNode = obj.get_node(id);
			console.log(childNode.text);
			if (childNode.text.match(regex)) {
				prefix++;
			}
		});
		if (prefix !== 0) {
			placeholder += " (" + (prefix + 1) + ")";
		}
		var path = obj.get_path(contextMenuCurrentNode);
		path = PathManager.completion(path);
		path = path + "/" + placeholder;

		var basePath = FileUtils.getParentPath(path);
		var baseName = FileUtils.getBaseName(path);

		_domain.exec("Mkdir", currentServer, path)
			.done(function (res) {
				console.log("mkdir success");
				_domain.exec("List", currentServer, basePath)
					.fail(function (err) {
						deferred.reject(err);
					})
					.done(function (list) {
						list.forEach(function (elem, idx) {
							console.log(elem, placeholder);
							if (elem.name === placeholder) {
								createNode(contextMenuCurrentNode, [elem])
									.done(function () {
										deferred.resolve();
									});
							}
						});
					});
			})
			.fail(function (err) {
				deferred.reject(err);
			});
		return deferred.promise();
	};

	removeDirectory = function () {
		if (!$("#synapse-tree ul").length) {
			return;
		}

		if (contextMenuCurrentNode === false || contextMenuCurrentNode === "#") {
			return;
		}

		var deferred = new $.Deferred();
		var obj = $("#synapse-tree").jstree(true);


		var path = obj.get_path(contextMenuCurrentNode);
		path = PathManager.completion(path);

		DialogCollection.showYesNoModal("removeConfirmDialog", "Confirm", "Are you sure you want to delete the selected directory and all child contents ?")
			.done(function (res) {
				if (res === "Yes") {
					_domain.exec("RemoveDirectory", currentServer, path)
						.done(function () {
							obj.delete_node(contextMenuCurrentNode);
							deferred.resolve();
						})
						.fail(function (err) {
							deferred.reject(err);
						});
				} else {
					deferred.resolve();
				}
			});
		return deferred.promise();
	};

	rename = function () {
		var deferred = new $.Deferred();
		var obj = $("#synapse-tree").jstree(true);
		obj.edit(contextMenuCurrentNode, function (node, status) {
			console.log(node, status);
		});
		return deferred.resolve().promise();
	};

	onProjectModeChanged = function (e, mode) {
		if (mode === Project.ONLINE) {

		}
		if (mode === Project.OFFLINNE) {

		}
	};


	exports.init = init;
	exports.connect = connect;
	exports.refresh = refresh;
	exports.rename = rename;
	exports.onTreeViewContextMenu = onTreeViewContextMenu;
	exports.addFile = addFile;
	exports.addDirectory = addDirectory;
	exports.removeDirectory = removeDirectory;
	exports.clearCurrentTree = clearCurrentTree;
});
