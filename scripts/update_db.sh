#!/usr/bin/env sh
set -e # Die if any steps produce an error

# Database name
# Note: Use `mysql_config_editor` to set your DB credentials (it's more secure than saving them here!)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

LANGS=( "$@" )
if [ -z $LANGS ]; then
  LANGS=(fr en zh es de ja)
fi
echo "Will import for langs: ${LANGS[*]}..."

if [ -z $DB_NAME ]; then
  DB_NAME='wikilandmarks'
  echo "Using default database: $DB_NAME..."
fi

# Used in the nodejs extract_wiki_geos.js script
if [ -z $DB_USER ]; then
  echo "Please set a DB_USER variable! Eg: $0 DB_USER='xxx' DB_PASS='xxx'"
  exit 1
fi

# Used in the nodejs extract_wiki_geos.js script
if [ -z $DB_PASS ]; then
  echo "Please set a DB_PASS variable! Eg: $0 DB_USER='xxx' DB_PASS='xxx'"
  exit 1
fi

# Iterate through langauges
for i in ${LANGS[*]}; do
  
  echo "Beginning extraction for $i locale..."
  
  #
  # LINKS Dump
  #
	LINKS_DUMP="/tmp/$i-wiki-links.sql"
	LINKS_RAW_DUMP="/tmp/$i-wiki-links-full.sql"
	LINKS_DUMP_GZ="$LINKS_RAW_DUMP.gz"
  LINKS_URL="http://dumps.wikimedia.org/"$i"wiki/latest/"$i"wiki-latest-externallinks.sql.gz"
  LINKS_TBL="links_$i"

  if [ ! -f $LINKS_RAW_DUMP ]; then
    echo "Fetching links dump for $i ($LINKS_URL): ..."
  	curl -o $LINKS_DUMP_GZ $LINKS_URL

    echo "Extracting $LINKS_DUMP_GZ..."
  	gunzip -v $LINKS_DUMP_GZ
  else
    echo "Already extracted links dump. Moving on..."
  fi
  
  # Prepare a dump for mysql
  echo "Preparing $i links dump file... "
  echo "SET autocommit=0;" > $LINKS_DUMP
  echo "ALTER TABLE $LINKS_TBL DISABLE KEYS;" >> $LINKS_DUMP
  echo "DELETE FROM $LINKS_TBL;" >> $LINKS_DUMP
  echo "INSERT INTO $LINKS_TBL VALUES" >> $LINKS_DUMP
  # Strip out all records not matching a geohack url
  sed -e "s/INSERT INTO \`externallinks\` VALUES//g" -e 's/),(/),\'$'\n(/g' -e "s/);/),/g" $LINKS_RAW_DUMP | grep "/geohack.php?" >> $LINKS_DUMP
  sed -i '' -e '$ s/),/);/g' $LINKS_DUMP
  echo "COMMIT;" >> $LINKS_DUMP
  echo "ALTER TABLE $LINKS_TBL ENABLE KEYS;" >> $LINKS_DUMP
  echo "ALTER IGNORE TABLE $LINKS_TBL MODIFY el_to TEXT CHARACTER SET utf8;" >> $LINKS_DUMP

  # Import Dump into DB
  echo "Importing $i links dump into DB... "
  mysql $DB_NAME < $LINKS_DUMP

  #
  # PAGES Dump
  #
	PAGES_DUMP="/tmp/$i-wiki-pages.sql"
	PAGES_RAW_DUMP="/tmp/$i-wiki-pages-full.sql"
	PAGES_DUMP_GZ="$PAGES_RAW_DUMP.gz"
  PAGES_URL="http://dumps.wikimedia.org/"$i"wiki/latest/"$i"wiki-latest-page.sql.gz"
  PAGES_TBL="pages_$i"

  if [ ! -f $PAGES_RAW_DUMP ]; then
    echo "Fetching pages dump for $i ($PAGES_URL): ..."
  	curl -o $PAGES_DUMP_GZ $PAGES_URL

    echo "Extracting $PAGES_DUMP_GZ..."
  	gunzip -v $PAGES_DUMP_GZ
  else
    echo "Already extracted pages dump. Moving on..."
  fi

  echo "Preparing $i pages dump file... "
  echo "SET autocommit=0;" > $PAGES_DUMP
  echo "ALTER TABLE $PAGES_TBL DISABLE KEYS;" >> $PAGES_DUMP
  echo "DELETE FROM $PAGES_TBL;" >> $PAGES_DUMP
  # Format down to only data to insert
  sed -e "s/\`page\`/\`$PAGES_TBL\`/g" -e 's/),(/),\'$'\n(/g' $PAGES_RAW_DUMP | grep "^INSERT\|\d)[,;]$" >> $PAGES_DUMP
  echo "COMMIT;" >> $PAGES_DUMP
  echo "ALTER TABLE $PAGES_TBL ENABLE KEYS;" >> $PAGES_DUMP
  echo "ALTER IGNORE TABLE $PAGES_TBL MODIFY page_title VARCHAR(255) CHARACTER SET utf8;" >> $PAGES_DUMP
  echo ""

  # Import Dump into DB
  echo "Importing $i pages dump into DB... "
  mysql $DB_NAME < $PAGES_DUMP
  
  #
  # Importing pages and geo-links
  #
	LIVE_DUMP="/tmp/$i-wiki-live.sql"
  node $DIR/extract_wiki_geos.js $i $LIVE_DUMP
  
  echo "Importing $i live geo-tagged articles dump into DB... "
  mysql $DB_NAME < $PAGES_DUMP
  
  #
  # Cleanup
  #
  echo "CLeaning up $i supporting links and pages tables"
  mysql $DB_NAME << ENDSQL
   DELETE FROM $LINKS_TBL;
   DELETE FROM $PAGES_TBL;
ENDSQL

  rm $PAGES_DUMP $PAGES_RAW_DUMP $LINKS_DUMP $LINKS_RAW_DUMP $LIVE_DUMP

done

exit 0