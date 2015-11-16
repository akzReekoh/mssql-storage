# MsSQL Serve Storage

MsSQL Storage Plugin for the Reekoh IoT Platform.

**Assumptions:**

1. Data would be in JSON format
2. Data would be processed based on configuration format
3. Conversions and formatting are done within Reekoh only minimal conversions are done in the plugin
4. Field configuration is correctly done for the specified table

**Process**

1. Data would be written directly to the MsSQL host specified
2. Storage plugin will only write data using plain SQL-Insert statement
3. All errors will be logged and no data should be written
4. Data will be parsed accordingly based on field configuration

**Field Configuration**

1. Input for this field is in JSON format {"(field_name)" : {"source_field" : "value", "data_type": "value", "format": "value"}}.
2. field_name will be the name of the column in the MsSQL Table
3  source_field (required) value will be the name of the field in the JSON Data passed to the plugin
4  data_type there are 5 available data types that will convert data to it's proper type before saving
   we have String, Integer, Float, Boolean and DateTime leaving this blank will just use the current data for the field.
5. DateTime will only work in conjuction with format this will allow users to format the date/time before saving
   i.e. (YYYY-MM-DD HH:mm:ss) kindly refer to the moment node module for more details and the accepted format
   of MsSQL
6. JSON Data is not supported as a data_type but you can save it if there is a field in MsSQL

```javascript
{
  "co2_field": {
	"source_field": "co2",
	"data_type": "String"
  },
  "temp_field": {
	"source_field": "temp",
	"data_type": "Integer"
  },
  "quality_field": {
	"source_field": "quality",
	"data_type": "Float"
  },
  "metadata_field": {
	"source_field": "metadata",
	"data_type": "JSON"
  },
  "reading_time_field": {
	"source_field": "reading_time",
	"data_type": "DateTime",
	"format": "yyyy-MM-ddTHH:mm:ss"
  },
  "random_data_field": {
	"source_field": "random_data"
  },
  "is_normal_field": {
	"source_field": "is_normal",
	"data_type": "Boolean"
  }
}
```

Sample Data:

```javascript
{
  co2: '11%',
  temp: 23,
  quality: 11.25,
  metadata: '{"name": "warehouse air conditioning"}',
  reading_time: '2015-11-27T11:04:13.539Z',
  random_data: 'abcdefg',
  is_normal: true
}
```

MS SQL Fields:

Type Field mapping |
-------------------|
_id                |
co2_field          |
temp_field         |
quality_field      |
metadata_field     |
reading_time_field |
random_data_field  |
is_normal_field    |

