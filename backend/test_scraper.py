import os
import django

# Setup django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aerogin.settings')
django.setup()

from scrapers.yatra_scraper import YatraScraper

print("Testing Yatra Scraper for UDR to DEL...")
scraper = YatraScraper()
result = scraper.scrape_route("UDR", "DEL", "15/09/2026")
print(result)
