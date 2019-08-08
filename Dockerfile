FROM node:8-alpine

#Include the NodeJS Downloader's package file and main index file.
COPY src/docker/ /

#Install the NodeJS package
RUN npm install

ENTRYPOINT ["sh","run.sh"]
