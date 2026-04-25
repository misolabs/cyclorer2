# RequestBus Feature

## Task
Extend the EventBus class to include requests to be emitted in a similar way as events.

## Idea
Currently all application components are connected to the event bus without knowing each other. Anyone can emit an event with associated data in order to trigger some behaviour in a different part of the application. EventBus requests shoudl work similarly: any component can issue a (predefined) request through EventBus.request(). Other components can register for this request type. When a request is issued, each registered component gets the opportunity to fulfill the request by returning the requested object type. If a component returns undefined, the next registered components gets its turn.

## Implementation
- Add a new type Requests similar to Events with an input type and a return type
- Add a request() method to EventBus that takes a Requests member and (optionally) an input object and return undefined or the predefined return type
- For testing, add the Request "annotations:requests:queuesize" with no parameter which return the number of Rest Requests in the retry queue
- Emit this request in the Settings view and visualise result
