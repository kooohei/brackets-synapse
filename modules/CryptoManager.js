/*jslint node:true, vars:true, plusplus:true, devel:true, nomen:true, regexp:true, white:true, indent:2, maxerr:50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	
	var CryptoJS = require("../node_modules/crypto-js/crypto-js"),
			AES = require("../node_modules/crypto-js/aes");
	
	
	var _currentSessionPassword = null;
	
	var setSessionPassword,
			getSessionPassword,
			encrypt,
			decrypt,
			_getKey,
			_getIV;
	
	
	/**
	 * Key	length 256bit, 
	 * IV		length 128bit,
	 * Iteration count: (password.length * 2000)
	 */
	encrypt = function (password, src) {
		console.log({1: src});
		var salt 	= CryptoJS.lib.WordArray.random(128 / 8);
		var iv	 	= _getIV(password, salt);
		var key 	= password; //_getKey(password, salt);
		
		var data = null,
				res = {};
		
		data = CryptoJS.AES.encrypt(src, key, {iv: iv});
		
		console.log({2: data});
		
		res.cipherred = data.ciphertext.toString(CryptoJS.enc.Base64);
		res.iv 	= data.iv.toString(CryptoJS.enc.Base64);
		res.key = data.key.toString(CryptoJS.enc.Base64);
		
		console.log({3: res});
		
		var encryptText = res.cipherred.slice(0, -2) + res.iv;
		return encryptText;
	};
	
	
	decrypt = function (_key, _cipher) {
		var key = _key;
		var cipher = _cipher.slice(0, -24) + "==";
		var iv = _cipher.slice(-24);
		
		iv = CryptoJS.enc.Base64.parse(iv);
		key = CryptoJS.enc.Base64.parse(key);
		cipher = CryptoJS.enc.Base64.parse(cipher);
		
		var params = {
			ciphertext: cipher,
			salt: ""
		};
		var decrypted = CryptoJS.AES.decrypt(params, key, {iv: iv});
		var res = decrypted.toString(CryptoJS.enc.Utf8);
		return res;
	};
	
	_getIV = function (password, salt) {
		return CryptoJS.PBKDF2(password, salt, {keySize: 128 / 32, iterations: 234});
	};
	_getKey = function (password, salt) {
		return CryptoJS.PBKDF2(password, salt, {keySize: 256 / 32, iterations: 234});
	};
	
	setSessionPassword = function (val) {
		_currentSessionPassword = val;
	};
	getSessionPassword = function () {
		return _currentSessionPassword;
	};
	
	exports.encrypt = encrypt;
	exports.decrypt = decrypt;
	exports.getSessionPassword = getSessionPassword;
	exports.setSessionPassword = setSessionPassword;
});