/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	// HEADER >>
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
			FileSystem = brackets.getModule("filesystem/FileSystem"),
			_ = brackets.getModule("thirdparty/lodash"),
			FileUtils = brackets.getModule("file/FileUtils"),
			moment = require("../node_modules/moment/moment"),
			Shared = require("modules/Shared");

	var fadeTimer = null,
			noticeCount = 0;
	
	var errorFileBuffer = null;

	var queue = [],
			fileQueue = [],
			history = 100,
			viewSrc = require("text!../ui/log.html"),
			state = "collapse",
			j = {
				get area () {
					return $("#synapse-log-main, #synapse-log-tab");
				},
				get container () {
					return $("#synapse-log-container");
				}
			};
	
	var _bounding = false;

	var initView,
			q,
			test,
			_toggle,
			_expand,
			_collapse,
			_add,
			_prependFile,
			_onLeave,
			_onEnter,
			_threeSecondsAfter,
			_fadeAttach,
			_fadeDetach,
			writeToFile;



	ExtensionUtils.loadStyleSheet(module, "../ui/css/log.css");
	// <<


	Array.observe(queue, function (changes) {
		_.forEach(changes, function (change) {
			if ((change.type === "splice" || change.type === "remove") && change.object.length > 0) {
				_add(queue.shift());
			}
		});
	});
	Array.observe(fileQueue, function (changes) {
		_.forEach(changes, function (change) {
			if ((change.type === "splice" || change.type === "remove") && change.object.length > 0) {
				_prependFile(fileQueue.shift());
			}
		});
	});

	test = function () {
	};

	initView = function () {
		Shared.errorFile = FileSystem.getFileForPath(FileUtils.getParentPath(ExtensionUtils.getModulePath(module)) + "error.log");
		FileUtils.readAsText(Shared.errorFile)
		.then(function (text, time) {
			errorFileBuffer = text.split(/\n/);
		});
		
		var html = Mustache.render(viewSrc,{});
		$("#synapse").append($(html));
		$("#synapse-log-rows").hide();
		$("#synapse-log-notice-count").hide();

		var $container = $("#synapse-log-container");
		var $main = $("#synapse-log-main");
		var $tab = $("#synapse-log-tab");

		var $area = $("#synapse-log-main, #synapse-log-tab");
		$area.addClass("transparency");

		_fadeAttach();

		$container.addClass("log-collapse");
		$("#synapse-log-tab, #synapse-log-main").on("click", function (e) {
			if (!$(e.target).hasClass("spacer")) {
				_toggle();
			}
		});
		return new $.Deferred().resolve().promise();
	};

	q = function (message, error, toFile) {
		var m = moment(),
				now = m.format("HH:mm:ss MMM DD").toString();
		if (error) {
			message = "<span class='synapse-log-error'>ERROR</span>" + message;
		}
		var obj = {
			message: message,
			now: now,
			error: error
		};
		if ($("#synapse-log-container").hasClass("log-collapse")) {
			j.area.removeClass("transparency");
			noticeCount++;
			$("#synapse-log-notice-count").html(noticeCount).show();
			_onLeave();
		}
		queue.push(obj);
		
		writeToFile(obj, now);
		
	};
	
	writeToFile = function (param, now) {
		now = now | moment().format("HH:mm:ss MMM DD").toString();
		param = param | "no message.";
		var str = "";
		if (typeof (obj) === "string") {
			str = param;
		} else {
			str = JSON.stringify(param);
		}
		
		if (str) {
			fileQueue.push("[" + now + "]:" + str);
		}
	};

	_toggle = function () {
		var d = new $.Deferred(),
				$container = $("#synapse-log-container"),
				$tab = $("div#synapse-log-tab");

		if (!$container.hasClass("log-collapse")) {
			_collapse()
				.then(function () {
					$container
						.toggleClass("log-collapse");
					$("i.fa-angle-up", $tab).toggleClass("down");
					state = "collapse";
					d.resolve();
				});
		} else {
			_expand()
			.then(function () {
				$container
					.toggleClass("log-collapse");
				$("i.fa-angle-up", $tab).toggleClass("down");
				state = "expand";
				d.resolve();
			});
		}
		return d.promise();
	};

	_collapse = function () {
		var d = new $.Deferred(),
				$container = $("#synapse-log-container"),
				$body = $("#synapse-log-body");
		if ($container.hasClass("log-collapse")) {
			return d.resolve().promise();
		}
		_onLeave();

		$("#synapse-log-rows").hide();
		$body.animate({"height": 0}, 200).promise()
		.then(function () {
			d.resolve();
		});
		return d.promise();
	};

	_expand = function () {
		var d = new $.Deferred(),
				$container = $("#synapse-log-container"),
				$body = $("#synapse-log-body");
		if ($container.hasClass("log-expand")) {
			return d.resolve().promise();
		}
		j.area.removeClass("transparency");
		$body.animate({"height": "150px"}, 200).promise()
		.then(function () {
			noticeCount = 0;
			$("#synapse-log-notice-count").hide();
			$("#synapse-log-rows").show();
			_fadeDetach();
			d.resolve();
		}, d.reject);
		return d.promise();
	};

	_add = function (item) {
		var d = new $.Deferred(),
				$rows = $("#synapse-log-rows"),
				$row = $("<div>").addClass("synapse-log-row");
		var $p = $("<p>")
					.addClass("item")
					.html(item.message + "<br>")
					.appendTo($row);

		$("<p>")
			.addClass("datetime")
			.html(item.now)
			.appendTo($row);
		
		if (item.error && $("#synapse-log-container").hasClass("log-collapse")) {
			_toggle();
		}
		$rows.prepend($row);
	};

	_fadeAttach = function () {
		j.area.one("mouseenter", _onEnter);
	};
	
	_fadeDetach = function () {
		if (fadeTimer !== null) {
			clearTimeout(fadeTimer);
			fadeTimer = null;
		}
		fadeTimer = null;
		j.area.off("mouseenter", _onEnter);
		j.area.off("mouseleave", _onLeave);
	};
	
	_onEnter = function (e) {
		if (fadeTimer !== null) {
			clearTimeout(fadeTimer);
			fadeTimer = null;
		}
		j.area.removeClass("transparency");
		j.area.one("mouseleave", _onLeave);
	};
	_onLeave = function (e) {
		if (fadeTimer !== null) {
			clearTimeout(fadeTimer);
			fadeTimer = null;
		}
		fadeTimer = setTimeout(_threeSecondsAfter, 3000);
		j.area.one("mouseenter", _onEnter);
	};
	_threeSecondsAfter = function (e) {
		j.area.addClass("transparency");
		fadeTimer = null;
	};

	
	_prependFile = function (line) {
		errorFileBuffer.unshift(line);
		FileUtils.writeText(Shared.errorFile, errorFileBuffer.join("\n"));
	};

	exports.q = q;
	exports.initView = initView;
	exports.test = test;
	exports.writeToFile = writeToFile;
});
