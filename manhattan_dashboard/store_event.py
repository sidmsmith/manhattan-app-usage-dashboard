event = data.get("event", {})

# Fire a Home Assistant event with all metadata included
hass.bus.fire("app_usage_event", event)
