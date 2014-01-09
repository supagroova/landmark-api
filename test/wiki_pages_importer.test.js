var WikiPagesImporter = require("../js/wiki_pages_importer"),
    mysql    = require('mysql'),
    should   = require('should'),
    sinon    = require('sinon'),
    config   = require('konfig')(),
    Helper   = require('../js/helper'),
    Stream   = require('stream'),
    fs       = require('fs'),
    readline = require('readline');

config.app.database.readOnly = false;
var helper  = new Helper(config.app);

process.setMaxListeners(50);

describe("WikiPagesImporter", function() {

  var subject, result;

  var pages = [
  {
    "link": "//toolserver.org/~geohack/geohack.php?pagename=Perth&params=25_52_21_N_113_18_34_E_scale:100000",
    "len": 2000,
    "counter": 200,
    "title": "Perth",
    "id": "1234"
  },
  {
    "link": "//toolserver.org/~geohack/geohack.php?pagename=Adelaide&params=25_52_21_N_113_18_34_E_scale:100000",
    "len": 3000,
    "counter": 500,
    "title": "Adelaide",
    "id": "1235"
  },
  {
    "link": "//toolserver.org/~geohack/geohack.php?pagename=Melbourne&params=25_52_21_N_113_18_34_E_scale:100000",
    "len": 4000,
    "counter": 1500,
    "title": "Melbourne",
    "id": "1236"
  },
  {
    "link": "//toolserver.org/~geohack/geohack.php?pagename=Sydney&params=25_52_21_N_113_18_34_E_scale:100000",
    "len": 4000,
    "counter": 1000,
    "title": "Sydney",
    "id": "1237"
  }
  ]


	beforeEach(function(){
    // Create new instance of importer
		subject = new WikiPagesImporter('en');
    subject.max_page_links = 100000;
    
	});

  describe("#start", function() {
    it("should call the #getPages method", function(){
      var stub = sinon.stub(subject, "getPages");
      subject.start();
      stub.calledOnce.should.be.true;
    })
  })

  describe("#getPages", function() {
    
    beforeEach(function() {
      pages.forEach(function(page) {
        subject.helper.queryDB("DELETE FROM links_en;");
        var links_insert = mysql.format("INSERT INTO links_en VALUES (?,?,?,?);", [parseInt(page.id), page.id, page.link, page.link]);
        subject.helper.queryDB(links_insert);

        subject.helper.queryDB("DELETE FROM pages_en;");
        var pages_insert = mysql.format("INSERT INTO pages_en (page_id, page_title, page_restrictions) VALUES (?,?,?);", [parseInt(page.id),page.title, '1']);
        subject.helper.queryDB(pages_insert);
      });
    });
    
    it("should should fetch pages from the DB", function(){
      var spy = sinon.spy(subject.helper, "queryDB");
      subject.getPages(0);
      spy.calledOnce.should.be.true;
      spy.calledWithMatch("SELECT").should.be.true;
    })

    it.skip("should should recurse when there are more records to fetch", function(){
      
      // Insert more rules
      subject.per_pages_page = 2;
      var spy = sinon.spy(subject.helper, "queryDB");
      subject.getPages(0);
      spy.calledTwice.should.be.true;
      spy.withArgs(500).calledOnce
    })

    it("should should not recurse when there are no more records to fetch", function(){
      subject.helper.queryDB("DELETE FROM pages_en;");
      var spy = sinon.spy(subject.helper, "queryDB");
      subject.getPages(0);
      spy.calledTwice.should.be.false;
    })
  })

  describe("#convertDMSToDD", function() {

    it("should convert degress to decimals", function(){
      // Älvsered
      // 57°14′N -> 57.2333 
      // 12°52′E -> 12.8667
      subject.convertDMSToDD(57,14,0,'N').should.equal(57.233333333333334)
      subject.convertDMSToDD(12,52,0,'E').should.equal(12.866666666666667)
      
      // Perth
      // 31°57′8″S   -> -31.95
      // 115°51′32″E -> 115.867
      subject.convertDMSToDD(31,57,8,'S').should.equal(-31.952222222222222)
      subject.convertDMSToDD(115,51,32,'E').should.equal(115.85888888888888)
      
    })

  })

  describe("#geoInfoFromGeoHackURL", function() {

    it("should return object with properties", function(){
      result = subject.geoInfoFromGeoHackURL("//toolserver.org/~geohack/geohack.php?pagename=User:Waihorace/SE/21st&params=61.1_N_77.1_W_type:city")
      result.should.be.an.instanceOf(Object);
      result.should.have.property('lat');
      result.should.have.property('lng');
      result.should.have.property('type');
    })
    
    it("should return lat & lng in urls fixture", function(){
      // Read in coords fixture
      var urls = JSON.parse(fs.readFileSync("./test/fixtures/urls.json", {'encoding': 'utf8'})).urls;
      
      urls.forEach(function(obj) { 
        result = subject.geoInfoFromGeoHackURL(obj.str);
        result.lat.should.equal(obj.lat);
        result.lng.should.equal(obj.lng);
      });
    });
    
    it.skip("should return error object for invalid coords", function() {
    });
  })

  describe("#articleParams", function() {
    it("should return a formatted object", function(){
      result = subject.articleParams(pages[0]);
      result.should.have.property('lat');
      result.should.have.property('lng');
      result.should.have.property('type');
      result.should.have.property('id');
      result.should.have.property('title');
      result.should.have.property('rank');
    });
  });

  describe("#appendSqlToDump", function() {
    var params = [];
    
    beforeEach(function() {
      pages.forEach(function(page) {
        params.push(subject.articleParams(page))
      })
    })
    
    it("should append INSERT SQL to the dump_file", function(){
      params.length.should.eql(pages.length);
      subject.insert_params = params;
      subject.appendSqlToDump();

      var contents = fs.readFileSync(subject.dump_file);
      String(contents).should.match(/INSERT/);
    });
  });
    
  describe("#saveArticle", function() {
    var params = [];
    
    beforeEach(function() {
      pages.forEach(function(page) {
        params.push(subject.articleParams(page))
      })
    })
    
    it("should add a record to the DB", function(done){
      params.length.should.eql(pages.length);
      subject.insert_params = params;
      subject.saveArticles(function(result) {
        result.affectedRows.should.be.eql(params.length);
        done();
      });
    });
  });
  
  describe("#getRank", function() {
    it("should update an article with it's page rank", function() {
      subject.getRank(100000, 100000).should.eql(10);
    });
  });

});