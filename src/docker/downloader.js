const crypto = require('crypto');
const fetch = require('node-fetch');
const CustomErrors = require('./CustomErrors.js');

const DOWNLOAD_TIMEOUT = 3500; //in milliseconds

// Get MD5 hash of a string
const getMD5 = function(str) {
	return crypto.createHash('md5').update(str).digest("hex");
}

// Get SHA256 hash of a string
const getSHA256 = function(str) {
	return crypto.createHash('sha256').update(str).digest("hex");
}

// Download a file from the internet. 
const download = async function (url) {
	if (!url || url.trim() == "") 
		throw Error("Download Error: Empty URL String.");

        try {
                const response = await fetch(url,{"timeout":DOWNLOAD_TIMEOUT});
                const body = await response.text()	
		return {
			"url": url,
			"urlHash": getMD5(url),
			"bodyHash": getSHA256(body),
			"body": body
		};
        } catch(error) {
		throw new CustomErrors.DownloadError(url);
        }
}

module.exports = {
	download
}
