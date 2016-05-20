/*
 * ENG1003 Assignment Uploader Brackets extension
 *
 * Written by Nawfal Ali
 *
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2015  Monash University
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

define(function (require, exports, module) {
    var systemSettings = {
        server       : 'https://eng1003.eng.monash.edu/',
        teamDir      : '',
        userName     : '',
        updateTeamDir: '',
        updateUserDir: 'checked',
        assignment   : '',
        rememberMe   : 'checked'
    };
    // firstRun i used to show the settings window only if the user hits the upload without checking his settings 
    var firstRun       = true;
    // System Strings
    var strings        = {
        SERVER_NOT_FOUND   : 'Please Enter Server Address',
        USER_NOT_FOUND     : 'Please Enter User Name',
        TEAM_NOT_FOUND     : 'Please Enter Team Directory Name',
        SETTINGS_MENU_TITLE: 'ENG1003 Uploader Settings',
        UPLOAD_SHORTCUT    : 'Ctrl-Shift-U',
        UPLOAD_MENU_TITLE  : 'ENG1003 Uploader',
        STORAGE_KEY        : 'Eng1003Uploader.Monash',
    };

    //Required Modules
    var CommandManager = brackets.getModule("command/CommandManager"),
        Menus          = brackets.getModule("command/Menus"),
        Dialogs        = brackets.getModule("widgets/Dialogs"),
        DefaultDialogs = brackets.getModule("widgets/DefaultDialogs"),
        AppInit        = brackets.getModule("utils/AppInit");
    DocumentManager    = brackets.getModule("document/DocumentManager");
    ExtensionUtils     = brackets.getModule("utils/ExtensionUtils");
    directory          = brackets.getModule("filesystem/Directory");
    FileSystem         = brackets.getModule("filesystem/FileSystem");
    var ProjectManager      = brackets.getModule("project/ProjectManager");

    var mainDialog  = require("text!dialog.html");
    toolbarUploader = require("text!toolbar-uploader.html");
    codeUploader    = require('codeuploader');


    // System log function
    // To console; can be improved to log to file system
    function log(s) {
        console.log("[ENG1003Uploader] " + s);
    }

    // This function handles the settings windows
    function handleSettings() {
        // Show the settings window
        Dialogs.showModalDialogUsingTemplate(Mustache.render(mainDialog, systemSettings), false);
        // Get an instance to register handlers 
        var $dlg = $(".eng1003setting-dialog.instance");
        $dlg.find(".dialog-button[data-button-id='cancel']").on("click", handleCancel);
        $dlg.find(".dialog-button[data-button-id='ok']").on("click", handleOk);

        // Update the Assignment List Box.  Select the first option by default.
        var chosenAssignment = $("#assignment option:first").val();
        if (systemSettings.assignment) {

            // Or use the user's saved preference. 
            chosenAssignment = systemSettings.assignment;
        }
        $dlg.find("#assignment").val(chosenAssignment);

        // if the user hits the cancel, this function closes the settings window
        function handleCancel() {
            Dialogs.cancelModalDialogIfOpen("eng1003setting-dialog");
        }

        // if the user selects the UPLOAD button, 
        function handleOk() {
            // Data validation
            var $dlg              = $(".eng1003setting-dialog.instance");
            systemSettings.server = $dlg.find("#server").val();
            if (systemSettings.server === '') {

                Dialogs.showModalDialog(DefaultDialogs.DIALOG_ID_INFO, "ENG1003 Uploader", strings.SERVER_NOT_FOUND);
                return;
            }
            systemSettings.teamDir = $dlg.find("#teamDir").val();
            if (systemSettings.teamDir === '') {

                Dialogs.showModalDialog(DefaultDialogs.DIALOG_ID_INFO, "ENG1003 Uploader", strings.TEAM_NOT_FOUND);
                return;
            }
            systemSettings.userName = $dlg.find("#userName").val();
            if (systemSettings.userName === '') {

                Dialogs.showModalDialog(DefaultDialogs.DIALOG_ID_INFO, "ENG1003 Uploader", strings.USER_NOT_FOUND);
                return;
            }
            // No need to show the settings window again
            firstRun                     = false;
            systemSettings.updateTeamDir = $dlg.find("#updateTeamDir:checked").val();
            systemSettings.updateUserDir = $dlg.find("#updateUserDir:checked").val();
            systemSettings.rememberMe    = $dlg.find("#rememberMe:checked").val();
            systemSettings.assignment    = $dlg.find("#assignment").val();
            //Save/Remove Settings to Local Storage
            setSettingsToStorage();
            //Upload the Document
            UploadCurrentDocument();
            //Close the currnet Window
            Dialogs.cancelModalDialogIfOpen("eng1003setting-dialog");
        }
    }

    // Save/Remove Settings to Local Storage
    function setSettingsToStorage() {
        if (systemSettings.rememberMe === 'checked') {
            localStorage.setItem(strings.STORAGE_KEY, JSON.stringify(systemSettings));
        } else {
            localStorage.removeItem(strings.STORAGE_KEY);
        }
    }

    // This function is responsable for uploading the current document to the server
    function UploadCurrentDocument() {

        if (firstRun) {
            firstRun = false;
            handleSettings();
            return;
        }

        // If there is a missing parameter , call the settings window again
        if (systemSettings.server === '') {
            handleSettings();
            return;
        }
        if (systemSettings.teamDir === '') {
            handleSettings();
            return;
        }
        if (systemSettings.userName === '') {
            handleSettings();
            return;
        }

        var projectRoot = ProjectManager.getProjectRoot().fullPath;

        console.log(projectRoot);
        var uploader          = new codeUploader(systemSettings, Dialogs, DefaultDialogs);
        var listFiles         = [];
        var listFilesFullPath = [];
        getFileList(projectRoot, 1);


        function getFileList(fileName, level) {
            var directory = FileSystem.getDirectoryForPath(fileName);
            directory.getContents(function (err, entries) {
                if (err) {
                    console.log(err);
                } else {
                    entries.forEach(function (entry) {
                        console.log('Entry: _isDir' + entry._isDirectory + '   entry Path' + entry._path);
                        if (entry._isDirectory) {

                            getFileList(entry._path, (level + 1));
                        }
                        else {
                            listFiles.push(getParentFilename(entry._path, level));
                            listFilesFullPath.push(entry._path);
                        }
                    });
                }
            });
            if (level === 1) {
                console.log(listFiles);
                uploader.uploadToWebsite(listFiles, listFilesFullPath);
            }
        }
    }


    function getParentFilename(fullName, depth) {
        return (fullName.split('/').slice(-depth).join('/') );
    }

    // Get saved settings from localStorage; if any....
    function getSettingsFromStorage() {
        var savedSettings = localStorage.getItem(strings.STORAGE_KEY);
        log(savedSettings);
        if (savedSettings !== null) {
            systemSettings = JSON.parse(savedSettings);
        }
    }

    // Main Function
    AppInit.appReady(function () {
        //Load CSS file
        ExtensionUtils.loadStyleSheet(module, "css/style.css");
        log("Upload Assignment Extenstion");
        getSettingsFromStorage();

        // Settings Window and Shortcut
        var menu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
        menu.addMenuDivider();
        var SETTINGS_EXECUTE = "ENG1003Uploader.settings";
        CommandManager.register(strings.SETTINGS_MENU_TITLE, SETTINGS_EXECUTE, handleSettings);
        menu.addMenuItem(SETTINGS_EXECUTE);

        // Upload Command and Shortcut
        var UPLOADER_EXECUTE = "ENG1003Uploader.upload";
        CommandManager.register(strings.UPLOAD_MENU_TITLE, UPLOADER_EXECUTE, UploadCurrentDocument);
        menu.addMenuItem(UPLOADER_EXECUTE, strings.UPLOAD_SHORTCUT);

        // Right-click handler
        var UPLOADER_EXECUTE_RIGHTCLICK = "ENG1003Uploaderright.upload";
        CommandManager.register(strings.UPLOAD_MENU_TITLE, UPLOADER_EXECUTE_RIGHTCLICK, UploadCurrentDocument);
        Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).addMenuDivider();
        Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).addMenuItem(UPLOADER_EXECUTE_RIGHTCLICK);

        // Toolbar Cloud icon for uploading
        $("#main-toolbar .buttons").append(toolbarUploader);
        $("#toolbar-uploader").on("click", UploadCurrentDocument);
    });
});
