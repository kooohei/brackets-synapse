# Brackets Synapse
Synapse is an Adobe Brackets extension. You will be provided with useful functions such as you can edit a text file directly on a remote server. May the code be with you :-)

## Extension Installation ##

1. Choose ** File ** > ** Extension Manager **
2. Search "synapse" via the search textbox.
3. Click the "Install" button.

[Watch the Extension Installation video](https://www.youtube.com/watch?v=T3YtrGC52Qo)

## Usage ##

### OFFLINE ###

#### Append Server setting ####

Register your FTP, SFTP account to the extension.

1. Click the "+" buttonon the top of the panel.
2. You should input the Host, Port, User and Password.
3. Switch the forms after you have chosen FTP or SFTP.
4. **FTP:** Any empty input is not allowed.<br>**SFTP:** choose if the auth method should be KEY or PASSWORD. Select a private key file and input the passphrase if needed.
	 
**NOTE**

For the private key file OpenSSH format is supported.
"Current Directory" (optional): initial directory upon the connection.
"Exclude files" (optional): CSV file with filepaths to be ignored by Threeview.

["Append server settings" video](https://www.youtube.com/watch?v=gvui8i0a9uI)

["Exclude files" video](https://www.youtube.com/watch?v=DCNotAcjE7A)

#### Update Server setting ####

1. Click to "Show Server list" icon on the left of the "Append Server settings" icon.
2. The list of your FTP accounts will be displayed into the Server List panel.
3. Click the "Edit" button.
4. Click "Update" when you're finished.

[Update Server Settings video](https://www.youtube.com/watch?v=EqJhxjOpp78)


### ONLINE ###

#### Refresh files ####

1. Open the context menu by right clicking on the target folder.
2. Click "Refresh"

[Refresh Files video](https://www.youtube.com/watch?v=qCBMTnw7HL4)

#### Rename and Delete ####

** Rename file, directory **
1. Open the context menu by right clcking on the target node.
2. Click "Rename"

** Delete file, directory **
1. Open the context menu by right clcking on the target node.
2. Click "Delete"

[Rename/Delete files video](https://www.youtube.com/watch?v=2kSuH4R2MtA)

#### Create new item ####

1. Open the context menu by right clicking on the directory you want to append a node.
2. Click "New Directory" in "New Files"
3. Enter a name for the node.

[Create new item video](https://www.youtube.com/watch?v=3ZKN_5w3cs4)


## Troubleshooting ##

If the server you're accessing contains more than 30,000+ files you'll get this error due to Bracket's limits:

<blockquote>This project contains more than 30,000 files. Features that operate across multiple files may be disabled or behave as if the project is empty.</blockquote>
