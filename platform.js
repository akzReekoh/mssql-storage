'use strict';

var inherits     = require('util').inherits,
	EventEmitter = require('events').EventEmitter;

var isString = function (val) {
	return typeof val === 'string' || ((!!val && typeof val === 'object') && Object.prototype.toString.call(val) === '[object String]');
};

function Platform() {
	if (!(this instanceof Platform)) return new Platform();

	var self = this;

	process.on('uncaughtException', function (error) {
		self.handleException(error);
		process.exit(1);
	});

	EventEmitter.call(this);
	Platform.init.call(this);
}

inherits(Platform, EventEmitter);

Platform.init = function () {
	var self = this;

	process.on('message', function (m) {
		if (m.type === 'ready')
			self.emit('ready', m.data.options);
		else if (m.type === 'data')
			self.emit('data', m.data);
	});
};

Platform.prototype.notifyReady = function (callback) {
	callback = callback || function () {
		};

	setImmediate(function () {
		process.send({
			type: 'ready'
		});

		callback();
	});
};

Platform.prototype.log = function (title, description, callback) {
	callback = callback || function () {
		};

	setImmediate(function () {
		if (!title || !isString(title)) return callback(new Error('A valid log title is required.'));

		process.send({
			type: 'log',
			data: {
				title: title,
				description: description
			}
		});

		callback();
	});
};

Platform.prototype.handleException = function (error, callback) {
	callback = callback || function () {
		};

	setImmediate(function () {
		if (!error) return callback(new Error('Error is required.'));

		process.send({
			type: 'error',
			data: {
				name: error.name,
				message: error.message,
				stack: error.stack
			}
		});
	});
};

module.exports = new Platform();