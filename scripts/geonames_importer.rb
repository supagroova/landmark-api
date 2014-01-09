require 'rubygems'
require 'sqlite3'
require 'httparty'
require 'pp'

class Hash
  
  def symbolize_keys!
    transform_keys!{ |key| key.to_sym rescue key }
  end
  
  def transform_keys!
    keys.each do |key|
      self[yield(key)] = delete(key)
    end
    self
  end
  
end

module WikiLandmarks 

  class GeoNames
    include HTTParty
    base_uri 'http://api.geonames.org'
    format :json
    default_params username: 'kennedia', maxRows:  100
    debug_output $stderr
  
    def initialize(lang)
      self.class.default_params lang: lang
    end
  
    def get_bounding_box(options)
      self.class.get "/wikipediaBoundingBoxJSON", query: options
    end
  
  end

  class Database
    
    attr_reader :db
    
    def initialize(lang)
      @lang = lang
      @db   = SQLite3::Database.new "wiki_landmarks.db"
      
      # Create Schema
      rows = db.execute <<-SQL
        create table if not exists landmarks (
          title varchar(30) NOT NULL,
          lang varchar(2) NOT NULL,
          lat double NOT NULL,
          lng double NOT NULL,
          rank int NOT NULL,
          region_rowid int NOT NULL
        );
        create unique index if not exists landmark_title on landmarks (title, lang);

        create table if not exists regions (
          north double NOT NULL,
          south double NOT NULL,
          west double NOT NULL,
          east double NOT NULL,
          scanned_en int default 0,
          scanned_fr int default 0,
          scanned_es int default 0,
          scanned_de int default 0,
          scanned_ja int default 0,
          scanned_zh int default 0
        );
        create unique index if not exists region_coords on regions (north, south, west, east);
        
      SQL
      
      create_regions!
      
    end
    
    def create_landmark_unless_exists(params, region_id)
      if !landmark_exists(params[:title])
        create_landmark!(params, region_id)
      end
    end
    
    def landmark_exists(title)
      @db.get_first_value("select count(rowid) from landmarks where title = ? and lang= ?", title, @lang) > 0
    end

    def find_regions(limit, offset)
      @db.execute2("select rowid, * from regions where scanned_#{@lang} = 0 limit #{limit} offset #{offset}")
    end
    
    def mark_region_scanned!(region_rowid)
      @db.execute2("update regions set scanned_#{@lang} = ? where rowid = ?", 1, region_rowid)
    end
    
    def total_regions
      @db.get_first_value("select count(rowid) from regions")
    end
    
    private
    
    def create_landmark!(params, region_id)
      @db.execute2("insert into landmarks values ( ?, ?, ?, ?, ?, ?)", 
                    params[:title], params[:lang], params[:lat], params[:lng], params[:rank], region_id)
    end
    
    def create_regions!
      if total_regions == 0
        # Iterate north to south and then east to west creating regions for each degree
        (-180..179).each do |lng|
          @db.transaction
          (-90..89).each do |lat|
            @db.execute2("insert into regions values ( ?, ?, ?, ?, 0, 0, 0, 0, 0, 0)", lat, lat+1, lng, lng+1)
          end
          @db.commit
        end
      end
    end
    
  end

  class Scraper
    
    attr_reader :db, :geonames
    
    def initialize(lang)
      
      @db = Database.new(lang)
      @geonames = GeoNames.new(lang)
      
    end
    
    def scrape!
      
      per_page = 100
      continue = true
      i = 0
      while continue do
        columns, *regions = @db.find_regions(per_page, i * per_page)
        regions.each do |region|
          params  = Hash[columns.map(&:to_sym).zip(region)]
          rowid   = params.delete(:rowid)

          puts "Entering Region #{rowid}: #{params.inspect}"
          results = @geonames.get_bounding_box(params)
          
          # Add each landmark returned
          results["geonames"].each do |landmark|
            print '.'
            landmark.symbolize_keys!
            @db.create_landmark_unless_exists(landmark, rowid)
          end
          
          # If there are the max number of results returned will need to zoom in further
          # Split the region into 4 smaller regions to be scanned later
          
          # Continue?
          if (regions.count < per_page) 
            continue = false
          else
            i += 1
          end
          
        end
      end
    end
    
  end

end

# scraper = WikiLandmarks::Scraper.new('en')
# scraper.scrape!

