/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	"use strict";
	
	// public methods
	var init,
			append
			;
	
	// entity object
	var Server = function (host, port, user, password, dir) {
		this.host = host;
		this.port = port === "" ? 21 : port;
		this.user = user;
		this.password = password;
		this.dir = dir;
	};
	
	// jquery elem
	var $config = null;
	
	// regexp
	var regexp = {
		host: null,
		port: null,
		path: null
	};
	var validate;
	
	
	init = function () {
		$config = $("#synapse-config");
		regexp.host = new RegExp("^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9])$");
		regexp.port = new RegExp("[1-65535]");
		regexp.unix_path = new RegExp("^$|^\\.\\/.*?|^\\/.*?");
		regexp.win_path = new RegExp("^[a-z]\\:\\\.*?");
		return new $.Deferred().resolve().promise();
	};
	
	
	append = function () {
		var deferred = new $.Deferred();
		var invalid = [];
		
		var values = {
			host 		: {form: $("#synapse-server-host", $config), icon: $("i.fa-desktop"), invalid: false},
			port 		: {form: $("#synapse-server-port", $config), icon: $("i.fa-plug"), invalid: false},
			user 		: {form: $("#synapse-server-user", $config), icon: $("i fa-user"), invalid: false},
			password: {form: $("#synapse-server-password", $config),icon: $("i fa-lock"), invalid: false},
			dir	 		: {form: $("#synapse-server-dir", $config), icon: $("i.fa-sitemap"), invalid: false}
		};
		
		var keys = Object.keys(values);
		
		keys.forEach(function (key) {
			values[key].form.removeClass("invalid");
			values[key].invalid = false;
			values[key].icon.removeClass("done");
		});
		
		keys.forEach(function (key) {
			if (!validate(key, values[key].form.val())) {
				values[key].invalid = true;
			}
			invalid.push(values[key]);
		});
		
		if (invalid.length === 0) {
			
		} else {
			console.log(invalid);
			// has error.
			invalid.forEach(function (obj) {
				if (obj.invalid) {
					obj.form.addClass("invalid");
				} else {
					obj.icon.addClass("done");
				}
			});
		}
	};
	
	
	validate = function (prop, value) {
		if (prop === "host") {
			return value !== "" && value.match(regexp.host);
		}
		if (prop === "port") {
			return value !== "" && value.match(regexp.port);
		}
		if (prop === "user") {
			return value !== "";
		}
		if (prop === "password") {
			return value !== "";
		}
		if (prop === "dir") {
			return value === "" || (value.match(regexp.unix_path) || value.match(regexp.win_path));
		}
				
	};
	
	exports.init = init;
	exports.append = append;
});