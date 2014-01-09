#!/usr/bin/env node

var pace = require('pace')(1);
var WikiPagesImporter = require("../js/wiki_pages_importer");
var lang = process.argv[2];
var file = process.argv[3];
var importer = new WikiPagesImporter(lang, file);
var saved_count = 0;
var scanned_count = 0;

importer.on('articles_imported', function(count) {
  saved_count += count;
})

importer.on('articles_scanned', function(count) {
  scanned_count += count;
  pace.op(scanned_count);
})

importer.on('max_rows_set', function(count) {
  pace.total = count;
  pace.op(0)
});


importer.on('importing_error', function(error) {
  // console.error("Error importing! %s", error);
  // throw error;
})

importer.on('importing_end', function(file) {
  pace.op(pace.total);
  console.info("Imported %s articles into SQL dump: %s", saved_count, file);
  console.info("You can import this file by running 'mysql %s < %s'", importer.helper.config.database.database);
  process.exit(0);
})

importer.start(file);