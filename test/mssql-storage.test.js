'use strict';

var cp       = require('child_process'),
	assert   = require('assert'),
	async    = require('async'),
	should   = require('should'),
	storage;


var HOST = 'reekoh-mssql.cg1corueo9zh.us-east-1.rds.amazonaws.com',
	USER = 'reekoh',
	PORT = 1433,
	TABLE = 'reekoh_table',
	PASSWORD = 'rozzwalla',
	DATABASE = 'reekoh',
	_ID  = new Date().getTime();

var record = {
	_id: _ID,
	co2: '11%',
	temp: 23,
	quality: 11.25,

	reading_time: '2015-11-27 19:04:13.000',
	metadata: '{"metadata_json": "reekoh metadata json"}',
	random_data: 'abcdefg',
	is_normal: true
};


describe('Storage', function () {
	this.slow(5000);

	after('terminate child process', function () {
		storage.send({
			type: 'close'
		});

		setTimeout(function () {
			storage.kill('SIGKILL');
		}, 3000);
	});

	describe('#spawn', function () {
		it('should spawn a child process', function () {
			assert.ok(storage = cp.fork(process.cwd()), 'Child process not spawned.');
		});
	});

	describe('#handShake', function () {
		it('should notify the parent process when ready within 5 seconds', function (done) {
			this.timeout(5000);

			storage.on('message', function (message) {
				if (message.type === 'ready')
					done();
			});

			storage.send({
				type: 'ready',
				data: {
					options :   {
						host : HOST,
						port : PORT,
						user : USER,
						password : PASSWORD,
						database   : DATABASE,
						table : TABLE,
						encrypt: true,
						fields :   JSON.stringify({
							_id				   : {source_field:'_id', data_type: 'Float'},
							co2_field      	   : {source_field:'co2', data_type: 'String'},
							temp_field     	   : {source_field:'temp', data_type: 'Integer'},
							quality_field  	   : {source_field:'quality', data_type: 'Float'},
							reading_time_field : {source_field:'reading_time', data_type: 'DateTime'},
							metadata_field 	   : {source_field:'metadata', data_type: 'String'},
							random_data_field  : {source_field:'random_data'},
							is_normal_field    : {source_field:'is_normal', data_type: 'Boolean'}
						})
					}
				}
			}, function (error) {
				assert.ifError(error);
			});
		});
	});

	describe('#data', function () {
		it('should process the data', function (done) {
			storage.send({
				type: 'data',
				data: record
			}, done);
		});
	});

	describe('#data', function () {
		it('should have inserted the data', function (done) {
			this.timeout(10000);

			var sql = require('mssql');

			var config = {
				user: USER,
				password: PASSWORD,
				server: HOST,
				database: DATABASE,
				port: PORT,
				options: {
					encrypt: false
				}
			};

			var connection;

			async.series([
				function(cb) {
					connection = new sql.Connection(config, function (err) {
						cb(err);
					});
				},
				function(cb) {


					var request = new sql.Request(connection);

					request.query('SELECT * FROM ' + TABLE + ' WHERE _id = ' + _ID, function (reqErr, queryset) {

							should.exist(queryset[0]);
							var resp = queryset[0];

							//cleanup for JSON stored string
							var cleanMetadata = resp.metadata_field.replace(/\\"/g, '"');
							var str  = JSON.stringify('"' + record.metadata + '"');
							var str2 = JSON.stringify(cleanMetadata);

							should.equal(record.co2, resp.co2_field, 'Data validation failed. Field: co2');
							should.equal(record.temp, resp.temp_field, 'Data validation failed. Field: temp');
							should.equal(record.quality, resp.quality_field, 'Data validation failed. Field: quality');
							should.equal(record.random_data, resp.random_data_field, 'Data validation failed. Field: random_data');
							should.equal(str, str2, 'Data validation failed. Field: metadata');

						cb();
					});
				}
			], function() {

				done();
			});

		});
	});


});