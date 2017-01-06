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

            //Check for file type
            if (getFileType(pathFull) != "tex") {
                //If not tex throw error with message
                throw new Error("Can't create PDF, open a .tex file.");
            }

            var cdCmd = cdCommand(pathFull),
                compileSequence = [ cdCmd, texCommand(pathFull) ];
            var exec = require('child_process').exec;

            setStatusBarText('Generating', "PDF");
            //Make log file to contain console		
            exec(cdCmd + ' && type NUL > ' + quote(getFileName(pathFull)) + ".vscodeLog");
            //Compile.
            exec(compileSequence.join(' && '), function (err, stdout, stderr) {
                errorCheck(pathFull, stdout,
                    () => bibtexCheck(stdout, exec, pathFull));
            });


        } catch (error) {
            //Catch error and show the user the message in the error
            vscode.window.showErrorMessage(error.message);
        }
    });

    function bibtexCheck(stdout, exec, pathFull) {
        console.log("Bibtex checking.");
        if (stdout.indexOf("There were undefined citations") > 0) {
            console.log("Fixing undefined citations.");
            var texCompileCmd = texCommand(pathFull);
            var bibSequence = [ 
                cdCommand(pathFull),
                bibCommand(pathFull),
                texCompileCmd,
                texCompileCmd
            ];
            console.log(bibSequence.join(' && '));
            exec(bibSequence.join(' && '), function (er, stdo, stde) {
                errorCheck(pathFull, stdo,
                    () => open(exec, getPDFName(pathFull))); 
            });
        } else {
            console.log("Just opening the file.");
            open(exec, getPDFName(pathFull));
        }
    }

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

    function errorCheck(pathFull, output, callback) {
        //If error is found in output, display an error to user
        console.log("Error checking.");
        if (String(output).toLowerCase().indexOf("error") > 0) {
            console.log("Found an error.");
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
                    var buffer = new Buffer(String(output));
                    fs.writeSync(fd, buffer, 0, buffer.length);
                    fs.close(fd);

                });

            }
            return;
        }
        callback();
    }

    function bibCommand(pathFull) {
        var latexCompile = vscode.workspace.getConfiguration('latexCompile'),
            bibCommand = [ latexCompile.bibCompiler,
                           quote(getFileName(pathFull))
            ].join(' ');
        return bibCommand;
    }

    function texCommand(pathFull) {
        var latexCompile = vscode.workspace.getConfiguration('latexCompile'),
            texCompileCmd = [ latexCompile.compiler,
                              quote(getFileNameAndType(pathFull)),
                              "-interaction=nonstopmode",
                              "-halt-on-error"].join(' ');
        return texCompileCmd;
    }

    function cdCommand(pathFull) {
        var changeDirectory = "cd "
        if(process.platform == "win322")
            changeDirectory = "cd /d ";
        return changeDirectory + quote(getFilePath(pathFull));
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