var app_modules = require('../js/app'),
    app     = app_modules.app,
    mysql   = app_modules.mysql,
    helper  = app_modules.helper,
    fs      = require('fs'),
    _       = require('underscore'),
    request = require('supertest'),
    should  = require('should'),
    glob    = require('glob');

// Clear data then load fixtures
function loadFixtures(){
	
  var json = JSON.parse(fs.readFileSync("./test/fixtures/articles.json", {'encoding': 'utf8'}));

	// Load into DB using app's connection
	var table_name  = _.keys(json)[0],
	    rows        = json[table_name],
	    sql         = mysql.format("DELETE FROM ??", [table_name]);
	
	helper.queryDB(sql);
	
	_.each(rows, function(row) {
		var sql_params = [table_name],
			vals = [],
		    cols = [];

		_.each(_.keys(row), function(key) {
			cols.push(key)
			
			if (key=='coord') {
				vals.push("POINT("+row.coord.x+", "+row.coord.y+")");
			} else {
				vals.push(mysql.format('?',row[key]));
			}
		})
		sql = mysql.format("INSERT INTO ?? ("+cols.join(", ")+") VALUES ("+vals.join(", ")+");", sql_params);
		
		// console.log(sql);
		helper.queryDB(sql);

	})
}

describe("Landmark API", function() {

	before(function(){
		loadFixtures();
	});

    it("should GET 404", function(done){
		request(app)
			.get('/notfoundurl')
			.expect(404)
			.expect(/Cannot GET/)
			.end(done);
	})
		

    it("should GET /", function(done){
		request(app)
			.get('/')
			.expect(200)
			.expect(/Hallo World/)
			.end(done);
	})
		
    it("should GET /radius.json", function(done){
		request(app)
			.get('/radius.json')
			.query({
				lat:  48.3711460106463,
				lng:  1.4719096811529,
				dist: 15,
				lang: 'en'
			})
			.expect(200)
			.expect(function(res) {
				res.body.should.have.property('landmarks').with.lengthOf(100);
				_.each(['title', 'dist', 'rank', 'lang'], function(key) {
					res.body.landmarks[0].should.have.property(key)
				})
			})
			.expect('Content-Type', /json/)
			.end(done);
	})

    it("should GET /boundingbox.json", function(done){
		request(app)
		.get('/boundingbox.json')
		.query({
			west:  1.4719096811529,
			north: 48.3711460106463,
			south: 46.6077992831465,
			east:  3.7449832203244,
			lang:  'en'
		})
		.expect(200)
		.expect(function(res) {
			res.body.should.have.property('landmarks').with.lengthOf(21);
			_.each(['title', 'lat', 'lng', 'rank', 'lang'], function(key) {
				res.body.landmarks[0].should.have.property(key)
			})
		})
		.expect('Content-Type', /json/)
		.end(done);
	})


});