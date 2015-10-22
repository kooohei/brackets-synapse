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
	"SYNAPSE_RESET_KEYFILE_MESSAGE": "<p>Synapseはこのバージョンから鍵ファイルの保存方法が変わりました。</p><p>お手数ではありますが、サーバアカウント設定パネルより、SFTP接続で鍵認証をご利用とされているアカウントにおいては、鍵ファイルの再選択を行っていただきますようお願い申し上げます。</p>",

	"SYNAPSE_CTX_FILE_NEW": "新規ファイル",
	"SYNAPSE_CTX_DIRECTORY_NEW": "新規ディレクトリ",
	"SYNAPSE_CTX_FILE_REFRESH": "更新",
	"SYNAPSE_CTX_FILE_RENAME": "名称変更",
	"SYNAPSE_CTX_DELETE": "削除",

	"SYNAPSE_SETTING_TITLE": "サーバアカウント設定",
	"SYNAPSE_SETTING_PH_HOST": "ホスト",
	"SYNAPSE_SETTING_PH_PORT": "ポート番号",
	"SYNAPSE_SETTING_PH_USER": "ユーザー",
	"SYNAPSE_SETTING_PH_PASSWORD": "パスワード",
	"SYNAPSE_SETTING_PH_PRIVATEKEY": "秘密鍵ファイル",
	"SYNAPSE_SETTING_PH_PASSPHRASE": "秘密鍵パスフレーズ",
	"SYNAPSE_SETTING_PH_CURRENTDIR": "初期ディレクトリ",
	"SYNAPSE_SETTING_PH_EXCLUDEFILES": "除外ファイル・ディレクトリ (,区切り)",
	"SYNAPSE_SETTING_APPEND": "追加",
	"SYNAPSE_SETTING_UPDATE": "更新",
	"SYNAPSE_SETTING_CANCEL": "キャンセル",

	"SYNAPSE_LIST_TITLE": "サーバ一覧",
	"SYNAPSE_LIST_CONNECT": "接続",
	"SYNAPSE_LIST_DISCONNECT": "切断",
	"SYNAPSE_LIST_EDIT": "編集",
	"SYNAPSE_LIST_DELETE": "削除",
	
	"SYNAPSE_SECURE_WARNING_TITLE": "SECURITY WARNING",
	"SYNAPSE_SECURE_WARNING_MESSAGE": "<p> 現在設定ファイルは平文にて保存されています。</p><p>Synapseはサーバ設定ファイルの暗号化をおすすめします。</p><p>ここで設定したパスワードは保存されることはありませんのでBracketsが起動するたびにパスワードの入力が必要となります。</p>",
	"SYNAPSE_SECURE_WARNING_BTN1": "上記内容で設定",
	"SYNAPSE_SECURE_WARNING_BTN2": "後で",
	
	"SYNAPSE_DECRYPT_PASSWORD_TITLE": "パスワードを入力してください",
	"SYNAPSE_DECRYPT_PASSWORD_MESSAGE": "<p>Synapseは起動前に設定ファイルをロードするためのパスワードを求めています。</p>",
	
	"TWIPSY_EXPAND_WORKINGFILES": "Working Filesを表示する",
	"TWIPSY_COLLAPSE_WORKINGFILES": "Working Filesを非表示にする",
	"TWIPSY_TOGGLE_SERVERLIST": "サーバ一蘭の表示・非表示",
	"TWIPSY_TOGGLE_SERVERSETTING": "サーバ設定の表示・非表示",
	"TWIPSY_CLOSEMAIN": "メインパネルを閉じる"
});
