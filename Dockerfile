FROM node:12.13.0-buster

MAINTAINER Xiaolin

RUN mkdir -p /home/One
WORKDIR /home/One
COPY . /home/One
RUN rm -rf /home/One/node_modules
RUN npm install

EXPOSE 3000

CMD [ "node", "app.js" ]