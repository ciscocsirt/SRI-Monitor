const aws = require('aws-sdk');
const s3 = new aws.S3();


var S3_BUCKET = "srimonitor-[id]"
const S3_PREFIX_FILE_STORE = "files/" //original subresource contents are stored.
const S3_PREFIX_ALERTS = "alerts/" //subresource modifications (alerts) are stored.
const S3_PREFIX_KVSTORE = "kvstore/" //url hash -> content hash kv store. 

// Set S3 Bucket Name
const setBucketName = async function(bucketName) {
	S3_BUCKET = bucketName;
}

// Download file from AWS S3.
const s3Download = async function (prefix,filename) {
	try {
        	s3Obj = await s3.getObject({Bucket: S3_BUCKET, Key: prefix + filename}).promise();
                return s3Obj.Body.toString('utf-8');
	} catch(err) {
		throw new Error("S3Download Error: " + err);	
	}

}

// Upload file to AWS S3.
const s3Upload = async function (prefix,filename,contents) {
	try {
	        return s3.putObject({
			Bucket: S3_BUCKET,
			Key: prefix + filename,
			Body: contents
			}).promise();
	} catch(err) {
		throw new Error("S3Upload Error: " + err);
	}
}


// Wrapper for saving analysis results to S3.
const uploadAlertsToS3 = async function (analysisResults) {
	return s3Upload(S3_PREFIX_ALERTS,
		analysisResults.sha256New,
		JSON.stringify(analysisResults));
}

// Wrapper for getting a list of javascript resources from S3.
const getResourcesFromS3 = async function(bucketKey,jobIndex,batchSize) {
        const resources = await s3Download('',bucketKey);
        if (!resources) return null;

        var resourceList = resources.split('\n');
        const startIndex = jobIndex*batchSize;
        const endIndex = startIndex + batchSize;

        return resourceList.slice(startIndex,endIndex);
}

// Check and update the KV Store.  
const kvUpsert = async function (file) {
        if (!file) 
		throw new Error("KVUpsert Error: null file passed to function.");

	//Get the kv record if it exists.
	kvHash = await s3Download(S3_PREFIX_KVSTORE,file.urlHash).catch(err => {console.log("here");});

	//Check 1: the kv record exists and did not change. Nothing to do.
	if (kvHash && kvHash == file.bodyHash && kvHash.length == 64) {
		 return null;
	}

	// Check 2: The kv record exists but the current file hash is different. Return the modified files for further analysis. 
        if (kvHash && kvHash != file.bodyHash && kvHash.length == 64 && file.bodyHash.length == 64) {
		//save the old contents
		const oldContents = await s3Download(S3_PREFIX_FILE_STORE,file.urlHash)
			.catch(err => {
				throw new Error("KVUpsert Error: Could not retrieve original file contents: " + S3_PREFIX_FILE_STORE + file.urlHash);
			});

		await Promise.all([
			s3Upload(S3_PREFIX_KVSTORE,file.urlHash,file.bodyHash), // Update KV Store with new record
			s3Upload(S3_PREFIX_FILE_STORE,file.urlHash,file.body) // Update file store with new contents
		]).catch(err => {
			throw new Error("KVUpsert Error: Could not update kvstore and file store with new data. " + err); 
		});

		const modified = {
			url: file.url,
			prevHash: kvHash,
			newHash: file.bodyHash,
			prevBody: oldContents, //old file contents
			newBody: file.body //new file contents
		};
	
		return modified;
        }

	// Check 3: The kv record does not exist. Create a new record.
	if (!kvHash) {
		await Promise.all([
                	s3Upload(S3_PREFIX_KVSTORE,file.urlHash,file.bodyHash), //create kv record 
                	s3Upload(S3_PREFIX_FILE_STORE,file.urlHash,file.body) //add file to file store
		]).catch(err => {
			throw new Error("KVUpsert Error: Could not create a new resource.  " + err);
		});
        }

        return null;
}

module.exports = {
	uploadAlertsToS3,
	getResourcesFromS3,
	kvUpsert,
        setBucketName
}
