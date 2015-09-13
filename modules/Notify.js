/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	
	var EventDispatcher = brackets.getModule("utils/EventDispatcher");
	var source = require("../text!ui/notify.html");
	var _ = brackets.getModule("thirdparty/lodash");
	
	var create,
			show;
	
	/**
	 * Constructor
	 * 
	 * @param id		{String} id="synapse-(id)"
	 * @param class {String} class="(class)"
	 * @param title {String}
	 * @param message {String}
	 * @param type	{object}
	 * * type		: 0 or 1
	 * * buttons: text1: display text for button1 (defaut: Yes)
	 * * 					text2: display text for button2 (default: No)
	 * @param cb		{function} callback
	 * @return instance {Object}
	 */
	function Notify(id, cls, title, message, buttons, cb) {
		this.cls = cls || "";
		this.id = id || "";
		this.title = title || "NONE";
		this.message = message || "";
		if (this.id === "" ) {
			throw new Error("Could not specify empty value to id");
		}
		this.buttons = buttons;
		
		this.html = Mustache.render(source, {id: id, class: cls});
		this.$html = $(this.html);
		
		var self = this;
		this.props = {
			get title() { return self.title; },
			set title(val) {
				self.title = val || "";
				$("h1.notify-title", self.$html).html(val);
			},
			get message() { return self.message; },
			set message(val) {
				self.message = val || "";
				$("div.notify-message", self.$html).html(val);
			}
		};
		this.props.title = this.title;
		this.props.message = this.message;
		
		if (buttons.type === 0) {
			var $btn0 = $("<button>").addClass("btn btn-primary dialog-button")
									.on("click", function (e) {
										cb({event: e, data: buttons.text1 || "OK"});
									});
			$("div.modal-footer", self.$html).append($btn0);
		}
		if (buttons.type === 1) {
			var $btn1 = $("<button>").addClass("btn btn-primary dialog-button")
									.on("click", function (e) {
										cb({event: e, data: buttons.text1 || "Yes"});
									});
			var $btn2 = $("<button>").addClass("btn btn-default dialog-button")
									.on("click", function (e) {
										cb({event: e, data: buttons.text2 || "NO"});
									});
			
			$("div.modal-footer", self.$html).append($btn1).append($btn2);
		}
		return this;
	}
	
	Notify.prototype.show = function () {
		var $container = null;
			if (!$("div#synapse-notify-container").length) {
				$container = $("<div>").attr({id: "synapse-notify-container"});
				$("body").append($container);
			}
		$("body > div#synapse-notify-container").append(this.$html);
		if (this.$html.hasClass("show")) {
			this.$html.toggleClass("show");
		}
		
	};
	
	EventDispatcher.makeEventDispatcher(exports);
	exports.Notify = Notify;
});
