/**
 * Module dependencies.
 */
var express  = require('express');
var logger   = require('morgan');
var app      = exports.app   = express();
var mysql    = exports.mysql = require('mysql');
var Helper   = require('./helper');
var config   = exports.config = require('konfig')();

// Configure DB
var helper   = exports.helper = new Helper(config.app);

app.enable('trust proxy');

// Logger w format
if (config.app.logger) {
  app.use(logger(':remote-addr - :method :url HTTP/:http-version :status :res[content-length] - :response-time ms'));
}

// Add response time to headers
app.use(express.responseTime())

// Compact JSON responses
app.set('json spaces', 0);
app.use(express.compress());

// Routes
app.get('/', function(req, res) {
	res.send('<h1>Hallo World!</h1><p>This is the Landmark Api</p>');
})

app.get('/radius.json', function(req, res) {
	
	res.type('json');
	
	// Bounding Box Params
	var lat  = parseFloat(req.query.lat);
	var lng  = parseFloat(req.query.lng);
	var dist = parseFloat(req.query.dist);

	var lang = helper.getLangFromParams(req);
	var per_page = helper.getPerPageFromParams(req);
	
	// Set rows to return
	var sql_str;
	sql_str  = "SELECT id as pageid, harvesine(y(coord), x(coord), ?, ?) AS dist, title, Y(coord) AS lat, X(coord) AS lng, rank, ? AS lang ";
	sql_str += "FROM ?? WHERE ";
	sql_str += "st_within(coord, envelope(linestring(point((?-?/abs(cos(radians(?))*111)), (?-(?/69))), point((?+?/abs(cos(radians(?))*111)), (?+(?/69)))))) ";
	sql_str += "ORDER BY rank DESC, dist DESC LIMIT ?";

	var sql_params = [lat, lng, lang, "live_"+lang, lng, dist, lat, lat, dist, lng, dist, lat, lat, dist, per_page];
	var sql = mysql.format(sql_str, sql_params);
	// console.log("SQL: ", sql);
	
	// Query DB for Landmarks in the bounding box
	helper.queryDB(sql, function(rows) {
		var json = { 'landmarks' : rows };
		res.json(json);
	});
	
});


// Route
app.get('/boundingbox.json', function(req, res) {
	
	res.type('json');
	
	// Bounding Box Params
	var n = parseFloat(req.query.north);
	var s = parseFloat(req.query.south);
	var w = parseFloat(req.query.west);
	var e = parseFloat(req.query.east);

	var lang = helper.getLangFromParams(req);
	var per_page = helper.getPerPageFromParams(req);

	var sql_str = "SELECT id as pageid, title, Y(coord) as lat, X(coord) as lng, rank, ? as lang ";
	sql_str    += "FROM ?? WHERE Intersects(coord, GeomFromText('POLYGON((? ?, ? ?, ? ?, ? ?, ? ?))')) ORDER BY rank DESC LIMIT ?";
	var sql_params = [lang, "live_"+lang, w, n, w, s, e, s, e, n, w, n, per_page];
	var sql = mysql.format(sql_str, sql_params);
	// console.log("SQL: ", sql);
	
	// Query DB for Landmarks in the bounding box
	helper.queryDB(sql, function(rows) {
		var json = { 'landmarks' : rows };
		res.json(json);
	});

});

app.use(function(err, req, res, next){
  console.error(err.stack);
	var msg = 'Something broke!';
	res.format({
	  text: function(){
	    res.send(500, msg);
	  },

	  html: function(){
	    res.send(500, msg);
	  },

	  json: function(){
	    res.send({ error: msg });
	  }
	});
});
