'use strict';

var platform    = require('./platform'),
	sql	  	    = require('mssql'),
	moment	    = require('moment'),
	_			= require('lodash'),
	isJSON      = require('is-json'),
	tableName, parseFields, connection;

/*
 * Listen for the ready event.
 */
platform.once('ready', function (options) {

	//try catch to capture parsing error in JSON.parse
	try {
		parseFields = JSON.parse(options.fields);

		_.forEach(parseFields, function(field, key) {
			if (field.source_field === undefined || field.source_field === null) {
				throw( new Error('Source field is missing for ' + key + ' in MsSQL Plugin'));
			} else if (field.data_type  && (field.data_type !== 'String' && field.data_type !== 'Integer' &&
				field.data_type !== 'Float'  && field.data_type !== 'Boolean' &&
				field.data_type !== 'DateTime')) {
				throw(new Error('Invalid Data Type for ' + key + ' allowed data types are (String, Integer, Float, Boolean, DateTime) in MsSQL Plugin'));
			}
		});

	} catch (e) {
		console.error('Error parsing JSON field configuration for MsSQL.', e);
		platform.handleException(e);
		return;
	}

	tableName   = options.table;

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


	connection = new sql.Connection(config, function(err) {
		if (err) {
			console.error('Error connecting to MsSQL.', err);
			platform.handleException(err);
		} else {
			platform.log('Connected to MsSQL.');
			platform.notifyReady(); // Need to notify parent process that initialization of this plugin is done.
		}
	});

	connection.on('error', function(err) {
		// ... error handler
		console.error('Error connecting to MsSQL.', err);
		platform.handleException(err);
	});
});

/*
 * Listen for the data event.
 */
platform.on('data', function (data) {

	if (isJSON(data, true)) {
		var columnList,
			valueList,
			first = true;

		_.forEach(parseFields, function(field, key) {

			var datum = data[field.source_field],
				processedDatum;

			if (datum !== undefined && datum !== null) {
				if (field.data_type) {
					try {
						if (field.data_type === 'String') {

							if (isJSON(datum))
								processedDatum = '\'' + JSON.stringify(datum) + '\'';
							else
								processedDatum = '\'' + String(datum) + '\'';


						} else if (field.data_type === 'Integer')  {

							var intData = parseInt(datum);

							if (isNaN(intData))
								processedDatum = datum; //store original value
							else
								processedDatum = intData;

						} else if (field.data_type === 'Float')  {

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
							if (!isNaN( dtm.getTime())) {

								if (field.format !== undefined)
									processedDatum = '\'' + moment(dtm).format(field.format) + '\'';
								else
									processedDatum = '\'' + dtm + '\'';


							} else {
								processedDatum = '\'' + datum + '\'';
							}
						}
					} catch (e) {
						if (typeof datum === 'number')
							processedDatum = datum;
						else if (isJSON(datum))
							processedDatum = JSON.stringify(datum);
						else
							processedDatum = '\'' + datum + '\'';
					}

				} else {
					if (typeof datum === 'number')
						processedDatum = datum;
					else if (isJSON(datum))
						processedDatum = '\'' + JSON.stringify(datum) + '\'';
					else
						processedDatum = '\'' + datum + '\'';
				}

			} else {
				processedDatum = null;
			}

			if (!first) {
				valueList  = valueList  + ',' + processedDatum;
				columnList = columnList  + ',' + key;
			} else {
				first      = false;
				valueList  = processedDatum;
				columnList = key;
			}

		});

		var transaction = new sql.Transaction(connection);

		transaction.begin(function(transErr) {
			// ... error checks
			if (transErr) {
				console.error('Error beginning transaction for MsSQL.', transErr);
				platform.handleException(transErr);
			} else {
				var request = new sql.Request(transaction);

				request.query('insert into ' + tableName + ' (' + columnList + ') values (' + valueList + ')', function(reqErr, queryset) {
					// ... error checks
					if (reqErr) {
						console.error('Error inserting data into MsSQL.', reqErr);
						platform.handleException(reqErr);
					} else {
						transaction.commit(function(comErr, recordset) {
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

	} else {

		console.error('Invalid Data not in JSON Format for MsSQL Plugin.', data);
		platform.log('Invalid Data not in JSON Format for MsSQL Plugin.', data);

	}


});