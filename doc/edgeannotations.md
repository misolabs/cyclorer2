# Task
Restructure the edge annotations mechanism to comply with the "UI first" and "eventual consistency" principles used for location annotations

# Features
- Reorganise edge annotation events, UI and backend sync requests
- when clicking on a map routing edge (=layer in edgeNetworkLayers) a popup should be shown with edge properties (already exists) and UI elements to add edge annotations to an edge
- an edge annotation consists of a category for the edge and an optional comment
- all UI features are already present, but the event workflow is a mix of UI first and traditional "UI asks server to store data and shows the result" approaches
- edges should be color-coded according to edge properties and annotations (take precedence)

# Briefing
- tell me what info is missing to prepare a clean plan to build a clean edge annotation system

# Answers
- there can only be one edge annotation per edge
- same treatment as location annotations
- the proposed event flow seems right
- comment edits should be saved even if categories don't change
- annotation id should not be necessary, use edge_id
- UI takes precedence in case of conflict between UI data and backend
- annotation takes precedence over edge properties for styling
- comments are optional (an edge can be marked as a favorite path without further comment)
- deleteing an annotation should remove it immediately from display and result eventually in deletion from backend
- popup controls should be direct action, not modify then save (also true for comment, save as soon as modified)
- 

# Implementation Plan
1. Normalize edge annotations around `edge_id` as the single local key.
   - Keep exactly one edge annotation per edge in `AnnotationRepo`.
   - Treat edge annotation records as UI-first state, like location annotations, and persist changes through queued backend requests.

2. Split edge annotation repo operations into explicit create, update, and delete flows.
   - On create or modify from the UI, update the local edge annotation state immediately.
   - Queue the corresponding backend request afterward so the UI stays responsive even if the network is unavailable.
   - Save comment-only edits as full annotation updates, even when the category is unchanged.

3. Rework `NavigationService` to be the event bridge only.
   - Subscribe to the edge annotation UI events from the popup.
   - Resolve create-vs-update based on whether an edge already has an annotation.
   - Emit the map update events from the local repo state after each UI action and after initial server load.

4. Make the popup UI drive a single edge annotation state.
   - The radio selection should represent the current category for the edge.
   - The comment field should reflect the stored comment for that edge.
   - Delete should remove the annotation for the current edge and update the map immediately.

5. Preserve annotation precedence in edge styling.
   - Keep the existing edge-property-based styling as the baseline.
   - Override it with annotation-based styling when an annotation exists.
   - Ensure category color changes and deletion both trigger a visual refresh of the edge layer.

6. Keep backend sync eventual and observable.
   - Use the request queue for edge annotation mutations so retries behave consistently with location annotations.
   - Emit debug or error notifications for annotation sync success and failure.
   - Ensure startup fetches repopulate the local edge annotation cache and refresh the map state.
