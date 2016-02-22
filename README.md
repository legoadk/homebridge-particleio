Copy the repo directory to your **/usr/local/lib/node_modules/** (optionally, create a symlink).

In /usr/local/lib/node_modules/homebridge-particleio, create a dir **node_modules**

Then install eventsource, request and sync-request locally:
```sh
npm install eventsource
npm install request
npm install sync-request
```

Configure Homebridge to use your ParticleIo sccessorry, and restart!
