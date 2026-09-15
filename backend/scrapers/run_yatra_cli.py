import sys
import json
from yatra_scraper import YatraScraper

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(json.dumps({"status": "failed", "error": "Missing arguments"}))
        sys.exit(1)
        
    origin = sys.argv[1]
    dest = sys.argv[2]
    date_str = sys.argv[3]
    
    try:
        scraper = YatraScraper()
        result = scraper.scrape_route(origin, dest, date_str)
        # Ensure we only print the JSON to stdout for subprocess parsing
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"status": "failed", "error": str(e)}))
