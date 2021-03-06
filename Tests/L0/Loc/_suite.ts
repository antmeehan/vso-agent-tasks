/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');
import fs = require('fs');

describe('Loc String Suite', function() {

	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});
    
	it('Find invalid message key in task.json', (done) => {
		this.timeout(1000);
		
		var tasksRootFolder =  path.resolve(__dirname, '../../../Tasks');
		var jsons: string[] = [];
		fs.readdirSync(tasksRootFolder).forEach(folderName=> {
			if(fs.statSync(path.join(tasksRootFolder, folderName)).isDirectory()) { 
				jsons.push(path.join(tasksRootFolder, folderName, "task.json"));
			}
		})
        // The Common folder does not get copied under _build so scan the source folder instead.
        var commonFolder = path.resolve(__dirname, "../../../../Tasks/Common");
        fs.readdirSync(commonFolder).forEach(folderName => {
            var moduleFolder = path.join(commonFolder, folderName);
            var moduleJson = path.join(moduleFolder, "module.json");
            if (fs.statSync(moduleFolder).isDirectory() && fs.existsSync(moduleJson)) {
                jsons.push(moduleJson);
            }
        })

		for(var i = 0; i < jsons.length; i++) {
			var json = jsons[i];
			var obj = require(json);
			if(obj.hasOwnProperty('messages')) {
				for(var key in obj.messages) {
					var jsonName = path.relative(tasksRootFolder, json);
					assert(key.search(/\W+/gi) < 0, ('(' + jsonName +')' + 'messages key: \'' + key +'\' contain non-word characters, only allows [a-zA-Z0-9_].'));
					if(typeof(obj.messages[key]) === 'object') {
						assert(obj.messages[key].loc, ('(' + jsonName +')' + 'messages key: \'' + key +'\' should have a loc string.'));
						assert(obj.messages[key].loc.toString().length >= 0, ('(' + jsonName +')' + 'messages key: \'' + key +'\' should have a loc string.'));
						assert(obj.messages[key].fallback, ('(' + jsonName +')' + 'messages key: \'' + key +'\' should have a fallback string.'));
						assert(obj.messages[key].fallback.toString().length > 0, ('(' + jsonName +')' + 'messages key: \'' + key +'\' should have a fallback string.'));
					}
					else if(typeof(obj.messages[key]) === 'string') {
						assert(obj.messages[key].toString().length > 0, ('(' + jsonName +')' + 'messages key: \'' + key +'\' should have a loc string.'));
					} 
        		}
			}
		}
		
		done();
	})
	
	it('Find missing string in .ts', (done) => {
		this.timeout(1000);
		
		var tasksRootFolder =  path.resolve(__dirname, '../../../Tasks');
		
		var taskFolders: string[] = [];
		fs.readdirSync(tasksRootFolder).forEach(folderName => {
			if(fs.statSync(path.join(tasksRootFolder, folderName)).isDirectory()) { 
				taskFolders.push(path.join(tasksRootFolder, folderName));	
			}
		})
		
		var testFailed: boolean = false;
		
		for(var i = 0; i < taskFolders.length; i++) {
			var locStringMismatch: boolean = false;
			var taskFolder = taskFolders[i];
			
			var taskjson = path.join(taskFolder, 'task.json');
			var task = require(taskjson);
			
			if (task.execution['Node']) {
				
				var tsFiles = fs.readdirSync(taskFolder).filter(file => {
					return file.search(/\.ts$/) > 0;
				})
				
				var locStringKeys: string[] = [];
				tsFiles.forEach(tsFile => {
					var ts = fs.readFileSync(path.join(taskFolder, tsFile)).toString().replace(/\r\n/g,'\n').replace(/\r/g,'\n');
					var lines: string[] = ts.split('\n');
					lines.forEach(line => {
						// remove all spaces.
						line = line.replace(/ /g, '');
						
						var regx = /tl\.loc\(('(\w+)'|"(\w+)")/i;
						var res = regx.exec(line);
						if(res) {
							var key;
							if(res[2]) {
								key = res[2];
							}
							else if(res[3]) {
								key = res[3];
							}

							locStringKeys.push(key);
						}	
					});
				})
				
				var locStringKeysFromJson: string[] = [];
				if(task.hasOwnProperty('messages')) {
					for(var key in task.messages) {
            			locStringKeysFromJson.push(key);
        			}
				}
				
				var missingLocStringKeys: string[] = [];
				locStringKeys.forEach(locKey => {
					if(locStringKeysFromJson.indexOf(locKey) === -1) {
						locStringMismatch = true;
						missingLocStringKeys.push(locKey);
					}
				})
				
				if(locStringMismatch) {
					testFailed = true;
					console.error('add missing loc string keys to messages section for task: ' + path.relative(tasksRootFolder, taskjson));
					console.error(JSON.stringify(missingLocStringKeys));
				}
			}
			else {
				//console.info('Skip task without .js implementation.');
			}
		}
		
		assert(!testFailed, 'there are missing loc string keys in task.json.');
		
		done();
	})

    it('Find missing string in .ps1/.psm1', (done) => {
        this.timeout(10000);

        // Push all task folders onto the stack.
        var folders: string[] = [];
        var tasksRootFolder =  path.resolve(__dirname, '../../../Tasks');
        fs.readdirSync(tasksRootFolder).forEach(folderName => {
            var folder = path.join(tasksRootFolder, folderName);
            if (folderName != 'Common' && fs.statSync(folder).isDirectory()) {
                folders.push(folder);
            }
        })

        // Push each Common module folder onto the stack. The Common folder does not
        // get copied under _build so scan the source copy instead.
        var commonFolder = path.resolve(__dirname, "../../../../Tasks/Common");
        fs.readdirSync(commonFolder).forEach(folderName=> {
            var folder = path.join(commonFolder, folderName);
            if (fs.statSync(folder).isDirectory()) {
                folders.push(folder);
            }
        })

        folders.forEach(folder => {
            // Load the task.json or module.json if one exists.
            var jsonFile = path.join(folder, 'task.json');
            var obj = { "messages": { } }
            if (fs.existsSync(jsonFile) || fs.existsSync(jsonFile = path.join(folder, "module.json"))) {
                obj = require(jsonFile);
            } else {
                jsonFile = ''
            }

            // Recursively find all PS files.
            var psFiles: string[] = [];
            var folderStack: string[] = [ folder ];
            while (folderStack.length > 0) {
                folder = folderStack.pop();
                if (path.basename(folder).toLowerCase() == "ps_modules") { continue } // Skip nested ps_modules folder.
                fs.readdirSync(folder).forEach(itemName => {
                    var itemPath = path.join(folder, itemName);
                    if (fs.statSync(itemPath).isDirectory()) {
                        folderStack.push(itemPath);
                    } else if (itemPath.toLowerCase().search(/\.ps1$/) > 0
                        || itemPath.toLowerCase().search(/\.psm1$/) > 0) {
                        psFiles.push(itemPath);
                    }
                })
            }

            psFiles.forEach(psFile => {
                var ps = fs.readFileSync(psFile).toString().replace(/\r\n/g,'\n').replace(/\r/g,'\n');
                var lines: string[] = ps.split('\n');
                lines.forEach(line => {
                    if (line.search(/Get-VstsLocString/i) > 0) {
                        var result = /Get-VstsLocString +-Key +('[^']+'|"[^"]+"|[^ )]+)/i.exec(line);
                        if (!result) {
                            assert(false, 'Bad format string in file ' + psFile + ' on line: ' + line);
                        }

                        var key = result[1].replace(/['"]/g, "");
                        assert(
                            obj.hasOwnProperty('messages') && obj.messages.hasOwnProperty(key),
                            "Loc resource key not found in task.json/module.json. Resource key: '" + key + "', PS file: '" + psFile + "', JSON file: '" + jsonFile + "'.");
                    }
                });
            })
        })
        done();
    })
});
