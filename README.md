# Brackets Synapse
Synapse is Adobe Brackets extension. it will be provided useful function to you. that can be editing text file on remote server directly. May the code with you :-)

## Extension Install ##

1. Choose ** File ** > ** Extension Manager **
2. Search "synapse" via textbox for search.
3. Click "Install" button.

[Watch movie Extension Install](https://www.youtube.com/watch?v=T3YtrGC52Qo)

## Usage ##

### OFFLINE ###

#### Append Server setting ####

Register the your FTP, SFTP account to the extension.

1. Click "+" button. there is top of the panel.
2. You must be input to Host, Port User, Password.
3. Switch the forms after Choose protocol the FTP or SFTP
4. **FTP:** Input to the forms. "Host", "Port", "User" and "Password" is not allowed empty value.<br>**SFTP:** choose auth method whether KEY of PASSWORD, you should be selected private key file and should be input to passphrase if it need.
	 
**NOTE**

Private key file is supported OpenSSH format.
"Current Directory" is optional, this property is initial base path when the connect to server.
Exclude files is file names expressed CSV format, that is optional. 
Treeview will ignore the file if there is same file name in the Exclude files.

[Watch movie for Append server setting](https://www.youtube.com/watch?v=gvui8i0a9uI)

[Watch movie for Exclude files demo](https://www.youtube.com/watch?v=DCNotAcjE7A)

#### Update Server setting ####

1. Click to "Show Server list" icon, that is left of "Append Server setting" icon.
2. The list of your FTP accounts displayed into the Server list panel.
3. Click to "Edit" button then displayed forms panel for update.
4. Click to "Update" button when the input finished.

[Watch for movie Update Server setting](https://www.youtube.com/watch?v=EqJhxjOpp78)


### ONLINE ###

#### Refresh files ####

1. Display the context menu by Right clicking on the target folder.
2. Click to "Refresh"

[Watch movie for Refresh files](https://www.youtube.com/watch?v=qCBMTnw7HL4)

#### Rename and Delete ####

** Rename file, directory **
1. Display the context menu by right clcking on the target node.
2. Click to "Rename"

** Delete file, directory **
1. Display the context menu by right clcking on the target node.
2. Click to "Delete"

[Watch movie for Rename, Delete files](https://www.youtube.com/watch?v=2kSuH4R2MtA)

#### Create new item ####

1. Display the context menu by right clicking on the base directory for append node.
2. Click "New Directory" of "New Files"
3. Enter new name to node.

[Watch movie for Create new item](https://www.youtube.com/watch?v=3ZKN_5w3cs4)


## Troubleshooting ##

While accessing the remote FTP server, it may often contain more than 30,000+ files. This is a limit for out of bounds in Brackets Editor, so you may see the following error:

<blockquote>This project contains more than 30,000 files. Features that operate across multiple files may be disabled or behave as if the project is empty. Read more about working with large projects.</blockquote>
