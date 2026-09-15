import sys
from django.core.management.base import BaseCommand
from scrapers.predictions import predict_price

class Command(BaseCommand):
    help = 'Tests the prediction curve to ensure price rises as days_out decreases.'

    def handle(self, *args, **options):
        routes = ['DEL-BOM', 'BOM-DEL', 'BLR-DEL']
        days_out_list = [30, 14, 7, 1]
        
        for route in routes:
            self.stdout.write(self.style.SUCCESS(f"\n--- Testing Route: {route} ---"))
            for days in days_out_list:
                pred = predict_price(route, 'Vistara', 'Economy', days)
                price = pred['predicted_price']
                price_str = f"INR {price}" if price else "N/A"
                self.stdout.write(f"Days Out: {days:2} | Price: {price_str:8} | Confidence: {pred['confidence']:6} | Based on: {pred['based_on']}")
