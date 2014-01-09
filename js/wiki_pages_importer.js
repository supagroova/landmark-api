// Include deps
var fs           = require('fs'),
    util         = require('util'),
    url          = require('url'),
    mysql        = require('mysql'),
    Helper       = require('./helper'),
    config       = require('konfig')(),
    _            = require('underscore'),
    EventEmitter = require('events').EventEmitter;

module.exports = WikiPagesImporter;

// Inherit EventEmitter
util.inherits(WikiPagesImporter, EventEmitter);

function WikiPagesImporter(lang, dump_file) {
  // Instantiate modules/helpers
  config.app.database.readOnly = false;
  this.helper           = new Helper(config.app);
  this.max_page_links   = 1;
  this.per_pages_page   = 2500;
  this.page_per_insert  = 500;
  this.insert_params    = [];
  this.lang             = lang;
  this.pages_table      = "pages_"+lang;
  this.links_table      = "links_"+lang;
  this.live_table       = "live_"+lang;
  this.dump_file        = (dump_file!=null) ? dump_file : "/tmp/" + this.lang + "-wiki-live.sql";  
}

WikiPagesImporter.prototype.start = function() {
  
  var pc_sql = mysql.format("SELECT page_counter FROM ?? ORDER BY page_counter DESC LIMIT 1;", [this.pages_table])
  this.helper.queryDB(pc_sql, function(rows) {
    if (rows[0]) {
      this.max_page_links = rows[0].page_counter;
    }
  }.bind(this))

  var lc_sql = mysql.format("SHOW TABLE STATUS WHERE name=?;", [this.links_table])
  this.helper.queryDB(lc_sql, function(results) {
    if (results[0]) {
      this.max_links_count = results[0].Rows;
      this.emit('max_rows_set', this.max_links_count);
    }
  }.bind(this))

  var sql = "SET autocommit=0;\n";
  sql += "ALTER TABLE "+this.links_table+" DISABLE KEYS;\n";
  fs.writeFile(this.dump_file, sql, function (err) {
    if (err) throw err;
  });
  
  this.getPages(0);
  this.emit('importing_start');
  
  this.on('importing_end', function(file) {
    var sql = "COMMIT;\nALTER TABLE "+this.links_table+" ENABLE KEYS;\n";
    fs.appendFile(file, sql, function (err) {
      if (err) throw err;
    });
  });
}

WikiPagesImporter.prototype.getPages = function(offset) {

  // Iterate through results and stop when no more left
  var pages_sql = "SELECT exl.el_from as id, pg.page_title as title, pg.page_counter as counter, exl.el_to as link, pg.page_len as len " +
    "FROM ?? AS exl " +
    "INNER JOIN ?? AS pg ON exl.el_from = pg.page_id AND pg.page_is_redirect = 0 " +
    "GROUP BY exl.el_from " +
    // "ORDER BY exl.el_id ASC " +
    "LIMIT ? OFFSET ?;"

  var sql = mysql.format(pages_sql, [this.links_table, this.pages_table, this.per_pages_page, offset])
  var params;
  
  this.helper.queryDB(sql, function(rows) {
    rows.forEach(function(row) {
      // Add params to list for insertion
      params = this.articleParams(row)
      if (params) {
        this.insert_params.push(params)
      }
    }.bind(this));
    
    // Save all the articles in this group
    // this.saveArticles()
    this.appendSqlToDump()
    
    // Update number of article links scanned
    this.emit('articles_scanned', rows.length);
    
    if (rows.length < this.per_pages_page) {
      this.emit('importing_end', this.dump_file);
    } else {
      this.getPages(offset + this.per_pages_page) ;
    }

  }.bind(this))
}

// Adapted from: http://stackoverflow.com/a/1140335
WikiPagesImporter.prototype.convertDMSToDD = function(degrees, minutes, seconds, direction) {
  var dd = parseFloat(degrees + (minutes/60) + (seconds/(60*60)));

  // Inverse if S or W or O (Ouest -> French FTW!?!)
  if (["S","W","O"].indexOf(direction) > -1) dd *= -1;

  return dd;
}

