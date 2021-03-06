'use strict';

var sql           = require('mssql'),
	async         = require('async'),
	moment        = require('moment'),
	platform      = require('./platform'),
	isPlainObject = require('lodash.isplainobject'),
	tableName, parseFields, connection;

/*
 * Listen for the data event.
 */
platform.on('data', function (data) {
	var columnList,
		valueList,
		first = true;

	async.forEachOf(parseFields, function (field, key, callback) {

		var datum = data[field.source_field],
			processedDatum;

		if (datum !== undefined && datum !== null) {
			if (field.data_type) {
				try {
					if (field.data_type === 'String') {
						if (isPlainObject(datum))
							processedDatum = JSON.stringify(datum);
						else
							processedDatum = '\'' + datum + '\'';
					} else if (field.data_type === 'Integer') {

						var intData = parseInt(datum);

						if (isNaN(intData))
							processedDatum = datum; //store original value
						else
							processedDatum = intData;

					} else if (field.data_type === 'Float') {

						var floatData = parseFloat(datum);

						if (isNaN(floatData))
							processedDatum = datum; //store original value
						else
							processedDatum = floatData;

					} else if (field.data_type === 'Boolean') {

						var type = typeof datum;

						if ((type === 'string' && datum.toLocaleLowerCase() === 'true') ||
							(type === 'boolean' && datum === true )) {
							processedDatum = 1;
						} else if ((type === 'string' && datum.toLocaleLowerCase() === 'false') ||
							(type === 'boolean' && datum === false )) {
							processedDatum = 0;
						} else {
							processedDatum = datum;
						}
					} else if (field.data_type === 'DateTime') {

						var dtm = new Date(datum);

						if (!isNaN(dtm.getTime()) && field.format !== undefined)
							processedDatum = '\'' + moment(dtm).format(field.format) + '\'';
						else
							processedDatum = '\'' + datum + '\'';

					}
				} catch (e) {
					if (typeof datum === 'number')
						processedDatum = datum;
					else {
						if (isPlainObject(datum))
							processedDatum = '\'' + JSON.stringify(datum) + '\'';
						else
							processedDatum = '\'' + datum + '\'';
					}
				}
			} else {
				if (typeof datum === 'number')
					processedDatum = datum;
				else {
					if (isPlainObject(datum))
						processedDatum = '\'' + JSON.stringify(datum) + '\'';
					else
						processedDatum = '\'' + String(datum) + '\'';
				}
			}
		} else {
			processedDatum = null;
		}

		if (!first) {
			valueList = valueList + ',' + processedDatum;
			columnList = columnList + ',' + key;
		} else {
			first = false;
			valueList = processedDatum;
			columnList = key;
		}

		callback();

	}, function () {
		var transaction = new sql.Transaction(connection);

		transaction.begin(function (transErr) {
			// ... error checks
			if (transErr) {
				console.error('Error beginning transaction for MsSQL.', transErr);
				platform.handleException(transErr);
			} else {
				var request = new sql.Request(transaction);
				console.log('insert into ' + tableName + ' (' + columnList + ') values (' + valueList + ')');
				request.query('insert into ' + tableName + ' (' + columnList + ') values (' + valueList + ')', function (reqErr) {
					// ... error checks
					if (reqErr) {
						console.error('Error inserting data into MsSQL.', reqErr);
						platform.handleException(reqErr);
					} else {
						transaction.commit(function (comErr) {
							// ... error checks
							if (comErr) {
								console.error('Error committing transaction into MsSQL.', comErr);
								platform.handleException(comErr);
							}
						});
					}
				});
			}
		});
	});
});

/*
 * Event to listen to in order to gracefully release all resources bound to this service.
 */
platform.on('close', function () {
	var domain = require('domain');
	var d = domain.create();

	d.once('error', function (error) {
		console.error(error);
		platform.handleException(error);
		platform.notifyClose();
		d.exit();
	});

	d.run(function () {
		connection.close();
		platform.notifyClose();
		d.exit();
	});
});

/*
 * Listen for the ready event.
 */
platform.once('ready', function (options) {
	try {
		parseFields = JSON.parse(options.fields);
	}
	catch (ex) {
		platform.handleException(new Error('Invalid option parameter: fields. Must be a valid JSON String.'));

		return setTimeout(function () {
			process.exit(1);
		}, 2000);
	}

	async.forEachOf(parseFields, function (field, key, callback) {
		if (field.source_field === undefined || field.source_field === null) {
			callback(new Error('Source field is missing for ' + key + ' in MsSQL Plugin'));
		} else if (field.data_type && (field.data_type !== 'String' && field.data_type !== 'Integer' &&
			field.data_type !== 'Float' && field.data_type !== 'Boolean' &&
			field.data_type !== 'DateTime')) {
			callback(new Error('Invalid Data Type for ' + key + ' allowed data types are (String, Integer, Float, Boolean, DateTime) in MsSQL Plugin'));
		} else
			callback();
	}, function (e) {
		if (e) {
			console.error('Error parsing JSON field configuration for MsSQL.', e);
			platform.handleException(e);
			return;
		}

		tableName = options.table;

		var config = {
			user: options.user,
			password: options.password,
			server: options.host,
			database: options.database,
			port: options.port,
			options: {
				encrypt: options.encrypt // Use this if you're on Windows Azure
			}
		};

		connection = new sql.Connection(config, function (err) {
			if (err) {
				console.error('Error connecting to MsSQL.', err);
				platform.handleException(err);

				return setTimeout(function () {
					process.exit(1);
				}, 2000);
			} else {
				platform.log('Connected to MsSQL.');
				platform.notifyReady(); // Need to notify parent process that initialization of this plugin is done.
			}
		});

		connection.on('error', function (err) {
			console.error('Error connecting to MsSQL.', err);
			platform.handleException(err);
		});
	});
});