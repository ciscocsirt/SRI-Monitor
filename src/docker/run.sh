#!/bin/bash
  
#$@ is all command line arguments
#$AWS_BATCH_JOB_ARRAY_INDEX is an environment variable with the current array index (used by array batch jobs)
node index.js $@  $AWS_BATCH_JOB_ARRAY_INDEX
