// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var vscode = require('vscode');
var fs = require('fs');
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {

    var pdflatex = vscode.commands.registerCommand('extension.latexCompile', function() {

        try {
            vscode.workspace.saveAll();
            var pathFull = vscode.window.activeTextEditor.document.fileName;

            if (vscode.workspace.getConfiguration('latexCompile').mainFile) {
                if (vscode.workspace.rootPath) {
                    pathFull = vscode.workspace.rootPath + "/" + vscode.workspace.getConfiguration('latexCompile').mainFile;
                } else {
                    throw new Error('Use of mainFile requires a folder to be opened');
                }
            }

            if (getFileType(pathFull) != "tex") {
                throw new Error("Can't create PDF, open a .tex file.");
            }

            //Child process that will invoke all shell commands
            var exec = require('child_process').exec;

            //Make log file to contain console		
            var cdCmd = cdCommand(pathFull);
            exec(cdCmd + ' && type NUL > ' + quote(getFileName(pathFull)) + ".vscodeLog");

            var compileSequence = [ cdCmd, texCommand(pathFull) ].join(' && ');
            console.log(compileSequence);
            setStatusBarText('Generating', "PDF");
            //Compile the LaTeX file; if citations are undefined, run
            //BibTeX and the compiler twice.
            exec(compileSequence, function (err, stdout, stderr) {
                errorCheck(pathFull, stdout, () => bibtexCheck(stdout, exec, pathFull));
            });
        } catch (error) {
            //Catch error and show the user the message in the error
            vscode.window.showErrorMessage(error.message);
        }
    });

    /**
     * Checks for undefined citations, then runs BibTeX, latexCompiler, latexCompiler
     * if there were undefined citations. Regardless, it opens the file.
     */
    function bibtexCheck(stdout, exec, pathFull) {
        // Check for undefined citations.
        let udCites = stdout.indexOf("There were undefined citations") >= 0,
            udRefs = stdout.indexOf("There were undefined references") >= 0;
        if (udCites || udRefs) {
            var texCompileCmd = texCommand(pathFull);
            if (udRefs && !udCites) {
                exec(texCommand, function (err, stdo, stderr) {
                    errorCheck(pathFull, stdo, () => open(exec, getPDFName(pathFull)));
                });
                return;
            }
            // Command sequence to fix citations. Note the cd command is necessary.
            var bibSequence = [ 
                cdCommand(pathFull),
                bibCommand(pathFull),
                texCompileCmd,
                texCompileCmd
            ].join(' && ');
            console.log(bibSequence);
            // Check compilation for errors, and open if none.
            exec(bibSequence, function (err, stdo, stderr) {
                errorCheck(pathFull, stdo, () => open(exec, getPDFName(pathFull))); 
            });
        } else {
            // Open PDF file.
            open(exec, getPDFName(pathFull));
        }
    }

    /**
     * Opens pdfFileName.
     */
    function open(exec, pdfFileName) {
        if (vscode.workspace.getConfiguration('latexCompile').openAfterCompile) {
            setStatusBarText('Launching', "PDF");
            if (process.platform == 'darwin') {
                exec('open ' + quote(pdfFileName));
            } else if (process.platform == 'linux') {
                exec('xdg-open ' + quote(pdfFileName));
            } else {
                exec(quote(pdfFileName));
            }
        } else {
            vscode.window.showInformationMessage('PDF Compilled at ' + path);
        }
    }

    /**
     * Checks if the compilation process contains the phrase "error."
     */
    function errorCheck(pathFull, stdout, callback) {
        //If error is found in output, display an error to user
        if (stdout.toLowerCase().indexOf("error") > 0) {
            //Show error
            var fileName = getFileName(pathFull);
            var path = getFilePath(pathFull);
            vscode.window.setStatusBarMessage("Can't create PDF, see " + fileName + ".vscodeLog", 12000);

            if (vscode.workspace.getConfiguration('latexCompile').openLogAfterError) {
                var consoleLogFile = vscode.Uri.file(path + fileName + ".vscodeLog");

                vscode.workspace.openTextDocument(consoleLogFile).then(function(d) {
                    vscode.window.showTextDocument(d);
                    // Open file, add console string, save file.
                    var fd = fs.openSync(path + fileName + ".vscodeLog", 'w+');
                    var buffer = new Buffer(stdout);
                    fs.writeSync(fd, buffer, 0, buffer.length);
                    fs.close(fd);

                });

            }
            return;
        }
        // Call the callback if successful.
        callback();
    }

    // Returns the appropriate BibTeX command for the given file.
    function bibCommand(file) {
        var latexCompile = vscode.workspace.getConfiguration('latexCompile'),
            bibCommand = [ latexCompile.bibCompiler,
                           quote(getFileName(file))
            ].join(' ');
        return bibCommand;
    }

    // Returns the appropriate latex compile command for the given file.
    function texCommand(file) {
        var latexCompile = vscode.workspace.getConfiguration('latexCompile'),
            texCompileCmd = [ latexCompile.compiler,
                              quote(getFileNameAndType(file)),
                              "-interaction=nonstopmode",
                              "-halt-on-error"].join(' ');
        return texCompileCmd;
    }

    // Returns the appropriate change-directory command for the given file.
    function cdCommand(file) {
        var changeDirectory = "cd "
        if(process.platform == "win322")
            changeDirectory = "cd /d ";
        return changeDirectory + quote(getFilePath(file));
    }    

    //Function to put quotation marks around path
    function quote(path) {
        return '"' + path + '"';
    }
    
    //Function to get the name of the PDF
    function getPDFName(file) {
        return getFilePath(file) + getFileName(file) + ".pdf";
    }
    //Function to get file name and type
    function getFileNameAndType(file) {
        var forwardSlash = file.lastIndexOf("/");
        var backSlash = file.lastIndexOf("\\");
        if (forwardSlash === -1 && backSlash === -1) {
            return file;
        }
        return file.substring((forwardSlash > backSlash) ? forwardSlash + 1 : backSlash + 1);
    }
    //Function to get only file type
    function getFileType(file) {
        var stringFile = getFileNameAndType(file);
        return stringFile.split(".")[1];
    }
    //Function to get only file name
    function getFileName(file) {
        var stringFile = getFileNameAndType(file);
        return stringFile.split(".")[0];
    }
    //Function to get only file path
    function getFilePath(file) {
        var path = file;
        path = path.match(/(.*)[\/\\]/)[1] || ''; // extract the directory from the path
        path += '/';
        return path;
    }
    context.subscriptions.push(pdflatex);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;

function setStatusBarText(what, docType) {
    var date = new Date();
    var text = what + ' [' + docType + '] ' + date.toLocaleTimeString();
    vscode.window.setStatusBarMessage(text, 1500);
}