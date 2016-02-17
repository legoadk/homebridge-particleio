Copy the directory **homebridge-particleio** of this repo to your **/usr/local/lib/node_modules/** directory (optionally, create a symlink).

In /usr/local/lib/node_modules/homebridge-particle-photon, create a dir **node_modules**

Then install eventsource and request locally:
```sh
npm install eventsource
npm install request
```

Configure Homebridge to use your ParticleIoAccessorry, and restart!

