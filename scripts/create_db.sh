#!/usr/bin/env sh

# Database name
# Note: Use mysql_config_editor to set your DB credentials (it's more secure than saving them here!)

# Don't forget to assign access to this function! Eg:
#  GRANT EXECUTE ON FUNCTION $DB_NAME.harvesine TO 'your_db_username'@'localhost';"

if [ -z $DB_NAME ]; then
  DB_NAME='wikilandmarks'
  echo "Using default database: $DB_NAME..."
fi

# Used in the nodejs extract_wiki_geos.js script
if [ -z $DB_USER ]; then
  echo "Please set a DB_USER variable! Eg: $0 DB_USER='xxx'"
  exit 1
fi

mysql << END

DROP DATABASE IF EXISTS $DB_NAME;

CREATE DATABASE $DB_NAME;

END

LANGS=("$@")
if [ -z $LANGS ]; then
  LANGS=(fr en zh es de ja)
fi
echo "Creating tables for: ${LANGS[*]}..."

for i in ${LANGS[*]}; do

  articles_table="live_$i"
  links_table="links_$i"
  pages_table="pages_$i"

mysql $DB_NAME << END

  DROP TABLE IF EXISTS $articles_table;
  CREATE TABLE $articles_table (
    id int(8) unsigned NOT NULL,
    title varchar(255) NOT NULL,
    type varchar(64),
    rank int(4) DEFAULT 0,
    coord point NOT NULL,
    UNIQUE KEY unique_id (id),
    UNIQUE KEY unique_title (title),
    KEY gc_from (id),
    SPATIAL KEY live_ (coord)
  ) ENGINE=MyISAM DEFAULT CHARSET=utf8;
  
  CREATE INDEX ranking_$articles_table ON $articles_table (rank);
  
  DROP TABLE IF EXISTS $links_table;
  CREATE TABLE $links_table (
    el_id int(10) unsigned NOT NULL AUTO_INCREMENT,
    el_from int(8) unsigned NOT NULL DEFAULT '0',
    el_to text CHARACTER SET utf8 DEFAULT NULL,
    el_index blob NOT NULL,
    PRIMARY KEY (el_id),
    KEY el_from (el_from,el_to(40)),
    KEY el_to (el_to(60),el_from),
    KEY el_index (el_index(60))
  ) ENGINE=MyISAM AUTO_INCREMENT=6284094 DEFAULT CHARSET=utf8;
  
  DROP TABLE IF EXISTS $pages_table;
  CREATE TABLE $pages_table (
    page_id int(8) unsigned NOT NULL AUTO_INCREMENT,
    page_namespace int(11) NOT NULL DEFAULT '0',
    page_title varchar(255) CHARACTER SET utf8 DEFAULT NULL,
    page_restrictions tinyblob NOT NULL,
    page_counter bigint(20) unsigned NOT NULL DEFAULT '0',
    page_is_redirect tinyint(1) unsigned NOT NULL DEFAULT '0',
    page_is_new tinyint(1) unsigned NOT NULL DEFAULT '0',
    page_random double unsigned NOT NULL DEFAULT '0',
    page_touched varbinary(14) NOT NULL DEFAULT '',
    page_links_updated varbinary(14) DEFAULT NULL,
    page_latest int(8) unsigned NOT NULL DEFAULT '0',
    page_len int(8) unsigned NOT NULL DEFAULT '0',
    page_no_title_convert tinyint(1) NOT NULL DEFAULT '0',
    PRIMARY KEY (page_id),
    KEY page_random (page_random),
    KEY page_len (page_len),
    KEY page_redirect_namespace_len (page_is_redirect,page_namespace,page_len)
  ) ENGINE=MyISAM AUTO_INCREMENT=3900431 DEFAULT CHARSET=utf8;

  GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE $DB_NAME.$articles_table TO '$DB_USER'@'localhost';
  GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE $DB_NAME.$links_table TO '$DB_USER'@'localhost';
  GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE $DB_NAME.$pages_table TO '$DB_USER'@'localhost';

END

  echo "Created tables for $i in $DB_NAME..."

done

mysql $DB_NAME << END
  
  DELIMITER ;
  
  CREATE DEFINER = CURRENT_USER function harvesine (lat1 double, lon1 double, lat2 double, lon2 double) returns double
   return  3956 * 2 * ASIN(SQRT(POWER(SIN((lat1 - abs(lat2)) * pi()/180 / 2), 2) 
           + COS(abs(lat1) * pi()/180 ) * COS(abs(lat2) * pi()/180) * POWER(SIN((lon1 - lon2) * pi()/180 / 2), 2) ));

  GRANT EXECUTE ON FUNCTION $DB_NAME.harvesine TO '$DB_USER'@'localhost';

END

exit 0