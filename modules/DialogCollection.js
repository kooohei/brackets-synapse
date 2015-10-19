
/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console */
define(function (require, exports, module) {
	"use strict";
	
	/* region Modules */
	var Dialogs = brackets.getModule("widgets/Dialogs");
	var Strings = require("strings");
	/* endregion */
	
	/* region Public vars */
	var Yes = "Confirm_Dialog_Button_Yes",
			No = "Confirm_Dialog_Button_No";
	/* endregion */
	
	/* region Public Methods */
	var showAlert,
			showYesNoModal;
	/* endregion */
	
	/* Public Methods */
	
	showYesNoModal = function (className, title, message, yesBtnText, noBtnText) {
		var yesText = yesBtnText || "Yes";
		var noText = noBtnText || "No";
		var deferred = new $.Deferred();
		var btns = [{
			className: Dialogs.DIALOG_BTN_CLASS_PRIMARY,
			id: Yes,
			text: yesText
		}, {
			className: Dialogs.DIALOG_BTN_CLASS_NORMAL,
			id: No,
			text: noText
		}];
		var dlg = Dialogs.showModalDialog(className, title, message, btns, true)
			.done(function (id) {
				var res = "";
				if (id === Yes) {
					res = yesText;
				} else {
					res = noText;
				}
				deferred.resolve(res);
			});
		return deferred.promise();
	};
	
	showAlert = function (title, message) {
		var d = new $.Deferred();
		var btns = [{className: Dialogs.DIALOG_BTN_CLASS_PRIMARY,
								id: "OK",
								text: "OK"}];
		var dlg = Dialogs.showModalDialog("alert", title, message, btns, true)
			.done(function (id) {
				d.resolve();
			});
		return d.promise();
	};
	
	exports.showYesNoModal = showYesNoModal;
	exports.showAlert = showAlert;
});
