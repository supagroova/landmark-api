/**
 * Module dependencies.
 */

var logger     = require('koa-logger');
var route      = require('koa-route');
var koa        = require('koa');
var JSONStream = require('streaming-json-stringify');

var app        = koa();

var MAX_ROWS   = 100;
var DEF_ROWS   = 100;

// Configure DB
var mysql      = require('mysql');
var pool       = mysql.createPool({
  host     : 'localhost',
	database : 'wikilandmarks',
  user     : 'landmarks',
  password : '24PJhqhEPVzUonxj'
});

// Compact JSON responses
app.jsonSpaces = 0;

// Logger
app.use(function *(next){
  var start = new Date;
  yield next;
  var ms = new Date - start;
  console.log('%s %s - %s', this.method, this.url, ms);
});

// x-response-time Header
app.use(function *(next){
  var start = new Date;
  yield next;
  var ms = new Date - start;
  this.set('X-Response-Time', ms + 'ms');
});

// Route
app.use(route.get('/boundingbox.json', function *() {
	
	this.type  = 'json';
	
	var stream = this.body = JSONStream();
	stream.on('error', this.onerror);
	
	// Bounding Box Params
	var n = parseFloat(this.query.north);
	var s = parseFloat(this.query.south);
	var w = parseFloat(this.query.west);
	var e = parseFloat(this.query.east);

	// Table name (depends on lang)
	var langs = ['en', 'es', 'fr', 'ja', 'zh', 'de'];
	var lang = this.query.lang || this.acceptsLanguages(langs);
	if (langs.indexOf(lang) == -1) lang = langs[0];
	var table = "live_"+lang;
	
	// Set rows to return
	var per_page = parseInt(this.query.maxRows);
	if (per_page < 0 || isNaN(per_page)) per_page = DEF_ROWS;
	if (per_page > MAX_ROWS) per_page = MAX_ROWS;
	
	var sql_str = "SELECT title, X(coord) as lat, Y(coord) as lng FROM ?? WHERE Intersects(coord, GeomFromText('POLYGON((? ?, ? ?, ? ?, ? ?, ? ?))')) LIMIT ?";
	var sql_params = [table, w, n, w, s, e, s, e, n, w, n, per_page];
	var sql = mysql.format(sql_str, sql_params);
	// console.log("SQL: ", sql);
	
	// Query DB for Landmarks in the bounding box
	stream.write("{'landmarks':");
	landmarks = pool.getConnection(function(err, connection) {
		connection.query(sql, function(err, rows, fields) {
		  if (err) throw err;

			// console.log("Landmarks found: ", rows.length);
			connection.release();
			stream.write(rows);
			stream.write("}");
			stream.end();

			return rows
			
		});
	});

}));

// listen
app.listen(3000);
console.log('listening on port 3000');