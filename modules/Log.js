
/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	// HEADER >>
	var ExtensionUtils	= brackets.getModule("utils/ExtensionUtils"),
			FileSystem			= brackets.getModule("filesystem/FileSystem"),
			FileUtils				= brackets.getModule("file/FileUtils"),
			_								= brackets.getModule("thirdparty/lodash"),
			Utils						= require("modules/Utils"),
			Shared					= require("modules/Shared");

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

	var init,
			q,
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
			writeToErrorLog;



	ExtensionUtils.loadStyleSheet(module, "../ui/css/log.css");
	// <<

	

	/**
	 * Initialize module.
	 * 
	 * @Return {$.Promise} a promise never rejected.
	 */
	init = function () {
		Shared.errorFile = FileSystem.getFileForPath(FileUtils.getParentPath(ExtensionUtils.getModulePath(module)) + "error.log");
		FileUtils.readAsText(Shared.errorFile)
		.then(function (text, time) {
			errorFileBuffer = text.split(/\n/);
		}, function (err) {
			err = new Error({message: "Failed to read to buffer from error log text", err: err});
			console.log({message: "SYNAPSE ERROR", err: err});
			throw new Error(err);
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

	/**
	 * Append new message to the log queue.
	 * 
	 * @param {string} 	message
	 * @param {object} 	error
	 * @param {mix} 		toFile It will be write to error log, after that change to string if the value is object.
	 */
	q = function (message, error, orgErrorObj) {
		
		var mess = message;
		error = error || false;
		orgErrorObj = orgErrorObj || null;
		
		var datetime = Utils.now();
		mess = "<p style='display: inline-block'>" +  message + "</p>";
		if (error) {
			mess = "<span class='synapse-log-error'>ERROR</span>" + mess;
		}
		
		var obj = {
			message: mess,
			datetime: datetime,
			error: error
		};
		if ($("#synapse-log-container").hasClass("log-collapse")) {
			j.area.removeClass("transparency");
			noticeCount++;
			$("#synapse-log-notice-count").html(noticeCount).show();
			_onLeave();
		}
		queue.push(obj);
		while (queue.length) {
			_add(queue.shift());
		}
		
		if (error && orgErrorObj) {
			var param = {
				message: message,
				datetime: datetime,
				error: orgErrorObj
			};
			writeToErrorLog(param, datetime);
		}
	};
	
	/**
	 * Append new message to the file queue.
	 * this function invoked by above the function "q"
	 * actual write to file by the queue's array observer.
	 */
	writeToErrorLog = function (param, datetime) {
		datetime = datetime || Utils.now();
		param = param || "no message.";
		var str = "";
		if (typeof (obj) === "string") {
			str = param;
		} else {
			str = JSON.stringify(param);
		}
		
		if (str) {
			fileQueue.push("[" + datetime + "]:" + str);
			while (fileQueue.length) {
				_prependFile(fileQueue.shift());
			}
		}
	};

	/**
	 * Toggle display console panel
	 * 
	 * @return {$.Promise} a promise that will be resolved if complete animation. that never rejected.
	 */
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

	/**
	 * Hide console panel.
	 * 
	 * @return {$.Promise} a promise that will be resolved if the panel closed. that never rejected.
	 */
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

	/**
	 * Show console panel.
	 * 
	 * @return {$.Promise} a promise that will be resolved if the panel shown. that never rejected.
	 */
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
		});
		return d.promise();
	};

	/**
	 * Append message object to console panel.
	 * * create actual display element from message object then it will be append console.
	 */
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
			.html(item.datetime)
			.appendTo($row);
		
		if (item.error && $("#synapse-log-container").hasClass("log-collapse")) {
			_toggle();
		}
		$rows.prepend($row);
	};

	/**
	 * Attach fade animation listener
	 * * This handler is one shot, because that invoke when the execute toggled console.
	 */
	_fadeAttach = function () {
		j.area.one("mouseenter", _onEnter);
	};
	
	/**
	 * Detach fade animation listener.
	 */
	_fadeDetach = function () {
		if (fadeTimer !== null) {
			clearTimeout(fadeTimer);
			fadeTimer = null;
		}
		fadeTimer = null;
		j.area.off("mouseenter", _onEnter);
		j.area.off("mouseleave", _onLeave);
	};
	
	/**
	 * The listener of mouse enter for the change console opacity.
	 */
	_onEnter = function (e) {
		if (fadeTimer !== null) {
			clearTimeout(fadeTimer);
			fadeTimer = null;
		}
		j.area.removeClass("transparency");
		j.area.one("mouseleave", _onLeave);
	};
	/**
	 * The listener of mouse leave for the change console opacity.
	 */
	_onLeave = function (e) {
		if (fadeTimer !== null) {
			clearTimeout(fadeTimer);
			fadeTimer = null;
		}
		fadeTimer = setTimeout(_threeSecondsAfter, 3000);
		j.area.one("mouseenter", _onEnter);
	};
	/**
	 * This listener will be called after 3 seconds of call of _onLeave function for automatic fade out.
	 * * 
	 */
	_threeSecondsAfter = function (e) {
		j.area.addClass("transparency");
		fadeTimer = null;
	};

	/**
	 * Write to the head of error log file actually.
	 * 
	 * @param {string}
	 */
	_prependFile = function (line) {
		errorFileBuffer.unshift(line);
		FileUtils.writeText(Shared.errorFile, errorFileBuffer.join("\r\n"));
	};

	exports.q = q;
	exports.init = init;
	exports.writeToErrorLog = writeToErrorLog;
});
