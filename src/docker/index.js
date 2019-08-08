const awsWrapper = require('./aws-wrapper.js');
const downloader = require('./downloader.js'); 
const analysis   = require('./analysis.js');
const CustomErrors = require('./CustomErrors.js');

//track failures - usually non-existent files or slow connections
var failed = {
	"DownloadError":[],
	"AnalysisError":[]
};

var success = {
	"Modified":[], //resource was modified (ie. an alert will be generated)
	"Other":[] //the resources is new or is unchanged.
};


var alerts = [];

(async () => {
	var args = process.argv.splice(2);
	if (!args || args.length == 0) return;

	const bucketName = args[0]
	const bucketKey = args[1]
	const batchSize = parseInt(args[2]) //# of lines to get
	var jobIndex = 0 //starting position
	if (args.length  > 3)
		jobIndex = args[3]

	awsWrapper.setBucketName(bucketName);
	const resourceList = await awsWrapper.getResourcesFromS3(bucketKey,jobIndex,batchSize);
	const results = await Promise.all(resourceList.map(processURL));

	console.log("------ Failed Downloads ---- ");
	console.log(JSON.stringify(failed['DownloadError']));
	console.log("------ Failed Analysis ---- ");
	console.log(JSON.stringify(failed['AnalysisError']));
	console.log("------ Modified Resources ---- ");
	console.log(JSON.stringify(success['Modified']));
        console.log("------ New/Unchanged Resources ---- ");
        console.log(JSON.stringify(success['Other']));
})();

async function processURL(url) {
	try {	
		const contents = await downloader.download(url); 
		const kvUpsert = await awsWrapper.kvUpsert(contents);

		if (kvUpsert) {
			const alert = await analysis.getFileChanges(kvUpsert);
			const uploadResults = await awsWrapper.uploadAlertsToS3(alert);
			alerts.push(alert);
			success['Modified'].push(url);
		} else {
			success['Other'].push(url);
		}
	} catch(err) {
		if (err instanceof CustomErrors.DownloadError) {
			failed['DownloadError'].push(url);
		} else if (err instanceof CustomErrors.AnalysisError) {
			failed['AnalysisError'].push(url);
		} else {
			failed['OtherError'].push(url);
		}
	}
}
