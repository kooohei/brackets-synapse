/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	
	// Modules >
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var FileSystem = brackets.getModule("filesystem/FileSystem");
	var _ = brackets.getModule("thirdparty/lodash");
	var Strings = require("strings");
	var PreferenceManager = require("modules/PreferenceManager");
	var CryptoManager = require("modules/CryptoManager");
	var SettingManager = require("modules/SettingManager");
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
		$container.appendTo($("#sidebar"));
		return d.resolve(_domain).promise();
	};
	_getBase = function (title, $content) {
		var src = Mustache.render(_base, {title: title, content: $content}),
				$base = $(src);
		$("button.close", $base).one("click", close);
		return $base;
	};
	// get dependencies.
	_getSecureWarning = function () {
		var src = Mustache.render(_secureWarning, {Strings: Strings});
		var $notify = _getBase(Strings.SYNAPSE_SECURE_WARNING_TITLE, src);
		return $notify;
	};
	
	_getDecryptPassword = function () {
		var d = new $.Deferred();
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
		}
		if (dependency === "DecryptPassword") {
			$notify = _getDecryptPassword();
		}
		$container.html($notify).css({"bottom": "-" + $container.outerHeight() + "px"});
		$container.show();
		$container.css({"bottom": 0});
		$container.one("transitionend", function () {
			if (dependency === "SecureWarning") {
				
				$("#synapse-secure-warning-btn1", $notify).off("click");
				
				$("#synapse-secure-warning-btn1", $notify).on("click", function () {

					var $password = $("#crypt-password", $notify),
							$rePasswd = $("#re-password", $notify),
							$valid_mess = $("p.validateMessage", $notify);

					if ($password.val() !== $rePasswd.val() ||
						 $password.val() === "" || $password.val().length < 4) {

						$password.addClass("invalid");
						$rePasswd.addClass("invalid");
						$valid_mess.html("Invalid Password");

					} else {

						$password.removeClass("invalid");
						$rePasswd.removeClass("invalid");
						$valid_mess.html("OK");

						var settings = PreferenceManager.loadServerSettings();
						var encrypted = CryptoManager.encrypt($password.val(), settings);																									

						PreferenceManager.saveServerSettings(encrypted)
							.then(function () {
								PreferenceManager.setUseCrypt(true);
								return close();
							})
							.then(function () {
								d.resolve({state: "COMPLETE_ENCRYPT"});
							}, function (err) {
								d.reject(err);
							});
					}
				});
				$("#synapse-secure-warning-btn2", $notify).one("click", function (e) {
					close()
					.then(function () {
						d.resolve({state: "NOTIFY_CLOSED"});
					});
				});
				$("#crypt-password", $notify).focus();
			}
			
			if (dependency === "DecryptPassword") {
				
				$("#synapse-decrypt-password-btn1", $notify).on("click", function (e) {
					var $password = $("#synapse-decrypt-password-input", $notify),
							value = $password.val(),
							$validateMessage = $("p.validateMessage", $notify);

					if (value === "" || value.length < 4) {
						$password.addClass("invalid");
						$validateMessage.html("Invalid Password");
					}
					var encrypted = PreferenceManager.loadServerSettings();
					var decrypted = CryptoManager.decrypt($password.val(), encrypted);
					if (!decrypted) {
						d.reject("CRYPTED FAILED");
					} else {
						close()
						.then(function () {
							SettingManager.setServerSettings(JSON.parse(decrypted));
							d.resolve({state: "COMPLETE_DECRYPT", decrypted: JSON.parse(decrypted)});
						});
					}
				});
				
				$("#synapse-decrypt-password-input", $notify).focus();
			}
		});
		return d.promise();
	};
	close = function () {
		var	d = new $.Deferred(),
				$container = $("#synapse-notify-container"),
				outerHeight = $container.outerHeight();
		
		$container.css({"bottom": "-" + outerHeight + "px"});
		$container.one("transitionend", function () {
			$container.html("");
			$container.hide();
			d.resolve();
		});
		return d.promise();
	};
	
	
	
	// <
	
	EventDispatcher.makeEventDispatcher(exports);
	
	exports.init = init;
	exports.show = show;
	exports.close = close;
	
});