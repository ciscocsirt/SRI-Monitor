const jsdiff = require('diff');
const beautify = require('js-beautify').js;
const CustomErrors = require('./CustomErrors.js');

// Beautify contents of a javascript file.
const beautifyJS = async function(contents) {
	return beautify(contents, {indent_size: 2});
}

// Compute the difference between two files.
const getFileChanges = async function(fileChanges) {
        if (!(fileChanges && fileChanges.prevBody && fileChanges.newBody))
		throw new Error("Analysis Error: Invalid object passed to file diff.");
	try {
		var details = {
			"url": fileChanges.url,
			"sha256Old": fileChanges.prevHash,
			"sha256New": fileChanges.newHash,
			"stats": {
				"partsAdded": 0,
				"partsRemoved": 0,
				"linesAdded": 0,
				"linesRemoved": 0,
			},
			"addedParts": [],
		};

		var prevBody = await beautifyJS(fileChanges.prevBody.toString("utf8")); //beautify old contents
		var newBody = await beautifyJS(fileChanges.newBody.toString("utf8")); //beautify new contents

		var diff = jsdiff.diffLines(prevBody,newBody,{newlineIsToken: true});
		diff.forEach(function(part) {
			if (part.added) {
				details.stats.partsAdded += 1;
				details.stats.linesAdded += part.count ? part.count : 0;
				details.addedParts.push(part.value);
			} else if (part.removed) {
				details.stats.partsRemoved += 1;
				details.stats.linesRemoved += part.count ? part.count: 0;
			}
		});
		return details;
	} catch(err) {
		throw new CustomErrors.AnalysisError(fileChanges.url);
	}
}

module.exports = {
	getFileChanges
}
