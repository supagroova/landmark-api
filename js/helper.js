var mysql      = require('mysql');
var MAX_ROWS   = 100;
var DEF_ROWS   = 100;

module.exports = Helper;

function Helper(config) {
  this.config = config;
  this.pool   = mysql.createPool(this.config.database);

  var readOnly = this.config.database.readOnly;
  this.pool.on('connection', function(connection) {
  	// Indicate that future transactions are read-only
  	if (readOnly)
  		connection.query('START TRANSACTION READ ONLY');
  });
}

Helper.prototype.getLangFromParams = function(req) {
	var langs = ['en', 'es', 'fr', 'ja', 'zh', 'de'];
	var lang = ('lang' in req.query) ? req.query.lang : req.acceptsLanguages(langs);
	if (!lang) lang = req.acceptsLanguages(langs);
	if (langs.indexOf(lang) == -1) lang = langs[0];
	return lang;
}

Helper.prototype.getPerPageFromParams = function(req) {
	var per_page = parseInt(req.query.maxRows);
	if (per_page < 0 || isNaN(per_page)) per_page = DEF_ROWS;
	if (per_page > MAX_ROWS) per_page = MAX_ROWS;
	return per_page;
}

Helper.prototype.queryDB = function(sql, result) {
	this.pool.getConnection(function(err, connection) {
		if (err) {
			console.error("Unable to connect to DB! %s\nDB Config: %j", err, this.config);
			throw err;
		}
		connection.query(sql, function(err, rows, fields) {
			connection.release();
			if (err) {
				console.error("Unable to query DB! SQL: %s\nSQL: %s", err, sql);
				throw err;
			}
			//console.log("Landmarks found: ", rows.length);
      
      if (result)
			  result(rows)
		});
	}.bind(this));
}
