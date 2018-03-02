# feather-dgi

Backend server for it-depends.


FIND
    Used to get multiple items.
GET REST endpoint /db?{start}&{direction}&{distance}&{full}
 * Used to GET a list of dependencies
 *
 * start: Optional, used as the starting point for the search.
 *    accepted values: Any valid identifier.
 *    default value: "none".
 * direction: Optional, used to determine the direction of the search.
 *    accepted values: "Up", "Down"
 *    default values: "down"
 *    NOTE: Will be ignored if there is no 'start' value.
 * full: Optional, determines whether the search returns a list of objects or names.
 *    accepted values: "true", "false"
 *    default value: "true"

GET
    Used to get a single item.
GET REST endpoint /db/{id}?{type}&{full}
 * Used to GET a single node or edge.
 *
 * id: Required, used to find the object in the database.
 *    accepted values: Any valid identifier.
 *    default value: None.
 * to: Optional, determines whether the database querries nodes or edges.
 *    accepted values: Any valid identifier.
 *    default value: None.
 *    NOTE: get will return an empty object if the to parameter
 *    does not refer to a node linked to id. ie. (id)--(to).
 * full: Optional, determines whether the databse returns a full object or identifier only.
 *    accepted values: "true", "false".
 *    default value: "true".
 *    NOTE: will be ignored if 'to' is set.

CREATE
    used to create item(s).
POST REST endpoint /db?{from}&{to}
* Used to POST a single node or edge.
* PARAMETERS:
* from: Optional, determines whether the database querries nodes or edges.
*    accepted values: Any valid identifier.
*    default value: None.
*    NOTE: get will return an empty object if the to parameter
*    does not refer to a node linked to id. ie. (id)--(to).
* to: Optional, determines whether the databse returns a full object or identifier only.
*    accepted values: "true", "false".
*    default value: "true".
*    NOTE: will be ignored if 'to' is set.
* REQUEST BODY:
*    a valid json object containing the parameters of a new node or edge.
*    NOTE: due to database limitations the object can't be more than two
*    layers deep.

UPDATE
    used to replace an item.
PUT REST endpoint /db/{id}?{to}
 * This verb will overwrite any existing data on the
 * target node/edge.
 * PARAMETERS:
 * id: Required, used to determine which object to update
 *  accepted values: Any valid id.
 *  default value: none
 * to: Optional, used with id to identify an edge.
 *  ex. (id)-[target]->(to)
 *  accepted values: Any valid id.
 *  default value: none.
 *
 * REQUEST BODY:
 *  a valid json object containing the new parameters of a node or edge.
 *  NOTE: due to database limitations the object can't be more than two
 *  layers deep.

PATCH
    used to append or change an item's properties.
PATCH REST endpoint /db/{id}?{to}
 * This verb will not overwrite any existing data on the
 * target node/edge unless explicitly provided with a new
 * value.
 * PARAMETERS:
 * id: Required, used to determine which object to update
 *  accepted values: Any valid id.
 *  default value: none
 * to: Optional, used with id to identify an edge.
 *  ex. (id)-[target]->(to)
 *  accepted values: Any valid id.
 *  default value: none.
 *
 * REQUEST BODY:
 *  a valid json object containing the new parameters of a node or edge.
 *  NOTE: due to database limitations the object can't be more than two
 *  layers deep.

REMOVE
    used to delete an item.
DELETE REST endpoint /db/{id}?{to}&{detach}
 * This verb will delete the target node or edge.
 * NOTE: a node with existing edges can't be deleted unless
 * you first remove the edges or set the detach parameter to true.
 * PARAMETERS:
 * id: Required, used to determine which object to delete
 *  accepted values: Any valid id.
 *  default value: none
 * to: Optional, used with id to identify an edge.
 *  ex. (id)-[target]->(to)
 *  accepted values: Any valid id.
 *  default value: none.
 * detach: optional, detaches (ie. deletes) all the edges connecting to
 * the node before deleting it.
 * NOTE: This argument is ignored if 'to' is set as the databse does not
 * support connecting edges to other edges.





## About

This project uses [Feathers](http://feathersjs.com). An open source web framework for building modern real-time applications.

## Getting Started

Getting up and running is as easy as 1, 2, 3.

1. Make sure you have [NodeJS](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.
2. Install your dependencies

    ```
    cd path/to/it-depends-server; npm install
    ```
3. Configure the default.json in /config
    including authentication, dbUrl and dbInit objects. 

4. Start your app

    ```
    npm start
    ```
5. After running create on /user you should re-enable authentication in
    /src/services/users/user.hooks.js by uncommenting 'authenticate('jwt')'
    in the 'before' object.

## Testing

Simply run `npm test` and all your tests in the `test/` directory will be run.

## Scaffolding

Feathers has a powerful command line interface. Here are a few things it can do:

```
$ npm install -g @feathersjs/cli          # Install Feathers CLI

$ feathers generate service               # Generate a new Service
$ feathers generate hook                  # Generate a new Hook
$ feathers generate model                 # Generate a new Model
$ feathers help                           # Show all commands
```

## Help

For more information on all the things you can do with Feathers visit [docs.feathersjs.com](http://docs.feathersjs.com).

## Changelog

__0.1.0__

- Initial release

## License

Copyright (c) 2016

Licensed under the [MIT license](LICENSE).
