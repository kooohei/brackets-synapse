/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 2, maxerr: 50 */
/*global define, $, brackets, Mustache, window, console, moment */
define(function (require, exports, module) {
	"use strict";

	var Dialogs = brackets.getModule("widgets/Dialogs");

	// Defaultr Dialog Class Names
	//	DIALOG_ID_ERROR             = "error-dialog";
	//	DIALOG_ID_INFO              = "error-dialog";
	//	DIALOG_ID_SAVE_CLOSE        = "save-close-dialog";
	//	DIALOG_ID_EXT_CHANGED       = "ext-changed-dialog";
	//	DIALOG_ID_EXT_DELETED       = "ext-deleted-dialog";
	//	DIALOG_ID_LIVE_DEVELOPMENT  = "live-development-error-dialog";
	//	DIALOG_ID_CHANGE_EXTENSIONS = "change-marked-extensions";


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
	 * @param		{string=} this is optional. default is 'Yes'
	 * @param		{string=} this is optional. default is 'No'
	 * @returns {object} $.Promise	a promise that will be resolved with "Yes" when the clicked Yes button
	 *								otherwise that with "No", Promise never rejected.
	 */
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
	
	

	exports.showYesNoModal = showYesNoModal;
});
