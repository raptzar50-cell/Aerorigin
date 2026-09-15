"""
Convert raw Amadeus offer dicts into the RawFare-compatible dict shape.

Each returned dict matches the RawFare model fields so the pipeline can
insert them directly via the existing run_scrape_cycle flow.
"""
from __future__ import annotations

import random
from datetime import datetime, timezone, date as date_type
from typing import List


CARRIER_NAMES = {
    "6E": "IndiGo",
    "AI": "Air India",
    "UK": "Vistara",
    "SG": "SpiceJet",
    "QP": "Akasa Air",
    "I5": "Air India Express",
    "EK": "Emirates",
    "SQ": "Singapore Airlines",
    "BA": "British Airways",
    "TG": "Thai Airways",
    "CX": "Cathay Pacific",
    "QR": "Qatar Airways",
    "AF": "Air France",
    "LH": "Lufthansa",
    "TK": "Turkish Airlines",
    "EY": "Etihad Airways",
}


def _carrier_name(code: str) -> str:
    return CARRIER_NAMES.get(code, code)


def normalize_amadeus_offers(
    offers: List[dict], travel_date: date_type, cabin: str
) -> List[dict]:
    """Amadeus Flight Offers Search v2 response → List[dict] for RawFare.

    Each dict is shaped as:
    {
        "source": str,
        "origin": str,
        "destination": str,
        "departure_date": date,
        "fare_raw": float,
        "taxes_raw": float,
        "currency": str,
        "scraped_at": datetime,
        "raw_payload": dict,
    }
    """
    now = datetime.now(timezone.utc)
    out: List[dict] = []
    for offer in offers:
        try:
            total_price = float(offer["price"]["total"])
            base_price = float(offer["price"].get("base", total_price))
            currency = offer["price"].get("currency", "INR")
            itin = offer["itineraries"][0]
            segments = itin["segments"]
            first, last = segments[0], segments[-1]
            carrier = first.get("carrierCode", "??")
            flight_number = f"{carrier}{first.get('number', '')}"

            # Estimate taxes as difference between total and base
            taxes = max(0.0, total_price - base_price)
            if taxes == 0.0:
                # Fallback: estimate ~15% taxes
                taxes = round(base_price * 0.15, 2)
                base_price = round(total_price - taxes, 2)

            out.append({
                "source": f"amadeus_{_carrier_name(carrier)}",
                "origin": first["departure"]["iataCode"],
                "destination": last["arrival"]["iataCode"],
                "departure_date": travel_date,
                "fare_raw": round(base_price, 2),
                "taxes_raw": round(taxes, 2),
                "currency": currency,
                "scraped_at": now,
                "raw_payload": {
                    "provider": "amadeus",
                    "airline": _carrier_name(carrier),
                    "flight_number": flight_number,
                    "cabin_class": cabin,
                    "departure_time": first["departure"].get("at"),
                    "arrival_time": last["arrival"].get("at"),
                    "stops": max(0, len(segments) - 1),
                    "total_price": total_price,
                    "mock": False,
                    "synthetic": False,
                },
            })
        except (KeyError, IndexError, ValueError, TypeError):
            # Skip malformed offers rather than failing the whole request
            continue
    return out
