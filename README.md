# landmark-api


Landmark API is Nodejs API for Wikipedia geo-tagged pages (it powers the [iOS Landmarks app](http://www.landmarkapp.io))

The project consists of two parts described in further detail below; the API and an import script that extracts geo-tagged articles out of the Wikipedia SQL dump files which can be used to seed/update your database.

An important feature is that geo-tagged articles are ranked based on their view count and content length to help provide better quality results when looking at larger regions.

As of April 2014 the below locales have been imported:

1. English:              914,811  (articles)
1. German:               335,487  (articles)
1. French:               299,697  (articles)
1. Spanish:              223,140  (articles)
1. Chinese (Simplified): 145,962  (articles)
1. Japanese:             99,732   (articles)

## Dependencies

The following should be enough for the API to be used:

1. NodeJS with NPM (v0.10+)
2. MySQL 5.6 with Spatial functions enabled

This has only be tested on OSX and Linux systems, if anyone gets it running on Windows please let me know!

## Getting Started

After cloning the project run `npm install` to install all dependencies. 

#### 1. Creating the Database Schema

Next setup the DB schema you require via the `./script/create_db.sh` script. 

Eg:
```
./script/create_db.sh DB_USER=landmarks
```

This uses 'wikilandmarks' as the default database name, but you can override this using a `DB_NAME` environment variable. 

The default locales created are:

* French
* English
* Chinese Simplified
* Spanish
* German
* Japanses

You may specify the locales to use by providing them as arguments to the script:

Eg:
```
./script/create_db.sh en fr es DB_USER=landmarks
```

The full list of available locales may be viewed [here](http://en.wikipedia.org/wiki/List_of_Wikipedias#List).

**Note:** It is expected that you use `mysql_config_editor` to set your admin DB credentials so that they don't need to be included in env vars or scripts.

#### 2. Seed the Database

Data can be seeded up updated using the `./scripts/update_db.sh` script which supports the same arguments as the `create_db.sh` script. However the DB_USER env variable is not reqired.

Eg:
```
./script/update_db.sh en fr es
```

The script will download the latest SQL dump files from Wikipedia, input them into your database and then extract all geo-tagged wikipedia articles for each locale. The downloaded data is cleaned out at the end leaving only the geo-tagged articles.

**Note:** Due to the large amount of data this is a long process!

#### 3. Launch the API

Next launch the app via `node ./js/index.js`. This will launch the clustered app with n workers for each CPU core available. If you'd like to customize the number of workers use the WORKERS=n env variable. The app looks for database connection credentials via DB_USER and DB_PASS environment variables (see `./config/app.yml` for details).

## API


The API is very minimal and currently features the following endpoints:

### Requests

#### /radius.json 

Returns a list of geo-tagged wiki articles that fall within the specified radius of a given latitude/longitude coordinate.

**Example**:
```
/radius.json?lat=40.723779&lng=-73.991288999999995&dist=10&maxRows=50&lang=en
```

Accepted parameters are:

* **lat**: decimal latidude value (required)
* **lng**: decimal longitude value (required)
* **dist**: size of radius in kilometers (required)
* **lang**: a language local (see the Data Seeding section below regarding the creation of these) (required)
* **maxRows**: number of results to return (the default and max allowed is 100)


#### /boundingbox.json

Returns a list of geo-tagged wiki articles that fall within the bounding box of given North, South, East, West coordinates.

**Example**: 
``` 
/boundingbox.json?west=2.1700748001848&north=48.1743502748553&south=47.8207829081905&east=2.5330358875651&maxRows=50&lang=en 
```

Accepted parameters are:

* **north**: decimal latidude value (required)
* **south**: decimal latidude value (required)
* **west**:  decimal longitude value (required)
* **east**:  decimal longitude value (required)
* **lang**: a language local (see the Data Seeding section below regarding the creation of these) (required)
* **maxRows**: number of results to return (the default and max allowed is 100)

### Responses

All requests return the same base format, an example of which is shown below.

**Example**:
```
{
  "landmarks": [
    {
      "pageid": 6908,
      "dist": 1.0549535798050251,
      "title": "New York City/Archive 10",
      "lat": 40.71,
      "lng": -74,
      "rank": 10,
      "lang": "en"
    },
    {
      "pageid": 29383,
      "dist": 0.8937021069249003,
      "title": "Stonewall riots",
      "lat": 40.7338,
      "lng": -74.0021,
      "rank": 10,
      "lang": "en"
    }
  ]
}
```

**Notes:**

* The **dist** field is only included in the radius.json endpoint response
* The **pageid** field represents the unique internal wikipedia id for that article

## Motivation

Why create this? During the development of the [iOS Landmarks app](http://www.landmarkapp.io), I found that the existing solutions of [geonames.org](http://www.geonames.org/export/wikipedia-webservice.html#findNearbyWikipedia) and [wikilocation.org](http://wikilocation.org/documentation/) were both way too slow and too often had invalid/false locations.

Since I wanted to provide a simple solution that would be performant and cheap to run, none of the alternatives were suitable. So landmark-api was created.

Not only does this provide an open-source API for accessing geo-tagged wikipedia articles but it can also be used to extract these articles from wikipedia for other purposes. :-)

## Contributing

Feel free to fork and submit PRs!

## Feature Requests & Bugs

See https://github.com/supagroova/landmark-api/issues


