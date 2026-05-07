# Build Timestamp Integration

- The GitHub Actions deploy workflow now generates a build timestamp file (build-timestamp.json) in the dist directory after building the project. This file contains the UTC timestamp of the build in ISO format and will be available to the deployed app for display on the splash screen.

---

2026-05-07

- Refactored annotation logic out of NavigationService into a new AnnotationService class (src/services/annotationservice.ts). All annotation event handling and repo logic is now encapsulated in AnnotationService. NavigationService delegates annotation loading to the new service.
