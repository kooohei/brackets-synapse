/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	
	// Modules >
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var Strings = require("strings");
	// <
	
	var _base = require("../text!ui/notify/base.html"),
			_secureWarning = require("../text!ui/notify/secureWarning.html"),
			_decryptPassword = require("../text!ui/notify/decryptPassword.html");
	
	
	
	// Private Vars >
	var domain;
	// <
	
	// Public Methods >
	var init,
			show,
			close;
	//<
	
	// Private Methods >
	var _getBase,
			_getSecureWarning,
			_getDecryptPassword;
	// <
	
	
	/**
	 * HTML structure
	 * 
	 * div#sidebar
	 *   └ div#synapse-notify-container
	 *			 └ div.synapse-notify
	 * 			 		 └ div#(dependency)
	 *
	 */
	
	
	ExtensionUtils.loadStyleSheet(module, "../ui/css/notify.css");
	
	// Must be called only once at main.js
	init = function (_domain) {
		domain = _domain;
		var d = new $.Deferred();
		if ($("#synapse-notify-container").length) {
			return d.resolve(_domain).promise();
		}
		
		var $container = $("<div>").attr({"id": "synapse-notify-container"}).hide();
		$container.prependTo($("#sidebar"));
		
		
		return d.resolve(_domain).promise();
	};
	_getBase = function (title, $content) {
		console.log(title);
		var src = Mustache.render(_base, {title: title, content: $content}),
				$base = $(src);
		$("button.close", $base).one("click", close);
		return $base;
	};
	// get dependencies.
	_getSecureWarning = function () {
		var src = Mustache.render(_secureWarning, {Strings: Strings});
		var $notify = _getBase(Strings.SYNAPSE_SECURE_WARNING_TITLE, src);
		$("#synapse-secure-warning-btn1", $notify).on("click", function () {
			var $password = $("#crypt-password");
			var $rePasswd = $("#re-password");
			var $valid_mess = $("p.validateMessage", $notify);
			if ($password.val() !== $rePasswd.val()) {
				$password.addClass("invalid");
				$rePasswd.addClass("invalid");
				$valid_mess.html("Passwords is not match");
			} else {
				$password.removeClass("invalid");
				$rePasswd.removeClass("invalid");
				$valid_mess.html("OK");
			}
		});
		$("#synapse-secure-warning-btn2", $notify).one("click", close);
		return $notify;
	};
	_getDecryptPassword = function () {
		var src = Mustache.render(_decryptPassword, {Strings: Strings});
		var $notify = _getBase(Strings.SYNAPSE_DECRYPT_PASSWORD_TITLE, src);
		return $notify;
	};
	
	// Public Command
	show = function (dependency) {
		
		var $container = $("#synapse-notify-container");
		var d = new $.Deferred(),
				$notify;
		
		if (dependency === "SecureWarning") {
			$notify = _getSecureWarning();
			console.log($notify);
		}
		if (dependency === "DecryptPassword") {
			$notify = _getDecryptPassword();
		}
		
		
		$container.html($notify).css({"bottom": "-" + $container.outerHeight() + "px"});
		$container.show();
		$container.css({"bottom": 0});
		$container.one("transitionend", function () {
			d.resolve();
		});
		
		return d.promise();
	};
	close = function (e) {
		var	$container = $("#synapse-notify-container"),
				outerHeight = $container.outerHeight();
		
		$container.css({"bottom": "-" + outerHeight + "px"});
		$container.one("transitionend", function () {
			$container.html("");
			$container.hide();
			exports.trigger("closed", {event: e});
		});
	};
	
	
	
	
	// Dependencies process >
	
	
	// <
	
	EventDispatcher.makeEventDispatcher(exports);
	
	exports.init = init;
	exports.show = show;
	exports.close = close;
	
});