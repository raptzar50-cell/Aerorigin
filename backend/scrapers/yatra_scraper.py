import asyncio
import re
from datetime import datetime
from playwright.async_api import async_playwright

AIRLINE_NAME_TO_CODE = {
    "IndiGo": "6E",
    "Air India": "AI",
    "SpiceJet": "SG",
    "Akasa Air": "QP",
    "Vistara": "UK",
    "AIX Connect": "IX",
}

class YatraScraper:
    def scrape_route(self, origin: str, dest: str, date_str: str) -> dict:
        """
        Synchronous wrapper for the async playwright scraper.
        date_str expected format: DD/MM/YYYY
        """
        return asyncio.run(self._scrape(origin, dest, date_str))

    async def _scrape(self, origin: str, dest: str, depart_date: str) -> dict:
        result = {
            "status": "pending",
            "fares": [],
            "error": None
        }

        search_url = (
            f"https://flight.yatra.com/air-search-ui/dom2/trigger?"
            f"type=O&viewName=normal&flexi=0&noOfSegments=1&"
            f"origin={origin}&originCountry=IN&"
            f"destination={dest}&destinationCountry=IN&"
            f"flight_depart_date={depart_date}&"
            f"ADT=1&CHD=0&INF=0&class=Economy&source=fresco-home"
        )

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    channel="msedge",
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-sandbox",
                    ],
                )
                context = await browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                    ),
                    viewport={"width": 1400, "height": 900},
                )
                page = await context.new_page()

                try:
                    await page.goto("https://www.yatra.com", timeout=20000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(1500)
                except Exception:
                    pass

                try:
                    await page.goto(search_url, timeout=45000, wait_until="domcontentloaded")
                except Exception:
                    pass # Often the page loads enough to scrape but trackers cause a timeout
                    
                card_selector = "div.flight-item"
                try:
                    await page.wait_for_selector(card_selector, timeout=30000)
                except Exception:
                    card_selector = "div.tuple"
                    try:
                        await page.wait_for_selector(card_selector, timeout=10000)
                    except:
                        if "Sorry" in await page.content() or "No flights" in await page.content():
                            result["status"] = "empty"
                        else:
                            result["status"] = "failed"
                            result["error"] = "Timeout waiting for results to load."
                        await browser.close()
                        return result

                await page.wait_for_timeout(3500)
                cards = await page.query_selector_all(card_selector)

                if not cards:
                    result["status"] = "empty"
                    await browser.close()
                    return result

                for card in cards:
                    text = await card.inner_text()
                    lines = [line.strip() for line in text.split("\n") if line.strip()]

                    fare_inr = None
                    for idx, line in enumerate(lines):
                        if any(btn in line for btn in ["View Fares", "Book Now", "Book"]):
                            for prev_line in reversed(lines[:idx]):
                                clean = re.sub(r"[^\d]", "", prev_line)
                                if clean.isdigit() and int(clean) >= 1500:
                                    fare_inr = int(clean)
                                    break
                            if fare_inr:
                                break

                    if not fare_inr:
                        matches = re.findall(r"(?:₹\s*|Rs\.?\s*)?([1-9]\d{0,2},\d{3})", text)
                        non_promos = [m for m in matches if m not in ["3,000", "5,000", "4,500"]]
                        if non_promos:
                            fare_inr = int(non_promos[-1].replace(",", ""))

                    airline_name = "Unknown"
                    flight_num = ""
                    for line in lines:
                        if any(al in line for al in AIRLINE_NAME_TO_CODE):
                            airline_name = line
                        elif re.search(r"^(6E|AI|SG|QP|UK|I5|IX)[-\s]?\d+", line):
                            flight_num = line

                    times = re.findall(r"\b([0-2]?\d:[0-5]\d)\b", text)
                    dep_time = times[0] if len(times) > 0 else ""
                    arr_time = times[1] if len(times) > 1 else ""

                    if fare_inr and airline_name != "Unknown":
                        result["fares"].append({
                            "airline": airline_name,
                            "flight_code": flight_num,
                            "dep_time": dep_time,
                            "arr_time": arr_time,
                            "price": str(fare_inr)
                        })

                await browser.close()
                result["status"] = "success"

        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)

        return result
