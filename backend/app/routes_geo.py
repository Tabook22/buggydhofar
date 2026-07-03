import json


def normalize_route_payload(data: dict) -> dict:
    """Keep start/end coords and labels in sync with path_points waypoints."""
    raw = data.get("path_points") or "[]"
    try:
        points = json.loads(raw)
    except json.JSONDecodeError:
        points = []

    if not isinstance(points, list):
        return data

    waypoints = [point for point in points if isinstance(point, dict) and point.get("curve") is not True]
    if len(waypoints) < 2:
        return data

    first = waypoints[0]
    last = waypoints[-1]
    data["start_lat"] = float(first["lat"])
    data["start_lng"] = float(first["lng"])
    data["end_lat"] = float(last["lat"])
    data["end_lng"] = float(last["lng"])

    if not str(data.get("start_location") or "").strip():
        title = first.get("title")
        data["start_location"] = title or f"Start ({first['lat']}, {first['lng']})"

    if not str(data.get("end_location") or "").strip():
        title = last.get("title")
        data["end_location"] = title or f"End ({last['lat']}, {last['lng']})"

    return data
