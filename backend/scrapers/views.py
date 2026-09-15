import threading
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import ScrapeJob, ScrapedFare
from .yatra_scraper import YatraScraper

def run_scrape_job(job_id):
    try:
        job = ScrapeJob.objects.get(id=job_id)
        job.status = 'running'
        job.save()

        scraper = YatraScraper()
        result = scraper.scrape_route(job.origin, job.destination, job.travel_date)

        if result['status'] == 'success':
            job.status = 'success'
            fares_to_create = []
            for fare_data in result['fares']:
                fares_to_create.append(
                    ScrapedFare(
                        job=job,
                        airline=fare_data.get('airline', 'Unknown'),
                        flight_code=fare_data.get('flight_code', ''),
                        price=fare_data.get('price', '0'),
                        dep_time=fare_data.get('dep_time', ''),
                        dep_city=fare_data.get('dep_city', job.origin),
                        arr_time=fare_data.get('arr_time', ''),
                        arr_city=fare_data.get('arr_city', job.destination),
                        duration=fare_data.get('duration', ''),
                        source='yatra_live'
                    )
                )
            ScrapedFare.objects.bulk_create(fares_to_create)
            job.result_count = len(fares_to_create)
        else:
            job.status = result['status']
            job.error_message = result.get('error', '')
            
    except Exception as e:
        if 'job' in locals():
            job.status = 'failed'
            job.error_message = str(e)
            job.save()
    finally:
        if 'job' in locals():
            job.finished_at = timezone.now()
            job.save()

class ScraperTriggerView(APIView):
    def post(self, request):
        origin = request.data.get('origin')
        destination = request.data.get('destination')
        date = request.data.get('date') # Expected format DD/MM/YYYY

        if not origin or not destination or not date:
            return Response({'error': 'origin, destination, and date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        job = ScrapeJob.objects.create(
            origin=origin,
            destination=destination,
            travel_date=date,
            status='pending'
        )

        thread = threading.Thread(target=run_scrape_job, args=(job.id,))
        thread.start()

        return Response({'job_id': job.id, 'status': job.status}, status=status.HTTP_202_ACCEPTED)

class ScraperJobsView(APIView):
    def get(self, request):
        jobs = ScrapeJob.objects.all().order_by('-started_at')[:50]
        data = []
        for job in jobs:
            data.append({
                'id': job.id,
                'origin': job.origin,
                'destination': job.destination,
                'travel_date': job.travel_date,
                'status': job.status,
                'started_at': job.started_at,
                'finished_at': job.finished_at,
                'result_count': job.result_count,
                'error_message': job.error_message
            })
        return Response(data)

    def delete(self, request):
        status_filter = request.query_params.get('status')
        if status_filter == 'failed':
            deleted_count, _ = ScrapeJob.objects.filter(status__in=['failed', 'blocked']).delete()
            return Response({'success': True, 'deleted': deleted_count})
        return Response({'error': 'Invalid delete filter'}, status=status.HTTP_400_BAD_REQUEST)

class ScraperJobDetailView(APIView):
    def get(self, request, job_id):
        try:
            job = ScrapeJob.objects.get(id=job_id)
        except ScrapeJob.DoesNotExist:
            return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)

        job_data = {
            'id': job.id,
            'origin': job.origin,
            'destination': job.destination,
            'travel_date': job.travel_date,
            'status': job.status,
            'started_at': job.started_at,
            'finished_at': job.finished_at,
            'result_count': job.result_count,
            'error_message': job.error_message,
        }

        fares = job.fares.all()
        fares_data = []
        for fare in fares:
            fares_data.append({
                'id': fare.id,
                'airline': fare.airline,
                'flight_code': fare.flight_code,
                'price': fare.price,
                'dep_time': fare.dep_time,
                'dep_city': fare.dep_city,
                'arr_time': fare.arr_time,
                'arr_city': fare.arr_city,
                'duration': fare.duration,
                'source': fare.source,
                'scraped_at': fare.scraped_at
            })

        return Response({'job': job_data, 'fares': fares_data})

    def delete(self, request, job_id):
        try:
            job = ScrapeJob.objects.get(id=job_id)
        except ScrapeJob.DoesNotExist:
            return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)

        job.delete()
        return Response({'success': True, 'message': f'Job #{job_id} deleted successfully'}, status=status.HTTP_200_OK)


class ScrapedFareDetailView(APIView):
    def delete(self, request, fare_id):
        try:
            fare = ScrapedFare.objects.get(id=fare_id)
        except ScrapedFare.DoesNotExist:
            return Response({'error': 'Fare not found'}, status=status.HTTP_404_NOT_FOUND)

        job = fare.job
        fare.delete()
        if job:
            job.result_count = job.fares.count()
            job.save(update_fields=['result_count'])

        return Response({'success': True, 'message': f'Fare #{fare_id} deleted successfully'}, status=status.HTTP_200_OK)
