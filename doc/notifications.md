# Task
Add a visual notification system to the app
It should be clearly visible and not distract too much while riding

# Features
- triggered via EventBus "notification:show" with NotificationData object
- NotificationData:
  - type: ERROR, WARNING, SUCCESS, INFO
  - caption
  - description
  - autoclose delay
- notifications are color-coded by type
- notification autoclose if specified or close on click / tap
- notifications are shown in the top middle part of the screen in mobile and desktop modes
- include a fitting material design glyph icon from the included font

# General
- ask if something is unclear
- use self-explaining names and try to integrate into existing coding style
