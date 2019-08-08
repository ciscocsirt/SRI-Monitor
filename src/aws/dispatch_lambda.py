import os
import boto3
s3 = boto3.client('s3')
batch = boto3.client('batch')
BATCH_SIZE=250
BUCKET_PREFIX="urls/"

def lambda_handler(event, context):
    if not 'JOBDEFINITION_ARN' in os.environ or not 'JOBQUEUE_ARN' in os.environ:
        print("SRIMonitor Error - Batch job details not found in environment variables.")
        return 

    if not 'BUCKET_NAME' in os.environ or os.environ['BUCKET_NAME'] == "":
        print("SRIMonitor Error - 'BucketName' not found in environment variables.")
        return

    BUCKET_NAME = os.environ['BUCKET_NAME']    

    for key in s3.list_objects(Bucket=BUCKET_NAME, Prefix=BUCKET_PREFIX, Delimiter="/")['Contents']:
        filename = key['Key']
        count = line_count(BUCKET_NAME, key['Key'])
        print(filename,'-->',count,'urls.')
        if count > 0:
            print("filename: " + filename)
            print(count)
            num_jobs = int(count)//BATCH_SIZE+1
            create_batch_job(BUCKET_NAME,filename,num_jobs,BATCH_SIZE)
        
# Use S3 Select to count the # of lines in a given file
def line_count(bucket,key):
    count_query = s3.select_object_content(
        Bucket=bucket,
        Key=key,
        ExpressionType='SQL',
        Expression="select count(*) from s3object s",
        InputSerialization = {'CSV': {}},
        OutputSerialization = {'CSV': {}}
    )
    
    #If the query is successful, the output will contain one record
    for event in count_query['Payload']:
        if 'Records' in event:
            count = event['Records']['Payload'].decode('utf-8')
            return int(count)
            
# Submit a download job to the AWS Batch environment.
# Array jobs will be used when a list of URLs need to be split into multiple jobs.
def create_batch_job(bucket,key,num_jobs,batch_size):
    job_details = {
        'jobName': 'scriptmon_job',
        'jobDefinition': os.environ['JOBDEFINITION_ARN'],
        'jobQueue': os.environ['JOBQUEUE_ARN'],
        'containerOverrides': { 'command': [bucket,key,str(batch_size)] },
        'retryStrategy': { 'attempts': 1 },
        'timeout': { 'attemptDurationSeconds': 300 }    
    }
    
    if num_jobs > 1:
        job_details['arrayProperties'] = { 'size': num_jobs }
    
    print(job_details)
    response = batch.submit_job(**job_details)
