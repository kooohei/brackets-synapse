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
	
	function Notify(TYPE) {
		var source = require("../text!ui/notify.html");
		this.type = TYPE;
		var _buttons, params;
		var self = this;
		
		if (TYPE === "SECURE WARNING") {
			params = {
				id: "secureWarning",
				class: "secureWarning",
				title: Strings.SYNAPSE_SECURE_WARNING_TITLE,
				message: Strings.SYNAPSE_SECURE_WARNING_MESSAGE,
				secureWarning: true,
				_buttons : {
					type: 1,
					text1: Strings.SYNAPSE_SECURE_WARNING_BTN1,
					text2: Strings.SYNAPSE_SECURE_WARNING_BTN2
				}
			};
		}
		
		
		var html = $(Mustache.render(source, params));
		this.$synapse = $("#synapse");
		if (!$("#synapse-notify-container").length) {
			$("<div>").attr("id", "synapse-notify-container").appendTo(this.$synapse);
		}
		this.$container = $("div#synapse-notify-container");
		this.$container.append($(html).hide());
		this.$html = $("#" + params.id);
		
		EventDispatcher.makeEventDispatcher(this);
		
		if (params._buttons.type === 0) {
			var $btn0 = $("<button>").addClass("btn blue")
									.html(params._buttons.text1 || "OK")
									.on("click", function (e) {
										self.close(e, params._buttons.type);
									});
			$("div.notify-footer > div.btn-group", this.$html).html($btn0);
		}
		if (params._buttons.type === 1) {
			var $btn1 = $("<button>").addClass("btn primary")
									.html(params._buttons.text1 || "Yes")
									.on("click", function (e) {
										self.indivisuals()
										.then(function () {
											self.close(e, params._buttons.type, this.type);
										});
									});
			var $btn2 = $("<button>").addClass("btn default")
									.html(params._buttons.text2 || "No")
									.on("click", function (e) {
										self.close(e, params._buttons.type, this.type);
									});
			$("div.notify-footer > div.btn-group", this.$html).html($btn1).append($btn2);
		}
	}
	
	
	Notify.prototype.updatePos = function () {
		this.$container.css({"bottom": (this.$container.outerHeight * -1) + "px"});
	};
	
	Notify.prototype.show = function () {
		var self = this;
		if (this.$html.is(":hidden")) {
			this.updatePos();
			this.$html.show();
			this.$container.animate({"bottom": 0}, "fast").promise()
			.then(function () {
				self.trigger("shown", self);
			});
		}
	};
	
	Notify.prototype.close = function (e, btnType, notificateType) {
		var self = this;
		if (this.$html.is(":visible")) {
			this.$container.animate({"bottom": (this.$container.outerHeight() * -1) + "px"}, "fast").promise()
			.then(function () {
				$(e.target).off("click");
				self.$html.remove();
				self.trigger("closed", self);
			});
		}
	};
	
	Notify.prototype.indivisuals = function () {
		var d = new $.Deferred();
		if (this.type === "SECURE WARNING") {
			var password = $("#cryptoPass").val();
			var repasswd = $("#re-cryptoPass").val();
			if (password === "" || repasswd === "" || (password !== repasswd) || password.length < 4) {
				$("#cryptoPass", this.$html).addClass("invalid");
				$("#re-cryptoPass", this.$html).addClass("invalid");
				$("p.validateMessage", this.$html).html("<b><i>Invalid password.</i></b>");
				d.reject();
				
			} else {
				$("p.validateMessage", this.$html).html("<b><i>OK</i></b>");
				var settings = PreferenceManager.getServerSettings();
				var cipher = CryptoManager.encrypt(password, settings);
				PreferenceManager.setServerSettings(cipher);
				d.resolve();
			}
		}
		else {
			d.resolve();
		}
		return d.promise();
	};
	
	
	function DecryptPassword() {
		var source = require("../text!ui/decryptPassword.html");
		var html = Mustache.render(source);
		console.log(html);
		var $html = $(html);
		console.log("constructor of DecryptPasswrord called");
		$("div#editor-holder").append($html);
	}
	
	exports.Notify = Notify;
	exports.DecryptPassword = DecryptPassword;
});