FROM node:9.11.1-onbuild
EXPOSE 8443
RUN cp config/config.json node-solid-server/bin/config.json
RUN openssl req \
    -new \
    -x509 \
    -nodes \
    -sha256 \
    -days 3650 \
    -key ../localhost.key \
    -subj '/CN=*.localhost' > ../localhost.cert
CMD npm run solid-test start