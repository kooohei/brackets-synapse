/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";

	var	CryptoJS	= require("node/node_modules/crypto-js/crypto-js");

	var	_currentSessionPassword = false,
			getSessionPassword,
			setSessionPassword,
			_getIV,
			decrypt,
			_getKey,
			encrypt;
	
	encrypt = function (password, settings) {
		var	salt = CryptoJS.lib.WordArray.random(128/8),
				key = _getKey(password, salt),
				iv = _getIV(password, salt);
		var options = {mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7, iv: iv},
				F = null;
		
		try {
			F = CryptoJS.AES.encrypt(settings, key, options);
			setSessionPassword(password);
			
		} catch (e) {
			setSessionPassword(false);
			return false;
		}
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
				options = {mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7, iv: iv};
				
		try {
			var decrypted = CryptoJS.AES.decrypt({ciphertext: obj.cipher}, key, options);
			var res = decrypted.toString(CryptoJS.enc.Utf8);
			setSessionPassword(_password);
			return res;
		} catch(e) {
			setSessionPassword(false);
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
		return _currentSessionPassword;
	};
	setSessionPassword = function (password) {
		_currentSessionPassword = password;
	};
	
	exports.encrypt = encrypt;
	exports.decrypt = decrypt;
	exports.getSessionPassword = getSessionPassword;
	exports.setSessionPassword = setSessionPassword;
});
