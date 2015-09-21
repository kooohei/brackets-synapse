/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	var _ = brackets.getModule("thirdparty/lodash");
	var CryptoJS = require("../node_modules/crypto-js/crypto-js");

	var observeData = {
		currentSessionPassword: false,
		
		notice: function (changes) {
			console.log(changes);
			if (changes.name === "currentSessionPassword") {
				if (changes.type === "add") {
					console.log("add");
				}
				if (changes.type === "update") {
					console.log("update");
				}
			}
		}
	};
	Object.observe(observeData, observeData.notice);
	
	
	var getSessionPassword,
		_getKey,
		_getIV,
		encrypt,
		decrypt;
	
	encrypt = function (password, settings) {
		var	salt = CryptoJS.lib.WordArray.random(128/8),
				key = _getKey(password, salt),
				iv = _getIV(password, salt);
		var options = {mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7, iv: iv},
				F = CryptoJS.AES.encrypt(settings, key, options);
		var obj = {
			prefix: CryptoJS.enc.Utf8.parse("SYNAPSE_").toString(CryptoJS.enc.Base64),
			salt: salt.toString(CryptoJS.enc.Base64),
			ciphertext: F.ciphertext.toString(CryptoJS.enc.Base64)
		};
		var res = obj.prefix + obj.salt + obj.ciphertext;
		return res;
	};
	
	decrypt = function (_password, _encrypted) {
		var salt = _encrypted.substr(12, 24),
				ciphertext = _encrypted.substr(36, _encrypted.length-1);
		var obj = {
			salt: CryptoJS.enc.Base64.parse(salt),
			cipher: CryptoJS.enc.Base64.parse(ciphertext)
		};
		var key = _getKey(_password, obj.salt),
				iv = _getIV(_password, obj.salt),
				options = {mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7, iv: iv},
				decrypted = CryptoJS.AES.decrypt({ciphertext: obj.cipher}, key, options);
		try {
			observeData.currentSessionPassword = _password;
			var res = decrypted.toString(CryptoJS.enc.Utf8);
			return res;
		} catch(e) {
			console.error(e);
			observeData.currentSessionPassword = false;
			return false;
		}
	};
	
	_getKey = function (password, salt) {
		return CryptoJS.PBKDF2(password, salt, {keySizse: 256/32, iterations: 500});
	};
	_getIV = function (password, salt) {
		return CryptoJS.PBKDF2(password, salt, {keySizse: 128/32, iterations: 500});
	};

	getSessionPassword = function () {
		return observeData.currentSessionPassword;
	};
	
	exports.encrypt = encrypt;
	exports.decrypt = decrypt;
	exports.getSessionPassword = getSessionPassword;
});
