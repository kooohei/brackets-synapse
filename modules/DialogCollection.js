/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	"use strict";
	
	var Dialogs = brackets.getModule("widgets/Dialogs");
	
	
	/**
	 * Static Vars
	 */
	var Yes = "Confirm_Dialog_Button_Yes",
		No = "Confirm_Dialog_Button_No";
	
	/**
	 * Methods
	 */
	var showYesNoModal;
	
	
	/**
	 * This dialog will ask whether to yes or no.
	 *
	 * @param   {string} className
	 * @param   {string} title
	 * @param   {string} message
	 * @returns {object} $.Promise	a promise that will be resolved with "Yes" when the clicked Yes button
	 *								otherwise that with "No", Promise never rejected.
	 */
	showYesNoModal = function (className, title, message) {
		var promise = new $.Deferred();
		var btns = [{
			className: Dialogs.DIALOG_BTN_CLASS_PRIMARY,
			id: Yes,
			text: "Yes"
		}, {
			className: Dialogs.DIALOG_BTN_CLASS_NORMAL,
			id: No,
			text: "No"
		}];
		var dlg = Dialogs.showModalDialog(className, title, message, btns, true)
			.done(function (id) {
				var res = "";
				if (id === Yes) {
					res = "Yes";
				} else {
					res = "No";
				}
				promise.resolve(res);
			});
		return promise.promise();
	};
	
	exports.showYesNoModal = showYesNoModal;
});