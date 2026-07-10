/**
 * MQTT topic helpers. Centralizes the topic naming convention so that
 * devices, backend services, and the frontend never hand-roll topic
 * strings independently.
 *
 * Base pattern: site/{siteId}/dev/{devId}/{kind}
 */

/** Topic for telemetry samples published by a device. */
export function telemetryTopic(siteId: string, devId: string): string {
  return `site/${siteId}/dev/${devId}/telemetry`;
}

/** Topic for 10-minute aggregate summaries published by a device. */
export function aggregateTopic(siteId: string, devId: string): string {
  return `site/${siteId}/dev/${devId}/aggregate`;
}

/** Topic for alerts published by a device. */
export function alertTopic(siteId: string, devId: string): string {
  return `site/${siteId}/dev/${devId}/alert`;
}

/** Topic for commands sent to a device. */
export function cmdTopic(siteId: string, devId: string): string {
  return `site/${siteId}/dev/${devId}/cmd`;
}

/** Topic for command acknowledgements published by a device. */
export function ackTopic(siteId: string, devId: string): string {
  return `site/${siteId}/dev/${devId}/ack`;
}

/** Wildcard filter matching every topic kind for a given site/device. */
export function topicFilter(siteId: string, devId: string): string {
  return `site/${siteId}/dev/${devId}/#`;
}

/** Wildcard subscription matching every site, device, and kind. */
export const SUB_ALL = "site/+/dev/+/+";

/** QoS levels used for each topic kind. */
export const QOS = {
  telemetry: 0,
  aggregate: 1,
  alert: 1,
  cmd: 1,
  ack: 1,
} as const;
