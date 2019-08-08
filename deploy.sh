#!/bin/bash

AWS_PROFILE=
AWS_REGION=
BATCH_COMPUTE_EC2_SUBNET="172.31.0.0/20"
BATCH_COMPUTE_VPC_CIDR="172.31.0.0/16"
STACK_NAME=SubResourceIntegrityMonitor


if [ "$AWS_REGION" != "" ]
then
  AWS_REGION_STR="--region ${AWS_REGION}"
else
  AWS_REGION_STR=""
fi

if [ "$AWS_PROFILE" != "" ]
then
  AWS_PROFILE_STR="--profile ${AWS_PROFILE}"
else
  AWS_PROFILE_STR=""
fi


FIRST_RUN=0
BUCKET_NAME="$(aws ${AWS_PROFILE_STR} ${AWS_REGION_STR} s3api list-buckets --query 'Buckets[?starts_with(Name, `srimonitor`) == `true`].Name' --output text)"
if [ "$BUCKET_NAME" == "" ]
then
  FIRST_RUN=1
  BUCKET_NAME="srimonitor-$(date +%s)"
fi

INFO=$(tput setaf 3)
FAILURE=$(tput setaf 1)
SUCCESS=$(tput setaf 2)
WARNING=$(tput setaf 4)
END=$(tput sgr0)

#################################################################################

if [ $FIRST_RUN -eq 1 ]; then

		printf "${INFO}Mounting S3 Bucket${END}\n"
		printf "${INFO}....Please wait.${END}\n"
		aws ${AWS_PROFILE_STR} ${AWS_REGION_STR} s3 mb s3://${BUCKET_NAME} >> srimonitor.log 2>&1

		if [ $? -ne 0 ]
		then
			printf "${FAILURE}....Failed to mount ${BUCKET_NAME} S3 Bucket! See srimonitor.log for details.${END}\n"
			exit
		else
			printf "${SUCCESS}....Successfully mounted ${BUCKET_NAME} S3 Bucket!${END}\n"
		fi

		#################################################################################

		printf "${INFO}Adding S3 LifeCycle Policy${END}\n"
		printf "${INFO}....Please wait.${END}\n"
		#3 Create 30 day expiration for results
		aws ${AWS_PROFILE_STR} ${AWS_REGION_STR} s3api put-bucket-lifecycle \
			--bucket ${BUCKET_NAME}  \
			--lifecycle-configuration '{"Rules":[{"ID":"PurgeAfter30Days","Prefix":"alerts/","Status":"Enabled","Expiration":{"Days":30}}]}' >> srimonitor.log 2>&1
		if [ $? -ne 0 ]
		then
			printf "${FAILURE}....Failed to add S3 Bucket LifeCycle Policy! See srimonitor.log for details.${END}\n"
			exit
		else
			printf "${SUCCESS}....Successfully added S3 Bucket LifeCycle Policy!${END}\n"
		fi

fi
#################################################################################

printf "${INFO}Uploading URLs to S3${END}\n"
printf "${INFO}....Please wait.${END}\n"
aws ${AWS_PROFILE_STR} ${AWS_REGION_STR} s3 cp urls/ s3://${BUCKET_NAME}/urls --recursive --exclude '*' --include "*.csv" >> srimonitor.log 2>&1
if [ $? -ne 0 ]
then
    printf "${FAILURE}....Failed to upload urls (to monitor) to the S3 Bucket! See srimonitor.log for details.${END}\n"
    exit
else
    printf "${SUCCESS}....Successfully uploaded urls (to monitor) to the S3 Bucket!${END}\n"
fi

#################################################################################

printf "${INFO}Create Packaged CloudFormation Template${END}\n"
printf "${INFO}....Please wait.${END}\n"
aws ${AWS_PROFILE_STR} ${AWS_REGION_STR} cloudformation package \
    --template-file template.yaml \
    --s3-bucket ${BUCKET_NAME} \
    --s3-prefix src \
    --output-template-file packaged-template.yaml >> srimonitor.log 2>&1
if [ $? -ne 0 ]
then
    printf "${FAILURE}....Failed to create packaged CloudFormation template! See srimonitor.log for details.${END}\n"
    exit
else
    printf "${SUCCESS}....Successfully created packaged CloudFormation template!${END}\n"
fi

#################################################################################

printf "${INFO}Deploying AWS CloudFormation Template${END}\n"
printf "${INFO}....Please wait.${END}\n"
aws ${AWS_PROFILE_STR} ${AWS_REGION_STR} cloudformation deploy \
    --stack-name $STACK_NAME \
    --template-file packaged-template.yaml \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides EC2SUBNET=$BATCH_COMPUTE_EC2_SUBNET VPCRANGE=$BATCH_COMPUTE_VPC_CIDR BUCKETNAME=$BUCKET_NAME >> srimonitor.log 2>&1
if [ $? -eq 1 ]
then
    printf "${FAILURE}....Failed to deploy CloudFormation template! See srimonitor.log for details.${END}\n"
    exit
else
    printf "${SUCCESS}....Successfully deployed CloudFormation template!${END}\n"
fi

#################################################################################

if [ $FIRST_RUN -eq 1 ]; then
		printf "${INFO}Generating Access Key${END}\n"
		printf "${INFO}....Please wait.${END}\n"

		aws ${AWS_PROFILE_STR} ${AWS_REGION_STR} iam create-access-key --user-name SRIMonitorUser
		if [ $? -ne 0 ]
		then
			exit
		else
			printf "${SUCCESS}....Successfully created access key for SRIMonitorUser!${END}\n"
			printf "${WARNING}Please safely store the SecretAccessKey and AccessKeyID output above. You'll use this key to programmatically access query results stored in S3.${END}\n"
		fi

		#################################################################################

		printf "\n\n${INFO}This appears to be your first time setting up SRIMonitor - Would you like to go ahead and run an initial scan of the URLs to create a baseline?.${END}\n"
		read -p "y/n: " answer
		if [ "$answer" == "Y" ] || [ "$answer" == "y" ]
		then
		   printf "${INFO}....Please wait.${END}\n"
		   aws ${AWS_PROFILE_STR} ${AWS_REGION_STR} lambda invoke --function-name 'SRIMonitor-Dispatch' - >> srimonitor.log 2>&1
		   if [ $? -ne 0 ]
		   then
			   printf "${FAILURE}....Failed to invoke 'SRIMonitor-Dispatch' lambda function! Please see srimonitor.log for details.${END}\n"
			   exit
		   else
			   printf "${SUCCESS}....Successfully added URLs to the download and analysis queue!${END}\n"
		   fi
		fi

fi

printf "\n${SUCCESS}....Deployment Complete!${END}\n"