// Local helper functions
WikiPagesImporter.prototype.geoInfoFromGeoHackURL = function(str) {
  var lat, lng, type;
  lat = lng = type = null;
  
  if (!str) {
    var err = new Error("#geoInfoFromWikiString: str param not provided: "+str);
    this.emit('importing_error', err);
    return;
  }

  var uri = url.parse(str, true, true);
  var params = uri.query.params;
  if (!params) {
    var err = new Error("#geoInfoFromWikiString: params not found in provided str: "+str);
    this.emit('importing_error', err);
    return;
  }
  
  var parts = params.split('_');
  parts = _.without(parts, '');
  
  var index;
  // Frenchies use O for East (ie: Ouest)
  if (~(index = parts.indexOf('O'))) {
    parts[index] = 'E';
  } else if (~(index = parts.indexOf('E'))) {
    // if not E then must be W
  } else if (~(index = parts.indexOf('W'))) {
  }

  // Extract coords
  var coords = ~index ? parts.slice(0, index+1) : [];

  // The number of underscores determine the acceptable format: https://wiki.toolserver.org/view/GeoHack#params
  switch (coords.length) {
  case 8:
    lat = this.convertDMSToDD(parseFloat(coords[0]), parseFloat(coords[1]), parseFloat(coords[2]), coords[3]);
    lng = this.convertDMSToDD(parseFloat(coords[4]), parseFloat(coords[5]), parseFloat(coords[6]), coords[7]);
    
    break;
  case 6:
    lat = this.convertDMSToDD(parseFloat(coords[0]), parseFloat(coords[1]), 0, coords[2]);
    lng = this.convertDMSToDD(parseFloat(coords[3]), parseFloat(coords[4]), 0, coords[5]);
    
    break;
  case 4:
    lat = this.convertDMSToDD(parseFloat(coords[0]), 0, 0, coords[1]);
    lng = this.convertDMSToDD(parseFloat(coords[2]), 0, 0, coords[3]);
    
    break;
  case 1:
    if (params.indexOf(';') > -1) {
      coords = params.split(';')
      lat = this.convertDMSToDD(parseFloat(parts[0]), 0, 0, 'N');
      lng = this.convertDMSToDD(parseFloat(parts[1]), 0, 0, 'W');
    }
    break;
  }

  // Extract Type
  var type_re = /type:([a-z]+)/i;
  var matches;
  if (matches = type_re.exec(params)) {
    type = matches[1].toLowerCase();
  }
  
  // Cannot proceed without full coords
  if (lat===null || lng===null || isNaN(lat) || isNaN(lng)) {
    var err = new Error("Unable to extract coords from: "+str);
    this.emit('importing_error', err);
    return null;
  }

  return {'lat': lat, 'lng': lng, 'type': type};
}

WikiPagesImporter.prototype.articleParams = function(page) {
  var geoInfo = this.geoInfoFromGeoHackURL(page.link)
  if (geoInfo==null) return null;

  // Calc page rank based on length and views
  var rank    = this.getRank(page.len, page.counter);
  var title   = page.title.replace(/_/g, ' ');

  return { 'id': page.id, 'type': geoInfo['type'], 'title': title, 'lng': geoInfo.lng, 'lat': geoInfo.lat, 'rank': rank };
}

WikiPagesImporter.prototype.appendSqlToDump = function() {

  var params_len = this.insert_params.length;
  var iterations = (params_len > this.page_per_insert) ? (this.page_per_insert / params_len) : 1; 

  for (var i = 0; i <= iterations; i++) {

    var start      = i * this.page_per_insert;
    var end        = start + this.page_per_insert;
    var params     = this.insert_params.slice(start, end);
    var sql        = mysql.format("INSERT IGNORE INTO ?? VALUES ", [this.live_table]);
    var sql_vals   = [];

    params.forEach(function(param) {
      sql_vals.push(mysql.format("(?,?,?,?,POINT(?, ?))", [param.id, param.title, param.type, param.rank, param.lng, param.lat]));
    });
    
    if (sql_vals.length > 0) {
      sql = sql + sql_vals.join(', ') + ";";
      fs.appendFile(this.dump_file, sql, function (err) {
        if (err) throw err;
      });
    }
  }
  this.insert_params = [];
}


WikiPagesImporter.prototype.saveArticles = function(callback) {

  var sql        = mysql.format("INSERT IGNORE INTO ?? VALUES ", [this.live_table]);
  var params_len = this.insert_params.length;
  var sql_vals   = [];
  
  this.insert_params.forEach(function(params) {
    sql_vals.push(mysql.format("(?,?,?,?,POINT(?, ?))", [params.id, params.title, params.type, params.rank, params.lng, params.lat]));
  });
  sql = sql + sql_vals.join(', ') + ";";

  this.helper.queryDB(sql, function(result) {
    this.emit('articles_imported', params_len);
    if (callback) callback(result);
  }.bind(this))

  this.insert_params = []
}

WikiPagesImporter.prototype.getRank = function(text_len, views) {
  // Rank is a mix of number of inbound links (from pagelinks table) and article length
  var rank  = Math.min(5, text_len / 10000.0); // 50% of 0 - 10 score based on length. Articles over 100k get 10 points.
      rank += Math.min(5, (views / this.max_page_links) * 5); // 50% of 0 - 10 score based on links
  return rank;
}