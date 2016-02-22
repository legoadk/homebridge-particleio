var Service, Characteristic, AirPressureService, AirPressureCharacteristic;
var Request = require("request");
var SyncRequest = require("sync-request");
var EventSource = require('eventsource');
var inherits = require('util').inherits;

var hexToBase64 = function(val) {
    return new Buffer((''+val).replace(/[^0-9A-F]/ig, ''), 'hex').toString('base64');
};
var base64ToHex = function(val) {
    if(!val) return val;
    return new Buffer(val, 'base64').toString('hex');
};
var swap16 = function (val) {
    return ((val & 0xFF) << 8)
           | ((val >> 8) & 0xFF);
};
var hexToHPA = function(val) {
    return parseInt(swap16(val), 10);
};
var hPAtoHex = function(val) {
    return swap16(Math.round(val)).toString(16);
};
var numToHex = function(val, len) {
    var s = Number(val).toString(16);
    if(s.length % 2 !== 0) {
        s = '0' + s;
    }
    if(len) {
        return ('0000000000000' + s).slice(-1 * len);
    }
    return s;
};

// var bulbService;

// var bulbServiceHandling;

// var eventName = "HKSValues";

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  AirPressureCharacteristic = function() {
    Characteristic.call(this, "Relative Atmospheric Pressure", 'E863F10F-079E-48FF-8F27-9C2605A29F52');
    this.setProps({
      format: Characteristic.Formats.DATA,
      perms: [Characteristic.Perms.READ],
    });
    this.value = hexToBase64(hPAtoHex(1234));
    var self = this;
    // this.on('get', function(cb) {
    //     console.log(self.name, 'was read', base64ToHex(self.value));
    //     cb(null, self.value);
    // });
  };
  inherits(AirPressureCharacteristic, Characteristic);


  AirPressureService = function(displayName, subtype) {
      Service.call(this, displayName, 'E863F001-079E-48FF-8F27-9C2605A29F52', subtype);

      // Required Characteristics
      this.addCharacteristic(AirPressureCharacteristic);

      // Optional Characteristics
      this.addOptionalCharacteristic(Characteristic.Name);
  };

  AirPressureService.UUID = 'E863F001-079E-48FF-8F27-9C2605A29F52';

  inherits(AirPressureService, Service);


  homebridge.registerAccessory("homebridge-particleio", "ParticleIo", ParticleIo);
};

function ParticleIo(log, config) {
  this.log = log;
  this.device = { id: config.deviceid };
  // url info
  this.url = config.cloud_url;
  this.accesstoken = config.accesstoken;
  // this.bulbServiceHandling = config.bulb_service;
  // this.roomName = config.room_name;
  this.variables = config.variables; // An object of variables that this device publishes
  //this.log(this.variables);
  this.events = config.events; // an object of events that this device publishes and that this Hamebridge accessory should pay attention to

}

function random(low, high) {
  return Math.random() * (high - low) + low;
}

