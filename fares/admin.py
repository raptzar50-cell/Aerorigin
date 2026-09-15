from django.contrib import admin
from .models import RawFare, CleanFare, PriceIndex

admin.site.register(RawFare)
admin.site.register(CleanFare)
admin.site.register(PriceIndex)
