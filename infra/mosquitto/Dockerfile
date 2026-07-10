# Mosquitto broker image with a permissive dev config baked in (listener on
# 1883, anonymous allowed) so it deploys standalone on Coolify. For production,
# switch to the TLS listener + per-device auth in mosquitto.conf.
FROM eclipse-mosquitto:2
COPY mosquitto.conf /mosquitto/config/mosquitto.conf
EXPOSE 1883