ParticleIo.prototype = {
  identify: function(callback) {
    this.log("Identify requested!");
    callback(); // success
  },

  getDefaultValue: function(callback) {
    callback(null, 0.0);
  },

  getVariable: function(callback) {
    this.that.log('getVariable called:', this.that.device.name, this.display);

    var variableUrl = this.that.url + this.that.device.id + '/' + this.name +"?access_token=" + this.that.accesstoken;
    //this.that.log(variableUrl);
    Request(variableUrl, function(error, response, body) {
      if(!error && response.statusCode == 200) {
        var value = JSON.parse(body);
        this.that.log("value of",this.name+":", value.result);
        if(this.service.testCharacteristic(AirPressureCharacteristic) ) {
          callback(null, hexToBase64(hPAtoHex(parseFloat(value.result)*10)));
        } else {
          if (this.service.testCharacteristic(Characteristic.BatteryLevel)) {
            this.service.setCharacteristic(Characteristic.StatusLowBattery, parseFloat(value.result) < 10? 1 : 0)
                        .setCharacteristic(Characteristic.ChargingState, null);
          }
          callback(null, parseFloat(value.result));
        }
      }
      else {
        this.that.log.warn(error);
        callback(error);
      }
    }.bind(this));
  },

  // NOTE: Not used until Functions are are added to the config reading process
  setBulbState: function(state, callback) {
    var setLightOnUrl = this.url + this.device.id + "/ctrllight";

    Request.post(
      setLightOnUrl, {
        form: {
          access_token: this.accesstoken,
          args: (state ? 1 : 0)
        }
      },
      function(error, response, body) {
        // If not error then prepare message and send

        this.log(response);

        if (!error) {
          callback();
        } else {
          callback(error);
        }
      }
    );
  },

  // NOTE: Not used until Functions are are added to the config reading process
  setBrightness: function(level, callback) {
    this.log(level);

    var setLightBrightnessUrl = this.url + this.device.id + "/brightness";

    Request.post(
      setLightBrightnessUrl, {
        form: {
          access_token: this.accesstoken,
          args: level
        }
      },
      function(error, response, body) {
        // If not error then prepare message and send

        this.log(response);

        if (!error) {
          callback();
        } else {
          callback(error);
        }
      }
    );
  },

  // NOTE: Not used until Functions are are added to the config reading process
  setHue: function(value, callback) {
    console.log(value);

    var setLightHueUrl = this.url + this.device.id + "/sethue";

    Request.post(
      setLightHueUrl, {
        form: {
          access_token: this.accesstoken,
          args: value
        }
      },
      function(error, response, body) {
        // If not error then prepare message and send

        this.log(response);

        if (!error) {
          callback();
        } else {
          callback(error);
        }
      }
    );
  },

  // NOTE: Not used until Functions are are added to the config reading process
  HSVtoRGB: function(h, s, v) {
    while (h < 0) {
      h += 360;
    }
    i = (h / 60 >> 0) % 6;
    f = h / 60 - i;
    v *= 255;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i) {
      case 0:
      r = v;
      g = t;
      b = p;
      break;
      case 1:
      r = q;
      g = v;
      b = p;
      break;
      case 2:
      r = p;
      g = v;
      b = t;
      break;
      case 3:
      r = p;
      g = q;
      b = v;
      break;
      case 4:
      r = t;
      g = p;
      b = v;
      break;
      case 5:
      r = v;
      g = p;
      b = q;
    }

    return [r, g, b];
  },

  getServices: function() {
    that = this;

    var particleDeviceInfoUrl = this.url + this.device.id + "?access_token=" + this.accesstoken;
    //this.log(particleDeviceInfoUrl);

    var sr = SyncRequest('GET', particleDeviceInfoUrl);
    if(sr.statusCode != 200) {
      this.log.error('Could not poll device information. This accessory will not be functional.');
      return [];
    }
    this.log("Successfully polled device information for Device ID", this.device.id);
    this.device = JSON.parse(sr.getBody('utf8'));

    this.log(this.device);

    this.informationService = new Service.AccessoryInformation();

    this.informationService
    .setCharacteristic(Characteristic.Name, this.device.name) // Why bother? from within an accessory, this no longer makes a difference
    .setCharacteristic(Characteristic.Manufacturer, "Particle")
    .setCharacteristic(Characteristic.SerialNumber, this.device.id)
    .setCharacteristic(Characteristic.Model,  this.device.product_id === 0 ? "Core" :
                                              this.device.product_id === 6 ? "Photon" :
                                              this.device.cellular === true? "Electron" :
                                                                             "Unknown")
    .addCharacteristic(Characteristic.FirmwareRevision).setValue(this.device.pinned_build_target);

    this._services = [this.informationService];

    // Here is where we will have to iterate the config and populate Services and Characteristics.
    this.variables = this.variables.filter(
      function(variable){
        if(variable.name in this.device.variables) {
          this.log("Variable", variable.name, "is available on the Particle device; looks good.");
          return true;
        } else {
          this.log.warn("Variable", variable.name, "does not appear to exist on the Particle device! Skipping.");
          return false;
        }
      }, this);

    // this.log(this.variables);

    this.variables.forEach(function(variable){
      variable.that = this;
      this.log("Variable", variable.name, "is set to use a", variable.type, "service.");
      switch(variable.type) {
        case "Temperature":
          variable.service = new Service.TemperatureSensor(variable.display);
          variable.service.getCharacteristic(Characteristic.CurrentTemperature).setProps({ minValue: -40.0, minStep: 0.01 })
          .on('get', that.getVariable.bind(variable));
          this.log("Configured a TemperatureSensor service with name", variable.display, "for variable", variable.name);
          this._services.push(variable.service);
          break;
        case "Humidity":
          variable.service = new Service.HumiditySensor(variable.display);
          variable.service.getCharacteristic(Characteristic.CurrentRelativeHumidity)
          .on('get', that.getVariable.bind(variable));
          this.log("Configured a HumiditySensor service with name", variable.display, "for variable", variable.name);
          this._services.push(variable.service);
          break;
        case "Light":
          variable.service = new Service.LightSensor(variable.display);
          variable.service.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
          .on('get', that.getVariable.bind(variable));
          this.log("Configured a LightSensor service with name", variable.display, "for variable", variable.name);
          this._services.push(variable.service);
          break;
        case "Battery":
          variable.service = new Service.BatteryService(variable.display);
          variable.service.getCharacteristic(Characteristic.BatteryLevel)
          .on('get', that.getVariable.bind(variable));
          this.log("Configured a BatteryService service with name", variable.display, "for variable", variable.name);
          this._services.push(variable.service);
          break;
        case "Pressure":
          variable.service = new AirPressureService(variable.display);
          variable.service.getCharacteristic(AirPressureCharacteristic)
          .on('get', that.getVariable.bind(variable));
          this.log("Configured a AirPressureService service with name", variable.display, "for variable", variable.name);
          this._services.push(variable.service);
          break;
        default:
          this.log.warn(variable.name, "is trying to use a service that is not (yet?) supported! Skipping.");
          break;
      }
    }.bind(this));

    // this.log(this._services);

    return this._services;
  }
};
