# Build Timestamp Integration

- 2026-07-16 09:40:39 CEST — Added OSM way popups for `RemoteGeoJsonTileLayer` in `src/maps/trackingmap.ts` and extended `src/maps/remotegeotilelayer.ts` with an optional `onEachFeature` callback to bind popups per feature.

- 2026-07-13 08:54:29 CEST — Hardened `EventBus` dispatch so a failing event or request handler is logged and no longer prevents later handlers from running.

- 2026-07-13 08:51:22 CEST — Converted `OpenWeatherConditionCode` in `src/weather/weatherconditions.ts` from enum syntax to an `as const` object plus value type so it is compatible with `erasableSyntaxOnly`.

- 2026-07-13 08:48:25 CEST — Repaired the malformed `alertConditions` definition in `src/weather/weatherconditions.ts` so TypeScript build validation can proceed again.

- 2026-07-13 08:47:10 CEST — Fixed live settings application regression by making `DebugOverlay` tolerate a missing `#debug` element and syncing it on both `settings:loaded` and `settings:updated`, preventing it from blocking other settings listeners.

- The GitHub Actions deploy workflow now generates a build timestamp file (build-timestamp.json) in the dist directory after building the project. This file contains the UTC timestamp of the build in ISO format and will be available to the deployed app for display on the splash screen.

---

2026-05-07

- Refactored annotation logic out of NavigationService into a new AnnotationService class (src/services/annotationservice.ts). All annotation event handling and repo logic is now encapsulated in AnnotationService. NavigationService delegates annotation loading to the new service.
