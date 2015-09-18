/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	
	var PreferencesManager = brackets.getModule("preferences/PreferencesManager");
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var _ = brackets.getModule("thirdparty/lodash");
	var Strings = require("strings");
	var SettingManager = require("modules/SettingManager");
	var close;
	var PreferenceManager = require("modules/PreferenceManager");
	var CryptoManager = require("modules/CryptoManager");
	var Notify;
	
	var SecureWarning,
			DecryptPassword;
	
	
	Notify = function (params) {
		if ($("#" + params.id).length) {
			throw new Error("ID: " + params.id + " is already exists.");
		}
		EventDispatcher.makeEventDispatcher(this);
		var source = require("../text!ui/notify.html");
		var self = this;
		this.params = params;
		var html = Mustache.render(source, params);
		this.$html = $(html);
		var $sidebar = $("#sidebar");
		if (!$("#synapse-notify-container").length) {
			$("<div>").attr("id", "synapse-notify-container").appendTo($sidebar);
		}
		this.$container = $("div#synapse-notify-container");
		
		this.$container.append(this.$html.hide());
		$(".notify-header button.close", this.$html).on("click", function (e) {
			self.close(e);
		});
	};
	
	Notify.prototype.appendButton = function (className, text) {
		console.log("appendButton called");
		var $btn = $("<button>").addClass(className).html(text);
		$("div.notify-footer > div.btn-group", this.$html).append($btn);
		return $btn;
	};
	
	Notify.prototype.updatePos = function () {
		var offsetHeight = $("#" + this.params.id) + "px";
		this.$container.css({"height": offsetHeight,"bottom": "-" + offsetHeight});
	};
	
	Notify.prototype.show = function () {
		var self = this;
		if (this.$html.is(":hidden")) {
			this.$html.show();
			this.updatePos();
			this.$container.animate({"bottom": 0}, 300).promise()
			.done(function () {
				self.trigger("shown");
			});
		}
	};
	
	Notify.prototype.close = function () {
		var self = this;
		if (self.$html.is(":visible")) {
			self.$container.animate({"bottom": (self.$container.outerHeight() * -1) + "px"}, "fast").promise()
			.then(function () {
				self.$html.hide();
				self.trigger("closed");
			});
		}
	};
	
	
	SecureWarning = function () {
		var src = require("../text!ui/secureWarning.html");
		var content = Mustache.render(src);
		var $content = $(content);
		var self = this;
		var close = function () {
			this.close();
		};
		this.params = {
			id: "secure-warning",
			class: "secure-warning",
			title: Strings.SYNAPSE_SECURE_WARNING_TITLE,
			message: Strings.SYNAPSE_SECURE_WARNING_MESSAGE,
			content: content
		};
		Notify.call(this, this.params);
		
		
		this.appendButton("btn primary", Strings.SYNAPSE_SECURE_WARNING_BTN1).on("click", function (e) {
			self.setPassword();
		});
		this.appendButton("btn", Strings.SYNAPSE_SECURE_WARNING_BTN2).on("click", function (e) {
			self.close();
		});
		
		
	};
	SecureWarning.prototype = Object.create(Notify.prototype);
	SecureWarning.prototype.constructor = SecureWarning;
	
	SecureWarning.prototype.setPassword = function () {
		var password = $("#cryptoPass").val();
		var repasswd = $("#re-cryptoPass").val();
		if (password === "" || repasswd === "" || (password !== repasswd) || password.length < 4) {
			$("#cryptoPass", this.$html).addClass("invalid");
			$("#re-cryptoPass", this.$html).addClass("invalid");
			$("p.validateMessage", this.$html).html("<b><i>Invalid password.</i></b>");

		} else {
			$("p.validateMessage", this.$html).html("<b><i>OK</i></b>");
			var settings = PreferenceManager.getServerSettings();
			var cipher = CryptoManager.encrypt(password, settings);
			PreferenceManager.setServerSettings(cipher);
			
			this.close();
		}
	};
	
	DecryptPassword = function () {
		var src = require("../text!ui/decryptPassword.html");
		var content = Mustache.render(src);
		var $content = $(content);
		var self = this;
		this.params = {
			id: "synapse-decrypt-password",
			class: "synapse-decrypt-password",
			title: "Synapse Notify",
			content: $content.html(),
			message: "Password for Settings"
		};
		Notify.call(this, this.params);
		
		this.on("shown", function () {
			$("#decrypt-password-input").focus();
			$("button#btn-decrypt").on("click", self.tryDecrypt);
		});
	};
	
	DecryptPassword.prototype = Object.create(Notify.prototype);
	
	DecryptPassword.prototype.constructor = DecryptPassword;
	
	DecryptPassword.prototype.tryDecrypt = function() {
		var password = $("#decrypt-password-input").val();
		var cipher = PreferenceManager.getServerSettings();
		var settings = CryptoManager.decrypt(password, cipher);
		console.log(settings);
		
	};
	
	exports.SecureWarning = SecureWarning;
	exports.DecryptPassword = DecryptPassword;
});