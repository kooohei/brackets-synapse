/*
 * Copyright (c) 2014 Narciso Jaramillo. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define */

define({
	"APP_TITLE": "Synapse",

	"SYNAPSE_RESET_KEYFILE_TILTE": "NOTE",
	"SYNAPSE_RESET_KEYFILE_MESSAGE": "<p>You have set private key to the server setting.</p><p>however, Synapse deleted information for key just now.</p><p>It is because changed the save method for key file from this version.</p><p>I am sorry for the inconvenience, but please reselect that in the server setting panel.</p>",
	
	
	"SYNAPSE_CTX_FILE_NEW": "New File",
	"SYNAPSE_CTX_DIRECTORY_NEW": "New Directory",
	"SYNAPSE_CTX_FILE_REFRESH": "Refresh",
	"SYNAPSE_CTX_FILE_RENAME": "Rename",
	"SYNAPSE_CTX_DELETE": "Delete",

	"SYNAPSE_SETTING_TITLE": "Server Setting",
	"SYNAPSE_SETTING_PH_SETTING_NAME": "SETTING NAME",
	"SYNAPSE_SETTING_PH_HOST": "HOST",
	"SYNAPSE_SETTING_PH_PORT": "PORT",
	"SYNAPSE_SETTING_PH_USER": "USER",
	"SYNAPSE_SETTING_PH_PASSWORD": "PASSWORD",
	"SYNAPSE_SETTING_PH_PRIVATEKEY": "PRIVATE KEY FILE",
	"SYNAPSE_SETTING_PH_PASSPHRASE": "PASSPHRASE FOR KEY",
	"SYNAPSE_SETTING_PH_CURRENTDIR": "CURRENT DIRECTORY",
	"SYNAPSE_SETTING_PH_EXCLUDEFILES": "EXCLUDE FILES (, separated)",
	"SYNAPSE_SETTING_APPEND": "APPEND",
	"SYNAPSE_SETTING_UPDATE": "UPDATE",
	"SYNAPSE_SETTING_CANCEL": "CANCEL",

	"SYNAPSE_LIST_TITLE": "Server List",
	"SYNAPSE_LIST_CONNECT": "CONNECT",
	"SYNAPSE_LIST_DISCONNECT": "DISCONNECT",
	"SYNAPSE_LIST_EDIT": "EDIT",
	"SYNAPSE_LIST_DELETE": "DELETE",
	
	"SYNAPSE_SECURE_WARNING_TITLE": "SECURITY WARNING",
	"SYNAPSE_SECURE_WARNING_MESSAGE": "<p>&nbsp;The server settings have been store via the plain text so far. </p><p>I recommended to do encryption to the settings.<br>(The password is just one for all settings)</p><p>However, You must be input to password when started synapse at every time.</p><p>The password is never stored.</p>",
	"SYNAPSE_SECURE_WARNING_BTN1": "Now I do",
	"SYNAPSE_SECURE_WARNING_BTN2": "Later",
	
	"SYNAPSE_DECRYPT_PASSWORD_TITLE": "PASSWORD FOR THE DECRYPT",
	"SYNAPSE_DECRYPT_PASSWORD_MESSAGE": "<p>Settings must have been crypto before the synapse is activated.</p>",

	"TWIPSY_SYNAPSE_SETTING": "SYNAPSE Setting",
	"TWIPSY_EXPAND_WORKINGFILES": "Expand Working Files",
	"TWIPSY_COLLAPSE_WORKINGFILES": "Collapse Working Files",
	"TWIPSY_TOGGLE_SERVERLIST": "Toggle Server List Panel",
	"TWIPSY_TOGGLE_SERVERSETTING": "Toggle Server Setting Panel",
	"TWIPSY_CLOSEMAIN": "Close Synapse Main Panel"
	
});
