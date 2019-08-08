class DownloadError extends Error {
	constructor(url) {
		super(url);
		this.name = this.constructor.name;

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

class AnalysisError extends Error {
	constructor(url) {
		super(url);
		this.name = this.constructor.name;
	
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

module.exports = {
	DownloadError,
	AnalysisError
};
