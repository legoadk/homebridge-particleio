var Service, Characteristic;
var Request = require("request");
var SyncRequest = require("sync-request");
var EventSource = require('eventsource');

var informationService;
var temperatureService;
var lightSensorService;
var humiditySensorService;
var bulbService;

var bulbServiceHandling;

var roomName;

var eventName = "HKSValues";

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-particleio", "ParticleIoAccessory", ParticleIoAccessory);
}

function ParticleIoAccessory(log, config) {
	this.log = log;

	// url info
	this.url = config["cloud_url"];
	this.deviceid = config["deviceid"];
	this.accesstoken = config["accesstoken"];
	this.bulbServiceHandling = config["bulb_service"];
	this.roomName = config["room_name"];
  this.variables = config["variables"]; // An object of variables that this device publishes
  this.events = config["events"]; // an object of events that this device publishes and that this Hamebridge accessory should pay attention to

}

function random(low, high) {
	return Math.random() * (high - low) + low;
}

ParticleIoAccessory.prototype = {
	identify: function(callback) {
		this.log("Identify requested!");
		callback(); // success
	},

	getDefaultValue: function(callback) {
		callback(null, 0.0);
	},

	setBulbState: function(state, callback) {
		var setLightOnUrl = this.url + this.deviceid + "/ctrllight";

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

	setBrightness: function(level, callback) {
		this.log(level);

		var setLightBrightnessUrl = this.url + this.deviceid + "/brightness";

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

	setHue: function(value, callback) {
		console.log(value);

		var setLightHueUrl = this.url + this.deviceid + "/sethue";

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
		// you can OPTIONALLY create an information service if you wish to override
		// the default values for things like serial number, model, etc.
		informationService = new Service.AccessoryInformation();

    var particleDeviceInfoUrl = this.url + this.deviceid + "?access_token=" + this.accesstoken;
		this.log(particleDeviceInfoUrl);

    var sr = SyncRequest('GET', particleDeviceInfoUrl);
    var particleDeviceInfoJson = JSON.parse(sr.getBody('utf8'));

    this.log(particleDeviceInfoJson);

		informationService
      .setCharacteristic(Characteristic.Name, particleDeviceInfoJson.name)
			.setCharacteristic(Characteristic.Manufacturer, "Particle")
      .setCharacteristic(Characteristic.SerialNumber, this.deviceid)
			.setCharacteristic(Characteristic.Model,  particleDeviceInfoJson.product_id === 0 ? "Core" :
                                                particleDeviceInfoJson.product_id === 6 ? "Photon" :
                                                "Electron/unknown")
      .addCharacteristic(Characteristic.FirmwareRevision).setValue(particleDeviceInfoJson.pinned_build_target);

		temperatureService = new Service.TemperatureSensor(this.roomName + " Temperature");

		temperatureService
			.getCharacteristic(Characteristic.CurrentTemperature)
			.on('get', this.getDefaultValue.bind(this));

		lightSensorService = new Service.LightSensor(this.roomName + " Light Sensor");

		lightSensorService
			.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
			.on('get', this.getDefaultValue.bind(this));

		humiditySensorService = new Service.HumiditySensor();

		humiditySensorService
			.getCharacteristic(Characteristic.CurrentRelativeHumidity)
			.on('get', this.getDefaultValue.bind(this));

		if (this.bulbServiceHandling == "yes") {
			bulbService = new Service.Lightbulb(this.roomName + " Light");

			bulbService
				.getCharacteristic(Characteristic.On)
				.on('set', this.setBulbState.bind(this));

			bulbService
				.setCharacteristic(Characteristic.Name, this.roomName + " Light");

			bulbService
				.addCharacteristic(new Characteristic.Brightness())
				.on('set', this.setBrightness.bind(this));

			bulbService
				.addCharacteristic(new Characteristic.Hue())
				.on('set', this.setHue.bind(this));
		}

		var eventUrl = this.url + this.deviceid + "/events/" + eventName + "?access_token=" + this.accesstoken;

		this.log(eventUrl);

		var es = new EventSource(eventUrl);

		es.onerror = function() {
			this.log('ERROR!');
		};

		es.addEventListener(eventName,
			function(e) {
				var data = JSON.parse(e.data);
				var tokens = data.data.split('=');

				//console.log(tokens);

				if (tokens[0].toLowerCase() === "temperature") {
					this.log("Temperature " + tokens[1] + " C");

					temperatureService
						.setCharacteristic(Characteristic.CurrentTemperature, parseFloat(tokens[1]));
				} else if (tokens[0].toLowerCase() === "lux") {
					this.log("Light " + tokens[1] + " lux");

					lightSensorService
						.setCharacteristic(Characteristic.CurrentAmbientLightLevel, parseFloat(tokens[1]));
				} else if (tokens[0].toLowerCase() === "humidity") {
					this.log("Humidity " + tokens[1] + "%");

					humiditySensor
						.setCharacteristic(Characteristic.CurrentRelativeHumidity, parseFloat(tokens[1]));
				}

				//console.log(data.data);
			}, false);

		if (this.bulbServiceHandling == "yes") {
      return [informationService, temperatureService, lightSensorService, humiditySensorService, bulbService];
		}else{
			return [informationService, temperatureService, lightSensorService, humiditySensorService];
		}
	}
};
